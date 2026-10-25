import test from 'node:test';
import assert from 'node:assert/strict';
import { homeGroupSessions } from '../shared/group-program-access.js';
import { payloadForUser } from './auth.js';
const user = { id: 'u', role: 'TRAINEE', gender: 'MALE', age: 30, membershipType: 'GROUP_MONTHLY' };
const session = (id, date, extra = {}) => ({ id, date, time: '19:00', title: 'קבוצת בנים', genderRestriction: 'MALE', allowedMemberships: ['CORE_GROUPS'], registeredUsers: [], ...extra });
test('previous and next group programs do not require registration and preserve age/gender/plan boundaries', () => {
  const sessions = [session('previous', '2026-10-06'), session('next', '2026-10-08'), session('older', '2026-10-05'), session('female', '2026-10-07', { genderRestriction: 'FEMALE' }), session('youth', '2026-10-07', { title: 'נוער', ageMax: 18 }), session('personal', '2026-10-07', { isPersonalTraining: true })];
  const selected = homeGroupSessions(user, sessions, new Date('2026-10-07T12:00:00').getTime());
  assert.equal(selected.next.id, 'next'); assert.equal(selected.previous.id, 'previous');
  assert.deepEqual(homeGroupSessions({ ...user, membershipType: 'OPEN_GYM' }, sessions), { next: undefined, previous: undefined });
});
test('nearest eligible group anchors previous matching group even when registered for a later group', () => {
  const result = homeGroupSessions(user, [session('old-a', '2026-10-04'), session('old-b', '2026-10-06', { title: 'אחרת' }), session('next-a', '2026-10-09', { registeredUsers: ['u'] }), session('near-b', '2026-10-08', { title: 'אחרת' })], new Date('2026-10-07').getTime());
  assert.equal(result.next.id, 'near-b'); assert.equal(result.previous.id, 'old-b');
});

test('server includes today unbooked group program alongside tomorrow booked program without exposing unrelated programs', t => {
  t.mock.method(Date, 'now', () => new Date('2026-10-25T10:00:00').getTime());
  const member = { ...user, gender: 'FEMALE', age: 55 };
  const group = (id, date, extra = {}) => session(id, date, { time: '18:00', title: 'קבוצת נשים', genderRestriction: 'FEMALE', assignedGroupWorkoutProgramId: `program-${id}`, ...extra });
  const sessions = [
    group('previous', '2026-10-21'),
    group('today', '2026-10-25'),
    group('tomorrow', '2026-10-26', { registeredUsers: ['u'] }),
    group('male', '2026-10-25', { time: '11:00', genderRestriction: 'MALE' }),
    group('youth', '2026-10-25', { time: '12:00', ageMax: 18 }),
    group('personal', '2026-10-25', { time: '13:00', isPersonalTraining: true }),
    group('unrelated', '2026-10-27'),
  ];
  const safe = payloadForUser({ users: [member], sessions, groupWorkoutPrograms: sessions.map(s => ({ id: s.assignedGroupWorkoutProgramId })), workoutPlans: [] }, 'u', 'TRAINEE');
  assert.deepEqual(safe.groupWorkoutPrograms.map(plan => plan.id), ['program-previous', 'program-today', 'program-tomorrow']);
  assert.deepEqual(sessions.find(s => s.id === 'today').registeredUsers, []);
});
test('server returns only home group programs plus registered programs, no unrelated personal or library plan', () => {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const payload = { users: [user], sessions: [session('past', yesterday, { assignedGroupWorkoutProgramId: 'assigned' }), session('future', tomorrow)], groupWorkoutPrograms: [{ id: 'assigned' }, { id: 'legacy', sessionId: 'future' }, { id: 'library' }], workoutPlans: [{ id: 'private', sessionId: 'future', traineeId: 'other' }] };
  const safe = payloadForUser(payload, 'u', 'TRAINEE');
  assert.deepEqual(safe.groupWorkoutPrograms.map(plan => plan.id), ['assigned', 'legacy']);
  assert.equal(safe.workoutPlans.length, 0);
});
