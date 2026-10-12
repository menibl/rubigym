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
    const renewalExpiry = (payload.payments || []).filter(payment => payment.status === 'PAID' && !payment.refundedAt)
      .flatMap(payment => payment.renewalExtensions || []).filter(item => item.userId === user.id)
      .map(item => item.newExpiry).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date || '')).sort().at(-1);
    if (renewalExpiry && user.membershipExpiry >= renewalExpiry) return user;
    const paid = (payload.payments || []).some(payment => {
      if (payment.status !== 'PAID' || payment.purchaseMode === 'ADDON') return false;
      // Recurring access is derived from the verified charge number, not the
      // IPN arrival date. A delayed notification must not buy a free month.
      if (payment.recurringChargeNumber !== undefined) return false;
      const when = payment.timestamp ? new Date(payment.timestamp) : null;
      const date = when && Number.isFinite(when.getTime()) ? clubDate(when) : String(payment.date || '');
      if (date.slice(0, 7) !== today.slice(0, 7) || date > today) return false;
      if (payment.traineeId === user.id && isCalendarMembership(payment.membershipTypePurchased)) return true;
      return payment.membershipTypePurchased === 'FAMILY_MEMBERSHIP'
        && payment.familyMemberPlans?.some(plan => plan.memberId === user.id && plan.membershipType === user.membershipType && (!plan.participation || plan.participation === 'INCLUDED'));
    });
    const paidExpiry = renewalExpiry && renewalExpiry > expiry ? renewalExpiry : expiry;
    if (!paid || (user.membershipExpiry === paidExpiry && user.membershipExpiryExclusive && user.monthlyBillingDay === 1)) return user;
    changed = true;
    return { ...user, membershipExpiryBeforeCalendar: user.membershipExpiryBeforeCalendar || user.membershipExpiry,
      membershipExpiry: paidExpiry, membershipExpiryExclusive: true, monthlyBillingDay: 1 };
  });
  return { changed, payload: changed ? { ...payload, users } : payload };
}
