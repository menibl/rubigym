// Quote only. Applying a credit requires an atomic server-owned reservation and
// successful payment reconciliation; this helper must never unlock a membership.
const creditableMemberships = new Set(['OPEN_GYM', 'GROUP_MONTHLY', 'GROUP_ANNUAL', 'FAMILY_MEMBERSHIP']);
const cents = amount => Math.round(Number(amount) * 100);

export function quoteFamilyCredit({ user, payments = [], packageAmount, production = true, now = Date.now() }) {
  const packageCents = cents(packageAmount);
  if (!Number.isSafeInteger(packageCents) || packageCents < 0) throw new Error('INVALID_FAMILY_PRICE');
  const result = { packageAmount: packageCents / 100, creditAmount: 0, amountDue: packageCents / 100, sourcePaymentId: null };
  if (!user || user.membershipStatus !== 'ACTIVE' || !creditableMemberships.has(user.membershipType)
    || (user.familyPayerId && user.familyPayerId !== user.id)) return result;
  const expiry = Date.parse(user.membershipExpiry || '');
  if (!Number.isFinite(expiry) || expiry < now) return result;

  // Select the latest primary-plan payment first. Never fall back to an older
  // payment when the latest was refunded, consumed, or otherwise ineligible.
  const latest = payments.filter(payment => payment.traineeId === user.id
    && payment.membershipTypePurchased === user.membershipType
    && payment.purchaseMode !== 'ADDON')
    .sort((a, b) => (Date.parse(b.timestamp || b.date) || 0) - (Date.parse(a.timestamp || a.date) || 0))[0];
  if (!latest?.id || latest.status !== 'PAID' || latest.refundedAt || latest.familyCreditUsedBy
    || latest.familyCreditReservedBy || (production && latest.isMock)
    || latest.provider !== 'RIVHIT' || (!latest.providerTransactionId && !latest.providerSaleId)) return result;
  const paidCents = cents(latest.amount);
  if (!Number.isSafeInteger(paidCents) || paidCents <= 0) return result;
  const creditCents = Math.min(packageCents, paidCents);
  return { ...result, creditAmount: creditCents / 100, amountDue: (packageCents - creditCents) / 100, sourcePaymentId: latest.id };
}
