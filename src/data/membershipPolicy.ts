import { MembershipPlanConfig, MembershipType, User } from '../types';
import { billingPeriodForPlan, membershipDurationMonthsForPlan } from './membershipBilling';

export const toLocalIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const addCalendarMonths = (date: Date, months: number) => {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
};

export const membershipDurationMonths = (type: MembershipType) => {
  if (type === MembershipType.GROUP_ANNUAL) return 12;
  if (type === MembershipType.DEDICATED_GROUP_HALF_YEAR) return 6;
  return 1;
};

export const createMembershipTerm = (type: MembershipType, startedAt = new Date(), plan?: MembershipPlanConfig) => {
  const months = plan ? membershipDurationMonthsForPlan(plan) : membershipDurationMonths(type);
  const startDate = toLocalIsoDate(startedAt);
  const endDate = toLocalIsoDate(addCalendarMonths(startedAt, months));
  const annualMonthlyCommitment = plan
    ? billingPeriodForPlan(plan) === 'MONTHLY_ANNUAL_COMMITMENT'
    : type === MembershipType.GROUP_ANNUAL;
  const recurringMonthly = plan ? billingPeriodForPlan(plan) === 'MONTHLY' || annualMonthlyCommitment : annualMonthlyCommitment;
  return {
    membershipStartedAt: startDate,
    membershipExpiry: endDate,
    membershipCommitmentEndsAt: annualMonthlyCommitment ? endDate : undefined,
    recurringBillingMonths: recurringMonthly ? (annualMonthlyCommitment ? 12 : 0) : undefined,
    monthlyBillingDay: recurringMonthly ? startedAt.getDate() : undefined
  };
};

export const isMembershipFreezeActive = (user: User, now = new Date()) => Boolean(
  user.isMembershipFrozen
  && (!user.membershipFrozenUntil || user.membershipFrozenUntil >= toLocalIsoDate(now))
);

export const canUseAnnualFreeze = (user: User, now = new Date()) => {
  if (isMembershipFreezeActive(user, now)) return false;
  if (!user.membershipFreezeUsedAt) return true;
  const nextAvailable = new Date(`${user.membershipFreezeUsedAt}T00:00:00`);
  nextAvailable.setFullYear(nextAvailable.getFullYear() + 1);
  return now >= nextAvailable;
};

export const isMembershipCancellationEffective = (user: User, now = new Date()) => Boolean(
  user.cancellationEffectiveDate && user.cancellationEffectiveDate <= toLocalIsoDate(now)
);
