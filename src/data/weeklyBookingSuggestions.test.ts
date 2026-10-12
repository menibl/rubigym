import test from 'node:test';
import assert from 'node:assert/strict';
import { clubBookingWeek, weeklyBookingSuggestions } from './weeklyBookingSuggestions';
import { MembershipType, TrainingSession, User } from '../types';

const now = new Date('2026-10-12T09:00:00Z');
const user = { id: 'u', membershipType: MembershipType.GROUP_MONTHLY } as User;
const session = (id: string, patch: Partial<TrainingSession> = {}) => ({ id, title: 'קבוצה', date: '2026-10-12', time: '19:00', registeredUsers: [], waitlistUsers: [], maxParticipants: 12, ...patch }) as TrainingSession;

test('club week is Saturday-Friday and resets at Jerusalem midnight on Saturday', () => {
  assert.deepEqual(clubBookingWeek(now), { today: '2026-10-12', start: '2026-10-10', end: '2026-10-16' });
  assert.equal(clubBookingWeek(new Date('2026-10-16T21:30:00Z')).start, '2026-10-17');
  assert.equal(clubBookingWeek(new Date('2026-10-16T21:30:00Z')).end, '2026-10-23');
});
test('only future, unbooked, nonexcluded eligible sessions through Friday are proposed', () => {
  const rows = [session('good'), session('past', { time: '10:00' }), session('next-week', { date: '2026-10-17' }),
    session('friday', { date: '2026-10-16' }), session('booked', { registeredUsers: ['u'] }),
    session('waiting', { waitlistUsers: ['u'] }), session('excluded', { excludedDates: ['2026-10-12'] }), session('denied')];
  assert.deepEqual(weeklyBookingSuggestions(rows, user, row => row.id !== 'denied', now).map(row => row.id), ['good', 'friday']);
});
test('Open-only users get no popup; personal/group combinations never include Open slots', () => {
  assert.deepEqual(weeklyBookingSuggestions([session('g')], { ...user, membershipType: MembershipType.OPEN_GYM }, () => true, now), []);
  const mixed = { ...user, membershipType: MembershipType.OPEN_GYM, secondaryMemberships: [MembershipType.PERSONAL_TRAINING] };
  assert.deepEqual(weeklyBookingSuggestions([session('g'), session('p', { isPersonalTraining: true })], mixed, () => true, now).map(row => row.id), ['p']);
});
test('youth sees only youth sessions; age/gender/membership are delegated to booking eligibility', () => {
  const youth = { ...user, membershipType: MembershipType.YOUTH_ONCE_WEEKLY };
  const rows = [session('adult'), session('boys', { title: 'נוער בנים' }), session('girls', { title: 'נוער בנות' })];
  const seen: string[] = [];
  assert.deepEqual(weeklyBookingSuggestions(rows, youth, row => { seen.push(row.id); return row.id === 'girls'; }, now).map(row => row.id), ['girls']);
  assert.deepEqual(seen, ['boys', 'girls']);
});
