import { MembershipPlanConfig, TrainingCardSize } from '../types';

export type MembershipBillingPeriod = NonNullable<MembershipPlanConfig['billingPeriod']>;

export const BILLING_PERIOD_OPTIONS: Array<{ value: MembershipBillingPeriod; label: string }> = [
  { value: 'ONE_TIME', label: 'תשלום חד־פעמי' },
  { value: 'MONTHLY', label: 'לחודש' },
  { value: 'THREE_MONTHS', label: 'לשלושה חודשים' },
  { value: 'SIX_MONTHS', label: 'לחצי שנה' },
  { value: 'ANNUAL', label: 'לשנה — תשלום חד־פעמי' },
  { value: 'SESSION_PACK', label: 'לפי כמות אימונים' },
  { value: 'MONTHLY_ANNUAL_COMMITMENT', label: 'חיוב חודשי בהתחייבות לשנה' }
];

export const billingPeriodForPlan = (plan?: MembershipPlanConfig): MembershipBillingPeriod => {
  if (plan?.billingPeriod) return plan.billingPeriod;
  if (plan?.priceUnit === 'MONTH') return 'MONTHLY';
  if (plan?.priceUnit === 'SESSION') return 'SESSION_PACK';
  return 'ONE_TIME';
};

export const priceUnitForBillingPeriod = (period: MembershipBillingPeriod): MembershipPlanConfig['priceUnit'] => {
  if (period === 'MONTHLY' || period === 'MONTHLY_ANNUAL_COMMITMENT') return 'MONTH';
  if (period === 'SESSION_PACK') return 'SESSION';
  return 'ONE_TIME';
};

export const billingPeriodLabel = (plan?: MembershipPlanConfig) => {
  const period = billingPeriodForPlan(plan);
  if (period === 'SESSION_PACK' && !plan?.supportsTrainingCard) {
    return `${Math.max(1, Number(plan?.includedSessions) || 1)} אימונים`;
  }
  return BILLING_PERIOD_OPTIONS.find(option => option.value === period)?.label || 'תשלום חד־פעמי';
};

export const isSelectableTrainingCard = (plan?: MembershipPlanConfig) =>
  billingPeriodForPlan(plan) === 'SESSION_PACK' && Boolean(plan?.supportsTrainingCard);

export const membershipCheckoutAmount = (plan: MembershipPlanConfig | undefined, selectedSessions: TrainingCardSize = 1) => {
  const price = Math.max(0, Number(plan?.price) || 0);
  return isSelectableTrainingCard(plan) ? price * selectedSessions : price;
};

export const membershipDurationMonthsForPlan = (plan?: MembershipPlanConfig) => {
  switch (billingPeriodForPlan(plan)) {
    case 'THREE_MONTHS': return 3;
    case 'SIX_MONTHS': return 6;
    case 'ANNUAL':
    case 'MONTHLY_ANNUAL_COMMITMENT': return 12;
    case 'MONTHLY': return 1;
    default: return 1;
  }
};
