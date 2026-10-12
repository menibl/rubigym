import { clubDate, nextMonthStart, membershipExpired } from '../shared/membership-calendar.js';

const openTypes = new Set(['OPEN_GYM', 'OPEN_MONTHLY', 'OPEN_ANNUAL']);
const groupTypes = new Set(['CORE_GROUPS', 'GROUP_MONTHLY', 'GROUP_ANNUAL', 'YOUTH_ONCE_WEEKLY', 'YOUTH_TWICE_WEEKLY']);

// Use a verified, individual receipt, never catalog price or client supplied credit.
// Family receipts need a beneficiary allocation; recurring contracts need a change
// of contract rather than reducing every future charge. Fail closed for both.
export function openGroupUpgradeQuote(payload, request, purchase, now = new Date()) {
  if (request.mode !== 'PRIMARY' || !groupTypes.has(request.membershipType)) return null;
  const user = payload?.users?.find(item => item.id === request.userId);
  if (!user || !openTypes.has(user.membershipType) || user.membershipStatus !== 'ACTIVE' || membershipExpired(user, clubDate(now))) return null;
  const today = clubDate(now), expiry = nextMonthStart(today);
  const receipts = (payload.payments || []).filter(payment => {
    if (payment.status !== 'PAID' || payment.refundedAt || payment.isMock || payment.purchaseMode === 'ADDON') return false;
    const stamp = new Date(payment.timestamp || payment.date || '');
    return Number.isFinite(stamp.getTime()) && stamp <= now && clubDate(stamp).slice(0, 7) === today.slice(0, 7)
      && (payment.traineeId === user.id || payment.familyMemberPlans?.some(plan => plan.memberId === user.id));
  });
  const source = receipts.filter(payment => payment.traineeId === user.id && payment.membershipTypePurchased === user.membershipType
    && ((payment.provider === 'RIVHIT' && (payment.providerTransactionId || payment.providerSaleId))
      || (/^payment-rivhit-/.test(payment.id || '') && /^RIVHIT iCredit/.test(payment.paymentMethod || ''))))
    .sort((a, b) => String(b.timestamp || b.date).localeCompare(String(a.timestamp || a.date)))[0];
  const cancelled = new Set((payload.payments || []).filter(payment => payment.recurringCancelledAt).map(payment => payment.providerRecurringSaleId));
  const activeSeries = (payload.payments || []).some(payment => payment.traineeId === user.id && payment.providerRecurringSaleId
    && !cancelled.has(payment.providerRecurringSaleId) && !payment.refundedAt && payment.status === 'PAID');
  if (activeSeries) throw new Error('UPGRADE_REVIEW_REQUIRED');
  if (!source) {
    if (receipts.some(payment => payment.membershipTypePurchased === 'FAMILY_MEMBERSHIP')) throw new Error('UPGRADE_REVIEW_REQUIRED');
    return null;
  }
  if (purchase.recurring || purchase.billingPeriod !== 'MONTHLY'
    || user.membershipExpiry > expiry || source.familyCreditAmount || source.familySplitBatchId
    || source.upgradeCreditAmount || !(Number(source.amount) > 0)) throw new Error('UPGRADE_REVIEW_REQUIRED');
  const packageAmount = Math.round(purchase.amount * 100) / 100;
  const creditAmount = Math.min(packageAmount, Math.round(Number(source.amount) * 100) / 100);
  return { packageAmount, creditAmount, amountDue: Math.round((packageAmount - creditAmount) * 100) / 100,
    sourcePaymentId: source.id, upgrade: { from: user.membershipType, to: request.membershipType, expiry } };
}
