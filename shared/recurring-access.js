import { hasIncludedOpenGymAccess } from './open-gym-access.js';

const todayAtClub = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const membershipTypesForAccess = (user, date = todayAtClub()) => [user?.membershipType, ...(user?.secondaryMemberships || [])]
  .filter(type => type && user?.recurringMemberships?.[type]?.status !== 'PAYMENT_FAILED'
    && (!user?.recurringMemberships?.[type]?.endsAt || user.recurringMemberships[type].endsAt > date));

export const recurringAccessUntil = (user, date) => membershipTypesForAccess(user, date).map(type => user?.recurringMemberships?.[type])
  .filter(contract => ['PENDING_FIRST_CHARGE', 'ACTIVE'].includes(contract?.status) && /^\d{4}-\d{2}-\d{2}$/.test(contract.endsAt) && contract.endsAt > date)
  .map(contract => contract.endsAt).sort().at(-1);

export const unaffectedAccessUntil = (user, date) => {
  const primary = user?.recurringMemberships?.[user?.membershipType];
  if (!primary || (primary.status !== 'PAYMENT_FAILED' && primary.endsAt > date)) return undefined;
  return membershipTypesForAccess(user, date).map(type => user?.membershipPlanExpiries?.[type])
    .filter(expiry => /^\d{4}-\d{2}-\d{2}$/.test(expiry) && expiry > date).sort().at(-1);
};

export function recurringSessionBlocked(user, session) {
  if (!Object.values(user?.recurringMemberships || {}).some(contract => contract?.status === 'PAYMENT_FAILED' || contract?.endsAt <= todayAtClub())) return false;
  const types = membershipTypesForAccess(user);
  if (session.timeSlot) return !hasIncludedOpenGymAccess(types) && !types.includes('OPEN_PUNCH_CARD');
  if (session.isPersonalTraining) return !types.some(type => ['PERSONAL_TRAINING', 'DUO_TRAINING'].includes(type));
  const normalize = type => ['CORE_GROUPS', 'GROUP_MONTHLY', 'GROUP_ANNUAL'].includes(type) ? 'CORE_GROUPS' : type;
  const groups = ['CORE_GROUPS', 'GROUP_MONTHLY', 'GROUP_ANNUAL', 'FAMILY_MEMBERSHIP', 'YOUTH_ONCE_WEEKLY', 'YOUTH_TWICE_WEEKLY', 'DEDICATED_GROUP_HALF_YEAR', 'WEIGHT_LOSS_HALF_YEAR', 'POSTPARTUM_HALF_YEAR'];
  return !types.some(type => groups.includes(type) && (!session.allowedMemberships?.length || session.allowedMemberships.some(allowed => normalize(allowed) === normalize(type))));
}
