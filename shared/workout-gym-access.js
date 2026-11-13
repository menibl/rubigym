import { clubDate } from './membership-calendar.js';
import { hasIncludedOpenGymAccess } from './open-gym-access.js';
import { paymentPending } from './registration-status.js';

// A program purchase is not a gym-entry membership. Check the gym plan's own
// expiry, never the later expiry of an unrelated nutrition/workout add-on.
export function hasActiveWorkoutGymMembership(user, now = new Date()) {
  const today = clubDate(now);
  if (!user || user.registrationIncomplete || paymentPending(user)
    || (user.isMembershipFrozen && (!user.membershipFrozenUntil || user.membershipFrozenUntil >= today))
    || (user.cancellationEffectiveDate && user.cancellationEffectiveDate <= today)) return false;
  return [user.membershipType, ...(user.secondaryMemberships || [])].some(type => {
    if (!hasIncludedOpenGymAccess([type])) return false;
    const contract = user.recurringMemberships?.[type];
    if (contract?.cancelledAt || contract?.status === 'PAYMENT_FAILED') return false;
    if (contract) return ['ACTIVE', 'PENDING_FIRST_CHARGE'].includes(contract.status) && contract.endsAt > today;
    if (user.membershipStatus !== 'ACTIVE' && !user.offlinePaymentApproved) return false;
    const primary = type === user.membershipType;
    const ownExpiry = primary ? undefined : user.membershipPlanExpiries?.[type];
    const expiry = ownExpiry || ((primary || hasIncludedOpenGymAccess([user.membershipType])) ? user.membershipExpiry : undefined);
    const expiryTime = Date.parse(`${expiry}T00:00:00Z`);
    if (typeof expiry !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expiry) || !Number.isFinite(expiryTime)
      || new Date(expiryTime).toISOString().slice(0, 10) !== expiry) return false;
    return primary && !ownExpiry && !user.membershipExpiryExclusive ? expiry >= today : expiry > today;
  });
}

// Buying the required gym membership must not discard a previously paid
// standalone workout-plan entitlement when it used to be the primary plan.
export function preservePaidWorkoutPlan(user, newPrimary, now = new Date()) {
  if (!['WORKOUT_COACHING', 'WORKOUT_PLAN'].includes(user?.membershipType)
    || !hasIncludedOpenGymAccess([newPrimary]) || (user.membershipStatus !== 'ACTIVE' && !user.offlinePaymentApproved)
    || !user.membershipExpiry || user.membershipExpiry < clubDate(now)) return {};
  return { secondaryMemberships: [...new Set([...(user.secondaryMemberships || []), user.membershipType])],
    membershipPlanExpiries: { ...user.membershipPlanExpiries, [user.membershipType]: user.membershipExpiry } };
}
