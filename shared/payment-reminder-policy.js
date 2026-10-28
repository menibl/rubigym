import { clubDate } from './membership-calendar.js';
import { recurringAccessUntil } from './recurring-access.js';

export const validReminderDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const shiftReminderDate = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

export function paymentReminderWindow(user, today = clubDate()) {
  if (!validReminderDate(user?.membershipExpiry)) return null;
  const start = user.membershipExpiryExclusive ? user.membershipExpiry : shiftReminderDate(user.membershipExpiry, 1);
  const defaultUntil = shiftReminderDate(start, 13); // Fourteen calendar days, inclusive.
  const extended = user.paymentReminderExpiry === user.membershipExpiry && validReminderDate(user.paymentReminderUntil)
    && user.paymentReminderUntil > defaultUntil;
  const until = extended ? user.paymentReminderUntil : defaultUntil;
  return { start, until, active: today >= start && today <= until,
    day: Math.round((Date.parse(today) - Date.parse(start)) / 86400000) };
}

export function paymentReminderEligible(user, today = clubDate()) {
  // An approved auto-charge contract is not an unpaid manual renewal. A verified
  // failure sends its own notification; never invite a duplicate checkout on delay.
  if (recurringAccessUntil(user, today)) return false;
  if (user?.role !== 'TRAINEE' || user.registrationIncomplete || user.paymentReminderExempt
    || (user.isMembershipFrozen && (!user.membershipFrozenUntil || user.membershipFrozenUntil >= today))
    || (user.cancellationEffectiveDate && user.cancellationEffectiveDate <= today)) return false;
  return Boolean(paymentReminderWindow(user, today)?.active);
}
