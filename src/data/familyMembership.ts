import {
  CURRENT_MEMBERSHIP_ADD_ONS,
  CURRENT_PRIMARY_MEMBERSHIP_PLANS,
  DEFAULT_MEMBERSHIP_PLAN_CONFIGS,
  FAMILY_MEMBERSHIP_PRICES,
  FamilyBillingMode,
  FamilyMemberPlanSelection,
  MembershipPlanConfig,
  MembershipType,
  MEMBERSHIP_PRICES
} from '../types';
import { familyPlanAmount } from '../../shared/family-pricing.js';
import { familySelectedPlans } from '../../shared/family-multiple-plans.js';

export const FAMILY_MONTHLY_PRICE_PER_MEMBER = 550;

export const familyPlanCatalog = (configs?: MembershipPlanConfig[]) =>
  (configs?.length ? configs : DEFAULT_MEMBERSHIP_PLAN_CONFIGS)
    .filter(plan => plan.active && plan.id !== MembershipType.FAMILY_MEMBERSHIP);

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
  if (plan.participation && plan.participation !== 'INCLUDED') return 0;
  return familySelectedPlans(plan).reduce((sum, item) => {
    const unitPrice = planConfigs.find(config => config.id === item.membershipType && config.active)?.price ?? MEMBERSHIP_PRICES[item.membershipType as MembershipType] ?? 0;
    const count = [MembershipType.PERSONAL_TRAINING, MembershipType.DUO_TRAINING].includes(item.membershipType as MembershipType)
      ? Math.max(1, Math.min(50, Math.round(item.trainingSessionsCount || 1))) : 1;
    return sum + familyPlanAmount(item.membershipType, unitPrice * count);
  }, 0);
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
