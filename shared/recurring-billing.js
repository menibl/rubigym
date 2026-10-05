import { clubDate, nextMonthStart } from './membership-calendar.js';

export const RECURRING_TERMS_VERSION = 'baly-recurring-v1';
export const recurringPlan = plan => plan?.paymentMode === 'RECURRING';

export function recurringSummary(plan, now = new Date()) {
  if (!recurringPlan(plan)) return null;
  const months = Number(plan.recurringTermMonths ?? 12);
  if (!Number.isInteger(months) || months < 1 || months > 36 || !Number.isFinite(Number(plan.price)) || Number(plan.price) <= 0) throw new Error('INVALID_RECURRING_PLAN');
  const startsAt = clubDate(now);
  const nextChargeAt = nextMonthStart(startsAt);
  // The initial calendar month is the first month of the agreed term.
  const [year, month] = startsAt.split('-').map(Number);
  const end = new Date(Date.UTC(year, month - 1 + months, 1));
  const endsAt = end.toISOString().slice(0, 10);
  const renewalMode = plan.renewalMode === 'CONFIRM' ? 'CONFIRM' : 'AUTO';
  return {
    termsVersion: RECURRING_TERMS_VERSION, planId: plan.id, planName: plan.label,
    paymentMode: 'RECURRING', monthlyAmount: Number(plan.price), firstChargeAmount: Number(plan.price),
    startsAt, nextChargeAt, endsAt, termMonths: months, renewalMode, billingDay: 1,
    firstChargePolicy: 'FULL_CALENDAR_MONTH',
    notice: `חיוב חודשי מתחדש בהוראת קבע: ₪${Number(plan.price)} בכל חודש. חיוב ראשון מלא עבור החודש הקלנדרי הנוכחי; החיוב הבא ב־${nextChargeAt}. תקופת המסלול עד ${endsAt} (לא כולל). ${renewalMode === 'AUTO' ? `חידוש אוטומטי לתקופה נוספת של ${months} חודשים, עם הודעה מראש ואפשרות לבקש ביטול.` : 'בסיום התקופה נדרש אישור חידוש; ללא אישור לא יימשכו חיובים.'}`
  };
}

// Foundation only. No environment switch can enable charging until the provider integration is complete.
export const recurringCapabilities = () => ({ creationEnabled: false, phase: 'PREPARATION', reason: 'AWAITING_PROVIDER_APPROVAL_AND_INTEGRATION' });

export function recurringCheckoutPlans(body, catalog = []) {
  const ids = body.membershipType === 'FAMILY_MEMBERSHIP'
    ? (body.familyMemberPlans || []).filter(p => !p.participation || p.participation === 'INCLUDED').map(p => p.membershipType)
    : [body.membershipType];
  return catalog.filter(plan => ids.includes(plan.id) && recurringPlan(plan));
}

// Used only with a server-derived summary when provider activation is implemented.
// Never use a client-submitted amount, end date or renewal policy as this snapshot.
export function recurringConsent(summary, userId, acknowledgement, now = new Date()) {
  if (!summary || summary.termsVersion !== RECURRING_TERMS_VERSION || !userId
    || acknowledgement?.accepted !== true || acknowledgement?.termsVersion !== summary.termsVersion) throw new Error('RECURRING_CONSENT_REQUIRED');
  return { userId, acceptedAt: now.toISOString(), termsVersion: summary.termsVersion, summary: { ...summary } };
}
