const handled = new Set(['PAID', 'SETUP', 'EXISTING_RECURRING', 'ALREADY_PAID', 'CANCELLED']);
export const ownedRecoveryCheckouts = (payload, payerId) => (payload.recurringCheckouts || []).filter(item =>
  !item.cancelledAt && !item.orderSnapshot?.bs && (item.orderSnapshot?.u || item.userId) === payerId
  && !((item.orderSnapshot?.gp || [{ memberId: item.userId, membershipType: item.membershipType }]).every(line => {
    const contract = payload.users?.find(user => user.id === line.memberId)?.recurringMemberships?.[line.membershipType];
    return contract?.orderId === item.orderId && ['ACTIVE', 'PENDING_FIRST_CHARGE'].includes(contract.status) && !contract.cancelledAt;
  })));

export const canRestartUndispatched = (item, now = Date.now()) => Boolean(item.orderSnapshot?.o === item.orderId
  && !item.orderSnapshot.bs && !item.orderSnapshot.gp && !item.cancelledAt && item.stage === 'RESERVED'
  && !item.requestDispatchedAt && !item.recurringSaleId && now - Date.parse(item.dispatchedAt) > 5 * 60_000);

// Redacted metadata only. Original provider URLs and private references are
// returned only by the separately authenticated, order-specific resume action.
export function recoveryItems(payload, payerId, batch, now = Date.now()) {
  const items = ownedRecoveryCheckouts(payload, payerId).sort((a, b) => String(b.dispatchedAt).localeCompare(String(a.dispatchedAt)))
    .slice(0, 20).map(item => ({ id: item.orderId, kind: 'RECURRING',
      label: payload.settings?.membershipPlans?.find(plan => plan.id === item.membershipType)?.label || item.membershipType,
      amount: Number(item.orderSnapshot?.a) || undefined, createdAt: item.dispatchedAt,
      canRestart: canRestartUndispatched(item, now) }));
  if (batch && batch.payerId === payerId && !batch.cancelled && batch.items.some(item => !handled.has(item.status))) {
    const pending = batch.items.filter(item => !handled.has(item.status));
    items.unshift({ id: batch.id, kind: 'FAMILY', label: 'המשך התשלום שנבחר — משפחה / מסלולים משולבים',
      createdAt: batch.createdAt, pendingCount: pending.length, canRestart: false });
  }
  return items;
}
