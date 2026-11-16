import { ownedRecoveryCheckouts, canRestartUndispatched } from './checkout-recovery.js';

const handled = new Set(['PAID', 'SETUP', 'EXISTING_RECURRING', 'ALREADY_PAID', 'CANCELLED']);
export function checkoutPreflightTarget(payload, payerId, id, batch) {
  if (batch?.id === id && batch.payerId === payerId && !batch.cancelled) {
    const line = batch.items.find(item => !handled.has(item.status));
    if (!line) return { phase: 'COMPLETED' };
    if (!line.recurring) return line.checkout?.paymentReference
      ? { oneOff: { batchId: batch.id, itemId: line.id } } : { phase: line.status === 'READY' ? 'NOT_SENT' : 'REVIEW_REQUIRED' };
    const reservation = (payload.recurringCheckouts || []).find(item => !item.cancelledAt
      && item.userId === line.memberId && item.membershipType === line.membershipType
      && item.orderSnapshot?.u === payerId && item.orderSnapshot.bs === batch.id && item.orderSnapshot.bi === line.id);
    if (!reservation) return { phase: line.status === 'READY' && !line.checkout ? 'NOT_SENT' : 'REVIEW_REQUIRED' };
    return { reservation, split: { familySplitBatchId: batch.id, familySplitItemId: line.id } };
  }
  const reservation = ownedRecoveryCheckouts(payload, payerId).find(item => item.orderId === id);
  if (!reservation) {
    const known = (payload.recurringCheckouts || []).find(item => item.orderId === id && !item.cancelledAt
      && !item.orderSnapshot?.bs && (item.orderSnapshot?.u || item.userId) === payerId);
    if (known && (known.orderSnapshot?.gp || [{ memberId: known.userId, membershipType: known.membershipType }]).every(line => {
      const contract = payload.users?.find(user => user.id === line.memberId)?.recurringMemberships?.[line.membershipType];
      return contract?.orderId === id && ['ACTIVE', 'PENDING_FIRST_CHARGE'].includes(contract.status) && !contract.cancelledAt;
    })) return { phase: 'COMPLETED' };
    return null;
  }
  if (canRestartUndispatched(reservation)) return { phase: 'NOT_SENT' };
  return { reservation };
}

// Background checks never return a URL, signed reference or card data. An
// explicit continuation re-verifies the order before returning the original URL.
export function publicCheckoutPreflight(outcome, ok) {
  if (!ok) return { code: outcome.code, reasonCode: outcome.reasonCode, message: outcome.message };
  if (outcome.completed) return { phase: 'COMPLETED', message: outcome.message };
  if (outcome.resumed && outcome.url && outcome.paymentReference) return { phase: 'READY', message: 'הבקשה נבדקה אוטומטית. אפשר להמשיך באותו דף תשלום; טרם אושר תשלום.' };
  return { phase: 'REVIEW_REQUIRED', message: 'לא התקבל אישור להמשך בטוח. הבקשה נשמרה ולא נפתח חיוב נוסף.' };
}
