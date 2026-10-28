import { clubDate, isCalendarMembership, nextMonthStart } from './membership-calendar.js';
import { validReminderDate } from './payment-reminder-policy.js';
import { uniquePayments } from './payment-ledger.js';
import { isTestPayment, paymentCoversPlan } from './admin-trainees.js';
import { familySelectedPlans } from './family-multiple-plans.js';

const paymentDate = payment => {
  const timestamp = new Date(payment?.timestamp || '');
  return Number.isFinite(timestamp.getTime()) ? clubDate(timestamp) : payment?.date;
};
const addMonths = (date, months) => {
  const [year, month, day] = date.split('-').map(Number);
  const end = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, end))).toISOString().slice(0, 10);
};

function planTerm(user, type, payment) {
  const primary = type === user.membershipType;
  const recorded = primary ? user.membershipExpiry : user.membershipPlanExpiries?.[type];
  if (validReminderDate(recorded)) return { expiry: recorded, exclusive: primary ? Boolean(user.membershipExpiryExclusive) : isCalendarMembership(type), termSource: 'PROFILE' };
  const date = paymentDate(payment);
  // Recurring access is established by the verified charge number, not IPN arrival date.
  if (payment?.status !== 'PAID' || !validReminderDate(date) || payment.recurringChargeNumber !== undefined) return { expiry: null, exclusive: false, termSource: 'UNKNOWN' };
  if (isCalendarMembership(type)) return { expiry: nextMonthStart(date), exclusive: true, termSource: 'RECEIPT' };
  if (!payment.familyMemberPlans?.length && Number.isInteger(payment.billingTermMonths) && payment.billingTermMonths > 0 && payment.billingTermMonths <= 120) {
    return { expiry: addMonths(date, payment.billingTermMonths), exclusive: false, termSource: 'RECEIPT' };
  }
  return { expiry: null, exclusive: false, termSource: 'UNKNOWN' };
}

// Read-only inventory: never grants access or changes memberships/payment history.
export function adminMembershipSummary(user, payments = [], now = new Date()) {
  const today = clubDate(now);
  const related = uniquePayments(payments.filter(payment => !isTestPayment(payment)
    && (payment.traineeId === user.id || payment.familyMemberPlans?.some(member => member.memberId === user.id))));
  const assigned = [...new Set([user.membershipType, ...(user.secondaryMemberships || [])].filter(Boolean))];
  const discovered = related.filter(payment => payment.status === 'PAID').flatMap(payment => payment.familyMemberPlans?.length
    ? payment.familyMemberPlans.filter(member => member.memberId === user.id && (!member.participation || member.participation === 'INCLUDED')).flatMap(member => familySelectedPlans(member).map(plan => plan.membershipType))
    : [payment.membershipTypePurchased]).filter(Boolean);
  return [...new Set([...assigned, ...discovered])].flatMap(type => {
    const paid = related.find(payment => payment.status === 'PAID' && paymentCoversPlan(payment, user.id, type));
    const contract = user.recurringMemberships?.[type];
    const term = contract && contract.status !== 'PAYMENT_FAILED' && contract.endsAt > today
      ? { expiry: contract.endsAt, exclusive: true, termSource: 'CONTRACT' } : planTerm(user, type, paid);
    const expired = term.expiry ? term.exclusive ? term.expiry <= today : term.expiry < today : false;
    const frozen = Boolean(user.isMembershipFrozen && (!user.membershipFrozenUntil || user.membershipFrozenUntil >= today));
    const cancelled = Boolean(user.cancellationEffectiveDate && user.cancellationEffectiveDate <= today);
    const assignedPlan = assigned.includes(type);
    const credited = paid && related.some(payment => payment.status === 'PAID' && (payment.familyCreditSourcePaymentId === paid.id
      || (payment.upgradeFrom === type && String(payment.timestamp || payment.date) >= String(paid.timestamp || paid.date))));
    const latestRefund = related.some(payment => payment.status === 'REFUNDED' && paymentCoversPlan(payment, user.id, type)
      && String(payment.timestamp || payment.date) >= String(paid?.timestamp || paid?.date || ''));
    // Receipt-only additions require positive, current term evidence. Old purchases
    // or unknown/family mixed terms must not silently become active plans.
    if (!assignedPlan && (!paid || !term.expiry || expired || credited || latestRefund || paymentDate(paid) > today)) return [];
    const status = cancelled ? 'מבוטל' : frozen ? 'מוקפא' : contract?.status === 'PAYMENT_FAILED' ? 'הושהה — כשל חיוב מאומת' : expired ? 'פג תוקף'
      : contract?.status === 'PENDING_FIRST_CHARGE' ? 'פעיל — ממתין לאישור החיוב הראשון'
      : latestRefund ? 'קיים החזר למסלול — נדרשת בדיקת תוקף'
      : credited ? 'התשלום קוזז למסלול אחר' : !term.expiry ? 'תוקף לא תועד'
      : type === user.membershipType && user.offlinePaymentApproved ? 'אישור חריג'
      : paid ? 'רכישה בתוקף' : 'מוגדר בפרופיל — ללא תשלום מתועד';
    return [{ type, primary: type === user.membershipType, assigned: assignedPlan, ...term, status,
      active: Boolean(term.expiry && !expired && !frozen && !cancelled && !credited && !latestRefund && contract?.status !== 'PAYMENT_FAILED'), payment: paid }];
  });
}
