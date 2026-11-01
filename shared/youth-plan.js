import { clubDate } from './membership-calendar.js';

export const isYouthPlan = plan => ['YOUTH_ONCE_WEEKLY', 'YOUTH_TWICE_WEEKLY'].includes(typeof plan === 'string' ? plan : plan?.id)
  || /נוער/.test(typeof plan === 'object' ? String(plan?.label || '') : '');

// Prefer date of birth over a cached age. Use the club's date for birthdays.
export function membershipAge(person, now = new Date()) {
  if (person?.birthDate) {
    const birth = String(person.birthDate), today = clubDate(now);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || birth > today) return null;
    const date = new Date(`${birth}T12:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== birth) return null;
    return Number(today.slice(0, 4)) - Number(birth.slice(0, 4)) - (today.slice(5) < birth.slice(5) ? 1 : 0);
  }
  return Number.isFinite(person?.age) && person.age > 0 ? person.age : null;
}

export function canPurchasePlan(plan, person, now = new Date()) {
  if (!isYouthPlan(plan)) return true;
  const age = membershipAge(person, now);
  return age !== null && age > 0 && age < 19;
}

// Only stored beneficiary profiles are trusted, never an age supplied at checkout.
export function invalidYouthPurchase(payload, body, splitLine, now = new Date()) {
  const selections = splitLine
    ? (splitLine.groupLines || [{ memberId: splitLine.beneficiaryId, membershipType: body.membershipType }])
    : body.membershipType === 'FAMILY_MEMBERSHIP'
      ? (Array.isArray(body.familyMemberPlans) ? body.familyMemberPlans : []).filter(row => !row.participation || row.participation === 'INCLUDED')
        .flatMap(row => [row, ...(row.additionalPlans || [])].map(plan => ({ memberId: row.memberId, membershipType: plan.membershipType })))
      : [{ memberId: body.userId, membershipType: body.membershipType }];
  return selections.some(selection => {
    const plan = payload?.settings?.membershipPlans?.find(row => row.id === selection.membershipType) || selection.membershipType;
    return !canPurchasePlan(plan, payload?.users?.find(row => row.id === selection.memberId), now);
  });
}
