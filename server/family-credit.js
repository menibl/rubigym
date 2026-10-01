export function familyCreditQuote(payload, userId, packageAmount, production = true, now = Date.now()) {
  const user = (payload.users || []).find(item => item.id === userId);
  const base = { packageAmount, creditAmount: 0, amountDue: packageAmount, sourcePaymentId: null };
  if (!user || user.membershipStatus !== 'ACTIVE' || Date.parse(user.membershipExpiry || '') < now || !Number.isFinite(Date.parse(user.membershipExpiry || ''))) return base;
  const payment = (payload.payments || []).filter(item => item.traineeId === userId && item.purchaseMode !== 'ADDON'
    && (item.membershipTypePurchased === user.membershipType || item.membershipTypePurchased === 'FAMILY_MEMBERSHIP'))
    .sort((a, b) => String(b.timestamp || b.date).localeCompare(String(a.timestamp || a.date)))[0];
  // Earlier registration receipts stored the verified transaction in the id
  // rather than separate provider fields. Preserve those existing paid records.
  const legacyReceipt = payment && /^payment-rivhit-.+/.test(payment.id || '') && /^RIVHIT iCredit/.test(payment.paymentMethod || '');
  const providerReceipt = payment?.provider === 'RIVHIT' && (payment.providerSaleId || payment.providerTransactionId);
  if (!payment || payment.familyPartialPurchase || payment.status !== 'PAID' || payment.refundedAt || (production && payment.isMock)
    || (!providerReceipt && !legacyReceipt)) return base;
  const paidAt = Date.parse(payment.timestamp || payment.date || '');
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit' });
  if (!Number.isFinite(paidAt) || paidAt > now || month.format(new Date(paidAt)) !== month.format(new Date(now))) return base;
  const paid = Number(payment.familyPackageAmount ?? payment.amount);
  if (!Number.isFinite(paid) || paid <= 0) return base;
  const creditAmount = Math.min(Math.round(paid * 100), Math.round(packageAmount * 100)) / 100;
  return { ...base, creditAmount, amountDue: Math.round((packageAmount - creditAmount) * 100) / 100, sourcePaymentId: payment.id };
}

export function validateFamilySelection(payload, payerId, plans) {
  const payer = payload.users?.find(user => user.id === payerId);
  if (!payer || (payer.familyPayerId && payer.familyPayerId !== payerId) || plans?.[0]?.memberId !== payerId
    || new Set(plans.map(plan => plan.memberId)).size !== plans.length) throw new Error('INVALID_FAMILY_SELECTION');
  return plans.map(plan => {
    const member = payload.users.find(user => user.id === plan.memberId);
    if (!member || (member.id !== payerId && (!payer.familyId || member.familyId !== payer.familyId || member.familyPayerId !== payerId))) throw new Error('INVALID_FAMILY_SELECTION');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const frozen = member.isMembershipFrozen && (!member.membershipFrozenUntil || member.membershipFrozenUntil >= today);
    if (plan.participation === 'FROZEN' && !frozen) throw new Error('INVALID_FAMILY_SELECTION');
    if ((!plan.participation || plan.participation === 'INCLUDED') && frozen) throw new Error('INVALID_FAMILY_SELECTION');
    return { ...plan, memberName: member.name };
  });
}
