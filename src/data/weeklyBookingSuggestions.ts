import { TrainingSession, User, MembershipType } from '../types';
import { clubDate } from '../../shared/membership-calendar.js';
import { membershipBookingCategory } from './traineeBookingFilter';
import { isYouthSession } from '../../shared/youth-session.js';

export function clubBookingWeek(now = new Date()) {
  const today = clubDate(now);
  const midnight = new Date(`${today}T00:00:00Z`);
  const elapsed = (midnight.getUTCDay() + 1) % 7;
  const start = new Date(midnight.getTime() - elapsed * 86400000);
  const end = new Date(start.getTime() + 6 * 86400000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), today };
}

export function weeklyBookingSuggestions(sessions: TrainingSession[], user: User,
  eligible: (session: TrainingSession) => boolean, now = new Date()) {
  const categories = [user.membershipType, ...(user.secondaryMemberships || [])].map(membershipBookingCategory);
  if (!categories.some(category => category === 'GROUP' || category === 'PERSONAL')) return [];
  const { today, end } = clubBookingWeek(now);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const youth = [MembershipType.YOUTH_ONCE_WEEKLY, MembershipType.YOUTH_TWICE_WEEKLY].includes(user.membershipType);
  return sessions.filter(session => session.date >= today && session.date <= end
    && (session.date > today || session.time > time)
    && !(session.excludedDates || []).includes(session.date)
    && (!youth || isYouthSession(session))
    && !session.registeredUsers.includes(user.id) && !session.waitlistUsers.includes(user.id)
    && (session.isPersonalTraining ? categories.includes('PERSONAL') : categories.includes('GROUP'))
    && eligible(session))
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}
