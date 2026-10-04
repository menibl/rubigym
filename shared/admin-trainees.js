/** @param {any[]} payments @param {string} userId */
export function traineePayments(payments, userId) {
  const seen = new Set();
  return payments.filter(payment => payment.traineeId === userId)
    .sort((a, b) => String(b.timestamp || b.date).localeCompare(String(a.timestamp || a.date)))
    .filter(payment => {
      const key = payment.providerTransactionId || payment.paymentReference || payment.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** @param {any} payment @param {any[]} discounts */
export function recordedDiscount(payment, discounts) {
  if (payment.discountCode !== undefined) return payment.discountCode;
  const ids = [payment.providerTransactionId, payment.providerSaleId, payment.paymentReference,
    String(payment.id || '').replace(/^payment-rivhit-/, '')].filter(Boolean);
  return discounts.find(code => code.usedByPaymentId && ids.includes(code.usedByPaymentId))?.code;
}

/** Reassign only family links. Never fabricate a payment or change a plan/status.
 * @param {any[]} users @param {string} userId @param {string} payerId
 */
export function assignTraineeFamily(users, userId, payerId) {
  const user = users.find(member => member.id === userId);
  if (!user || user.role !== 'TRAINEE') throw new Error('המתאמן לא נמצא.');
  if ((user.familyPayerId || (user.isFamilyPayer ? user.id : '')) === payerId) return users;
  if (user.isFamilyPayer && users.some(member => member.id !== user.id && member.familyId === user.familyId)) {
    throw new Error('לפני העברת ראש משפחה יש להעביר את האחריות על המשפחה למשלם אחר.');
  }
  const payer = payerId ? users.find(member => member.id === payerId && member.isFamilyPayer && member.familyId && member.role === 'TRAINEE') : null;
  if (payerId && (!payer || payer.id === userId)) throw new Error('יש לבחור משלם של משפחה קיימת.');
  const next = users.map(member => member.id === userId ? {
    ...member, familyId: payer?.familyId, familyName: payer?.familyName,
    familyPayerId: payer?.id, isFamilyPayer: false,
    familyMembersCount: undefined, familyMemberPlans: undefined,
    ...(payer ? {} : { familyPaymentPending: false,
      registrationPaymentPending: Boolean(member.registrationPaymentPending || (member.familyPaymentPending && member.membershipStatus !== 'ACTIVE')) }),
  } : member);
  if (payer && next.filter(member => member.familyId === payer.familyId).length > 6) throw new Error('ניתן לשייך עד שישה בני משפחה.');
  return next.map(member => {
    if (!member.isFamilyPayer || !member.familyId || ![user.familyId, payer?.familyId].includes(member.familyId)) return member;
    const family = next.filter(candidate => candidate.familyId === member.familyId);
    return { ...member, familyMembersCount: family.length, familyMemberPlans: family.map(candidate => ({
      ...(member.familyMemberPlans?.find(plan => plan.memberId === candidate.id) || {
        membershipType: candidate.membershipType || 'OPEN_GYM',
        participation: candidate.membershipStatus === 'ACTIVE' ? 'SKIP' : 'INCLUDED',
      }), memberId: candidate.id, memberName: candidate.name,
    })) };
  });
}
