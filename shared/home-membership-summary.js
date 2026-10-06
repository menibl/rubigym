import { clubDate, isCalendarMembership, nextMonthStart } from './membership-calendar.js';

const workoutTypes = ['WORKOUT_PLAN', 'WORKOUT_COACHING'];
const nutritionTypes = ['NUTRITION_PLAN', 'NUTRITION_COACHING'];
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`));
const purchaseDate = payment => {
  const timestamp = new Date(payment.timestamp || '');
  return Number.isFinite(timestamp.getTime()) ? clubDate(timestamp) : payment.date;
};
const addMonths = (date, months) => {
  const [year, month, day] = date.split('-').map(Number);
  const last = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, last))).toISOString().slice(0, 10);
};

// Read-only projection. Never mark a manually added secondary plan as paid by inference.
export function homeMembershipSummary(user, payments = [], now = new Date()) {
  const today = clubDate(now);
  const related = payments.filter(p => p.traineeId === user.id || p.familyMemberPlans?.some(m => m.memberId === user.id))
    .slice().sort((a, b) => String(b.timestamp || b.date).localeCompare(String(a.timestamp || a.date)));
  const types = [...new Set([user.membershipType, ...(user.secondaryMemberships || [])].filter(Boolean))];
  for (const [flag, category] of [[user.requestedWorkoutPlan, workoutTypes], [user.nutritionPlanPaid, nutritionTypes]]) {
    if (flag && !types.some(type => category.includes(type))) types.push(related.find(p => p.status === 'PAID' && category.includes(p.membershipTypePurchased))?.membershipTypePurchased || category[0]);
  }
  return types.map(type => {
    const payment = related.find(p => p.familyMemberPlans?.length
      ? p.familyMemberPlans.some(m => m.memberId === user.id && m.membershipType === type && (!m.participation || m.participation === 'INCLUDED'))
      : p.traineeId === user.id && p.membershipTypePurchased === type);
    let expiry = type === user.membershipType && validDate(user.membershipExpiry) ? user.membershipExpiry : null;
    let exclusive = type === user.membershipType ? Boolean(user.membershipExpiryExclusive) : false;
    // Family receipts do not necessarily carry this member's separate term snapshot.
    const date = payment && purchaseDate(payment);
    if (!expiry && payment?.status === 'PAID' && validDate(date) && !payment.familyMemberPlans?.length) {
      if (isCalendarMembership(type)) { expiry = nextMonthStart(date); exclusive = true; }
      else if (Number.isInteger(payment.billingTermMonths) && payment.billingTermMonths > 0 && payment.billingTermMonths <= 120) expiry = addMonths(date, payment.billingTermMonths);
    }
    const expired = expiry && (exclusive ? expiry <= today : expiry < today);
    const frozen = user.isMembershipFrozen && (!user.membershipFrozenUntil || user.membershipFrozenUntil >= today);
    const cancelled = user.cancellationEffectiveDate && user.cancellationEffectiveDate <= today;
    let status = payment?.status === 'PAID' ? 'שולם' : payment?.status === 'REFUNDED' ? 'הוחזר' : payment?.status === 'PENDING' ? 'ממתין לתשלום'
      : user.offlinePaymentApproved ? 'מאושר ידנית' : user.registrationPaymentPending || user.familyPaymentPending || user.membershipStatus === 'DEBT' ? 'ממתין לתשלום'
      : type === user.membershipType && user.membershipStatus === 'ACTIVE' ? 'פעיל' : 'לא תועד תשלום';
    if (user.registrationIncomplete) status = 'נדרש להשלים פרטים';
    else if (frozen) status += ' · מוקפא';
    else if (cancelled) status += ' · מבוטל';
    else if (expired || (type === user.membershipType && user.membershipStatus === 'EXPIRED')) status += ' · פג תוקף';
    const field = type === 'PERSONAL_TRAINING' ? 'personalTrainingRemaining' : type === 'DUO_TRAINING' ? 'duoTrainingRemaining' : type === 'OPEN_PUNCH_CARD' ? 'punchCardRemaining' : null;
    const sizeField = type === 'PERSONAL_TRAINING' ? 'personalTrainingCardSize' : type === 'DUO_TRAINING' ? 'duoTrainingCardSize' : null;
    return { type, status, expiry, remaining: field ? Number(user[field] || 0) : null,
      size: sizeField && Number(user[sizeField]) > 0 ? Number(user[sizeField]) : null };
  });
}
