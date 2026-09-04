import {
  CURRENT_MEMBERSHIP_ADD_ONS,
  CURRENT_PRIMARY_MEMBERSHIP_PLANS,
  FAMILY_MEMBERSHIP_PRICES,
  FamilyBillingMode,
  FamilyMemberPlanSelection,
  MembershipPlanConfig,
  MembershipType,
  MEMBERSHIP_PRICES
} from '../types';

export const FAMILY_MONTHLY_PRICE_PER_MEMBER = 550;

export const CUSTOM_FAMILY_PLAN_OPTIONS = [
  ...CURRENT_PRIMARY_MEMBERSHIP_PLANS,
  ...CURRENT_MEMBERSHIP_ADD_ONS
].filter(type => type !== MembershipType.FAMILY_MEMBERSHIP);

export const resizeFamilyPlans = (
  plans: FamilyMemberPlanSelection[],
  count: number,
  payerName: string,
  payerId?: string
) => Array.from({ length: count }, (_, index) => plans[index] || {
  memberId: index === 0 ? payerId : undefined,
  memberName: index === 0 ? payerName : `בן/בת משפחה ${index + 1}`,
  membershipType: index === 0 ? MembershipType.GROUP_ANNUAL : MembershipType.OPEN_GYM
});

export const familyMemberPlanPrice = (plan: FamilyMemberPlanSelection, planConfigs: MembershipPlanConfig[] = []) => {
  const unitPrice = planConfigs.find(config => config.id === plan.membershipType && config.active)?.price ?? MEMBERSHIP_PRICES[plan.membershipType] ?? 0;
  if (plan.membershipType === MembershipType.PERSONAL_TRAINING || plan.membershipType === MembershipType.DUO_TRAINING) {
    return unitPrice * Math.max(1, Math.min(50, Math.round(plan.trainingSessionsCount || 1)));
  }
  return unitPrice;
};

export const familyPurchaseAmount = (
  mode: FamilyBillingMode,
  count: number,
  plans: FamilyMemberPlanSelection[],
  planConfigs: MembershipPlanConfig[] = []
) => mode === 'ANNUAL_BY_SIZE'
  ? (FAMILY_MEMBERSHIP_PRICES[count] || 0)
  : mode === 'MONTHLY_PER_MEMBER'
    ? count * FAMILY_MONTHLY_PRICE_PER_MEMBER
    : plans.slice(0, count).reduce((sum, plan) => sum + familyMemberPlanPrice(plan, planConfigs), 0);
