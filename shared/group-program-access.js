import { fitsSessionAge } from './youth-session.js';

const groups = new Set(['CORE_GROUPS', 'GROUP_MONTHLY', 'GROUP_ANNUAL', 'YOUTH_ONCE_WEEKLY', 'YOUTH_TWICE_WEEKLY', 'DEDICATED_GROUP_HALF_YEAR', 'WEIGHT_LOSS_HALF_YEAR', 'POSTPARTUM_HALF_YEAR']);
const normalize = type => ['CORE_GROUPS', 'GROUP_MONTHLY', 'GROUP_ANNUAL'].includes(type) ? 'CORE_GROUPS' : type;
export function eligibleGroupSession(user, session) {
  const memberships = [user?.membershipType, ...(user?.secondaryMemberships || [])];
  return Boolean(user && !session.isPersonalTraining && memberships.some(type => groups.has(type))
    && fitsSessionAge(session, user)
    && (!session.genderRestriction || session.genderRestriction === 'ALL' || session.genderRestriction === user.gender)
    && session.allowedMemberships?.some(type => memberships.some(own => normalize(own) === normalize(type))));
}

// Previous session is the same named group as the next one, when available.
// Do not skip an unassigned session in favor of an older, unrelated program.
export function homeGroupSessions(user, sessions, now = Date.now()) {
  const eligible = sessions.filter(session => eligibleGroupSession(user, session))
    .filter(session => Number.isFinite(new Date(`${session.date}T${session.time || '00:00'}:00`).getTime()))
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const future = eligible.filter(session => new Date(`${session.date}T${session.time || '00:00'}:00`).getTime() >= now);
  const next = future.find(session => session.registeredUsers?.includes(user.id)) || future[0];
  const past = eligible.filter(session => new Date(`${session.date}T${session.time || '00:00'}:00`).getTime() < now);
  const previous = (next ? past.filter(session => session.title === next.title) : past).at(-1) || past.at(-1);
  return { next, previous };
}
