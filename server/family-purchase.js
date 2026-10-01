export const familyPurchaseIdentity = (user, order) => order.m === 'FAMILY_MEMBERSHIP' ? {
  familyId: user.familyId || `fam-${user.id}`,
  familyName: order.fn || user.familyName || `משפחת ${user.name || ''}`,
  isFamilyPayer: true,
  familyPayerId: undefined,
  familyMembersCount: Number(order.f),
  familyBillingMode: order.fm || 'ANNUAL_BY_SIZE',
  familyMemberPlans: order.fp || user.familyMemberPlans,
} : {};

// Repair only a purchase backed by a paid family record and an already-stored
// quota. Never guess the quota or turn a dependent into a payer.
export function repairPaidFamilyOwners(payload) {
  let changed = false;
  const users = (payload.users || []).map(user => {
    if (user.role !== 'TRAINEE' || (user.familyPayerId && user.familyPayerId !== user.id)
      || (user.isFamilyPayer && user.familyId)) return user;
    if (user.membershipType !== 'FAMILY_MEMBERSHIP' && user.familyBillingMode !== 'CUSTOM_COMBINED') return user;
    const payment = (payload.payments || []).filter(payment => payment.traineeId === user.id
      && payment.status === 'PAID' && payment.membershipTypePurchased === 'FAMILY_MEMBERSHIP')
      .sort((a, b) => String(b.timestamp || b.date).localeCompare(String(a.timestamp || a.date)))[0];
    const count = Number(payment?.familyMembersCount || user.familyMembersCount);
    if (!payment || !Number.isInteger(count) || count < 2 || count > 6) return user;
    changed = true;
    const existingFamilyId = user.familyId || (payload.users || []).find(member => member.familyPayerId === user.id)?.familyId;
    return { ...user, ...familyPurchaseIdentity({ ...user, familyId: existingFamilyId }, {
      m: 'FAMILY_MEMBERSHIP', f: count, fm: payment.familyBillingMode || user.familyBillingMode,
      fn: user.familyName, fp: user.familyMemberPlans,
    }) };
  });
  return { changed, payload: changed ? { ...payload, users } : payload };
}
