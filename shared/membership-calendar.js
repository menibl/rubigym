// Paid access is separate from any annual commitment. All dates use the club's timezone.
const calendarTypes = new Set(['OPEN_GYM', 'OPEN_MONTHLY', 'GROUP_MONTHLY', 'GROUP_ANNUAL', 'CORE_GROUPS', 'YOUTH_ONCE_WEEKLY', 'YOUTH_TWICE_WEEKLY', 'FAMILY_MEMBERSHIP']);
export const isCalendarMembership = type => calendarTypes.has(type);
export function clubDate(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function nextMonthStart(date) {
  const [year, month] = date.split('-').map(Number);
  return `${year + (month === 12 ? 1 : 0)}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`;
}
export function calendarTerm(type, now = new Date()) {
  return isCalendarMembership(type) ? {
    membershipStartedAt: clubDate(now), membershipExpiry: nextMonthStart(clubDate(now)),
    membershipExpiryExclusive: true, membershipExpiryManualOverride: false, monthlyBillingDay: 1
  } : {};
}
export function membershipExpired(user, date = clubDate()) {
  return !user?.membershipExpiry || (user.membershipExpiryExclusive ? user.membershipExpiry <= date : user.membershipExpiry < date);
}

// Repair only current-month paid access, with receipt evidence; never override manager edits.
export function repairCalendarMemberships(payload, now = new Date()) {
  const today = clubDate(now), expiry = nextMonthStart(today);
  let changed = false;
  const users = (payload.users || []).map(user => {
    if (!isCalendarMembership(user.membershipType) || user.role !== 'TRAINEE'
      || user.membershipStatus !== 'ACTIVE' || user.membershipExpiryManualOverride
      || user.registrationPaymentPending || user.familyPaymentPending) return user;
    const paid = (payload.payments || []).some(payment => {
      if (payment.status !== 'PAID' || payment.purchaseMode === 'ADDON') return false;
      const when = payment.timestamp ? new Date(payment.timestamp) : null;
      const date = when && Number.isFinite(when.getTime()) ? clubDate(when) : String(payment.date || '');
      if (date.slice(0, 7) !== today.slice(0, 7) || date > today) return false;
      if (payment.traineeId === user.id && isCalendarMembership(payment.membershipTypePurchased)) return true;
      return payment.membershipTypePurchased === 'FAMILY_MEMBERSHIP'
        && payment.familyMemberPlans?.some(plan => plan.memberId === user.id && plan.membershipType === user.membershipType && (!plan.participation || plan.participation === 'INCLUDED'));
    });
    if (!paid || (user.membershipExpiry === expiry && user.membershipExpiryExclusive && user.monthlyBillingDay === 1)) return user;
    changed = true;
    return { ...user, membershipExpiryBeforeCalendar: user.membershipExpiryBeforeCalendar || user.membershipExpiry,
      membershipExpiry: expiry, membershipExpiryExclusive: true, monthlyBillingDay: 1 };
  });
  return { changed, payload: changed ? { ...payload, users } : payload };
}
