// Included access is an entitlement, not a separate purchase or punch-card debit.
// Payment, expiry, freeze and health checks remain mandatory at booking time.
const includedMemberships = new Set([
  'OPEN_GYM', 'OPEN_GYM_WITH_PLAN', 'OPEN_MONTHLY', 'OPEN_ANNUAL',
  'CORE_GROUPS', 'GROUP_MONTHLY', 'GROUP_ANNUAL',
  'YOUTH_ONCE_WEEKLY', 'YOUTH_TWICE_WEEKLY', 'DEDICATED_GROUP_HALF_YEAR',
  'WEIGHT_LOSS_HALF_YEAR', 'POSTPARTUM_HALF_YEAR', 'FAMILY_MEMBERSHIP',
]);

/** @param {Array<string | null | undefined>} memberships */
export const hasIncludedOpenGymAccess = (memberships) =>
  memberships.some(type => includedMemberships.has(type));
