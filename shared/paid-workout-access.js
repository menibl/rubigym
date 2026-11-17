import { clubDate, isCalendarMembership, nextMonthStart } from './membership-calendar.js';
import { validReminderDate } from './payment-reminder-policy.js';
import { isTestPayment, paymentCoversPlan } from './admin-trainees.js';
import { uniquePayments } from './payment-ledger.js';

const types = ['WORKOUT_PLAN', 'WORKOUT_COACHING', 'OPEN_GYM_WITH_PLAN'];
const dateOf = payment => {
  const timestamp = new Date(payment.timestamp || '');
  return Number.isFinite(timestamp.getTime()) ? clubDate(timestamp) : payment.date;
};
const addMonths = (date, months) => {
  const [year, month, day] = date.split('-').map(Number);
  const last = new Date(Date.UTC(year, month + months, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, last))).toISOString().slice(0, 10);
};

// A read-only receipt entitlement. Never infer a program term from the gym's
// expiry, today's catalog price, an assigned exercise plan or a pending setup.
export function paidWorkoutPlanUntil(user, payments = [], now = new Date()) {
  if (!user?.id) return undefined;
  const today = clubDate(now);
  const relatedPayments = payments.filter(payment => !isTestPayment(payment)
    && (payment.traineeId === user.id || payment.familyMemberPlans?.some(member => member.memberId === user.id)));
  const relatedIds = new Set(relatedPayments.map(payment => payment.id));
  const ledger = uniquePayments([...relatedPayments, ...payments.filter(payment => !isTestPayment(payment)
    && payment.familyCreditSourcePaymentId && relatedIds.has(payment.familyCreditSourcePaymentId) && !relatedPayments.includes(payment))]);
  const expiries = [];
  for (const type of types) {
    const related = ledger.filter(payment => paymentCoversPlan(payment, user.id, type));
    for (const paid of related.filter(payment => payment.status === 'PAID')) {
      const date = dateOf(paid);
      if (!validReminderDate(date) || date > today || paid.recurringChargeNumber !== undefined) continue;
      if (related.some(payment => payment.status === 'REFUNDED' && String(payment.timestamp || payment.date) >= String(paid.timestamp || paid.date))
        || ledger.some(payment => payment.status === 'PAID' && (payment.familyCreditSourcePaymentId === paid.id
          || (payment.traineeId === user.id && payment.upgradeFrom === type && String(payment.timestamp || payment.date) >= String(paid.timestamp || paid.date))))) continue;
      // An aggregate family term may describe the gym, not this program.
      const recorded = type === user.membershipType ? user.membershipExpiry : user.membershipPlanExpiries?.[type];
      let expiry;
      if (!paid.familyMemberPlans?.length) {
        if (isCalendarMembership(type)) expiry = nextMonthStart(date);
        else if (Number.isInteger(paid.billingTermMonths) && paid.billingTermMonths > 0 && paid.billingTermMonths <= 120) expiry = addMonths(date, paid.billingTermMonths);
      }
      if (validReminderDate(recorded) && recorded >= date) expiry = expiry ? [expiry, recorded].sort()[0] : recorded;
      const exclusive = isCalendarMembership(type) || (type === user.membershipType && user.membershipExpiryExclusive);
      if (validReminderDate(expiry) && (exclusive ? expiry > today : expiry >= today)) expiries.push(exclusive
        ? new Date(Date.parse(`${expiry}T12:00:00Z`) - 86400000).toISOString().slice(0, 10) : expiry);
    }
  }
  return expiries.sort().at(-1);
}

// The projection is supplied by the authenticated server for family receipts
// whose full financial details must not be sent to the beneficiary.
export function hasPaidWorkoutPlanAccess(user, payments = [], now = new Date()) {
  const until = user?.workoutPlanPurchaseAccessUntil;
  return (validReminderDate(until) && until >= clubDate(now)) || Boolean(paidWorkoutPlanUntil(user, payments, now));
}
