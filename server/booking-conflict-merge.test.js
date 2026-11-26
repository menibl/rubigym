import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeBookingCollectionById, rebaseClubStateAfterConflict } from '../src/data/clubStateMerge.js';
import { mergePayloadForUser } from './auth.js';

const slot = (overrides = {}) => ({ id: 'friday', date: '2026-11-27', timeSlot: '07:00-08:00', maxParticipants: 15,
  registeredUsers: ['existing'], waitlistUsers: [], ...overrides });
const merge = (base, local, remote) => mergeBookingCollectionById([base], [local], [remote])[0];

test('stale staff metadata edit retains remote registrations and waitlist', () => {
  const base = slot();
  const local = { ...base, maxParticipants: 20 };
  const remote = slot({ registeredUsers: ['existing', 'tal', 'haviva'], waitlistUsers: ['waiting'] });
  const result = merge(base, local, remote);
  assert.deepEqual(result.registeredUsers, remote.registeredUsers);
  assert.deepEqual(result.waitlistUsers, remote.waitlistUsers);
  assert.equal(result.maxParticipants, 20);
  assert.deepEqual(base.registeredUsers, ['existing']);
});

test('two concurrent registrations are combined without duplicate users', () => {
  const base = slot();
  const local = slot({ registeredUsers: ['existing', 'local'] });
  const remote = slot({ registeredUsers: ['existing', 'remote'] });
  assert.deepEqual(merge(base, local, remote).registeredUsers, ['existing', 'remote', 'local']);
  assert.deepEqual(merge(base, local, local).registeredUsers, ['existing', 'local']);
});

test('explicit local cancellation does not erase someone else joining remotely', () => {
  const base = slot();
  assert.deepEqual(merge(base, slot({ registeredUsers: [] }), slot({ registeredUsers: ['existing', 'new'] })).registeredUsers, ['new']);
});

test('remote cancellation is never resurrected by an unrelated local registration', () => {
  const base = slot();
  assert.deepEqual(merge(base, slot({ registeredUsers: ['existing', 'new'] }), slot({ registeredUsers: [] })).registeredUsers, ['new']);
});

test('concurrent waitlist joins preserve server queue order', () => {
  const base = slot({ waitlistUsers: ['first'] });
  const local = { ...base, waitlistUsers: ['first', 'local'] };
  const remote = { ...base, waitlistUsers: ['first', 'remote'] };
  assert.deepEqual(merge(base, local, remote).waitlistUsers, ['first', 'remote', 'local']);
});

test('promotion and a different trainee joining are independent', () => {
  const base = slot({ waitlistUsers: ['promoted'] });
  const local = slot({ registeredUsers: ['existing', 'promoted'] });
  const remote = { ...base, waitlistUsers: ['promoted', 'new'] };
  const result = merge(base, local, remote);
  assert.deepEqual(result.registeredUsers, ['existing', 'promoted']);
  assert.deepEqual(result.waitlistUsers, ['new']);
});

test('conflicting transitions of the same trainee preserve authoritative server decision', () => {
  const base = slot({ waitlistUsers: ['same'] });
  const promoted = slot({ registeredUsers: ['existing', 'same'] });
  const cancelled = slot();
  assert.equal(merge(base, promoted, cancelled).registeredUsers.includes('same'), false);
  const result = merge(slot(), slot({ registeredUsers: ['existing', 'same'] }), slot({ waitlistUsers: ['same'] }));
  assert.equal(result.registeredUsers.includes('same'), false);
  assert.deepEqual(result.waitlistUsers, ['same']);
});

test('deleted remote slot cannot be recreated by stale booking; remote additions survive', () => {
  const base = slot();
  const added = slot({ id: 'new-slot' });
  assert.deepEqual(mergeBookingCollectionById([base], [slot({ registeredUsers: ['existing', 'new'] })], [added]), [added]);
  assert.deepEqual(mergeBookingCollectionById([base], [], [base]), []);
});

test('new same-ID occurrence on both devices retains both participants', () => {
  assert.deepEqual(mergeBookingCollectionById([], [slot({ registeredUsers: ['local'] })], [slot({ registeredUsers: ['remote'] })])[0].registeredUsers, ['remote', 'local']);
});

test('concurrent excluded-date changes combine without reviving cancelled occurrences', () => {
  const base = slot({ excludedDates: ['2026-11-13'] });
  assert.deepEqual(merge(base, { ...base, excludedDates: ['2026-11-13', '2026-11-20'] },
    { ...base, excludedDates: ['2026-11-13', '2026-11-27'] }).excludedDates, ['2026-11-13', '2026-11-27', '2026-11-20']);
});

test('last-place conflict refuses overbooking rather than modifying accepted bookings', () => {
  const base = slot({ maxParticipants: 2 });
  const remote = { ...base, registeredUsers: ['existing', 'accepted'] };
  assert.throws(() => merge(base, { ...base, registeredUsers: ['existing', 'local'] }, remote), /BOOKING_CAPACITY_CONFLICT/);
  assert.deepEqual(remote.registeredUsers, ['existing', 'accepted']);
});

test('metadata-only save of an already over-capacity slot preserves accepted users', () => {
  const base = slot({ maxParticipants: 1, registeredUsers: ['existing', 'accepted'] });
  assert.deepEqual(merge(base, { ...base, note: 'edit' }, base).registeredUsers, base.registeredUsers);
});

test('zero capacity and remotely moved occurrences never receive stale bookings', () => {
  const base = slot({ registeredUsers: [] });
  assert.throws(() => merge(base, slot({ registeredUsers: ['new'] }), { ...base, maxParticipants: 0 }), /BOOKING_CAPACITY_CONFLICT/);
  assert.throws(() => merge(base, slot({ registeredUsers: ['new'] }), { ...base, date: '2026-12-04' }), /BOOKING_OCCURRENCE_CONFLICT/);
  assert.throws(() => merge(base, slot({ registeredUsers: ['new'] }), { ...base, timeSlot: '08:00-09:00' }), /BOOKING_OCCURRENCE_CONFLICT/);
});

test('manager retry and next unrelated save retain merged group and Open Gym bookings', () => {
  const group = { ...slot(), id: 'group', time: '07:00', title: 'Group', isPersonalTraining: false };
  const base = { users: [], payments: [], messages: [], sessions: [group], openGymSessions: [slot()] };
  const local = structuredClone(base);
  local.sessions[0].registeredUsers.push('local');
  const remote = structuredClone(base);
  remote.openGymSessions[0].registeredUsers.push('tal', 'haviva');
  remote.sessions[0].registeredUsers.push('remote');
  const rebased = rebaseClubStateAfterConflict(base, local, remote);
  const saved = mergePayloadForUser(remote, rebased, 'manager', 'MANAGER');
  assert.deepEqual(saved.openGymSessions[0].registeredUsers, ['existing', 'tal', 'haviva']);
  assert.deepEqual(saved.sessions[0].registeredUsers, ['existing', 'remote', 'local']);
  const adoptedUI = structuredClone(rebased);
  adoptedUI.sessions[0].note = 'later metadata edit';
  assert.deepEqual(mergePayloadForUser(saved, adoptedUI, 'manager', 'MANAGER').openGymSessions, saved.openGymSessions);
});

test('multiple conflicts preserve participants from every revision', () => {
  const base = { users: [], payments: [], messages: [], sessions: [], openGymSessions: [slot()] };
  const local = structuredClone(base); local.openGymSessions[0].registeredUsers.push('local');
  const remote1 = structuredClone(base); remote1.openGymSessions[0].registeredUsers.push('remote1');
  const retry1 = rebaseClubStateAfterConflict(base, local, remote1);
  const remote2 = structuredClone(remote1); remote2.openGymSessions[0].registeredUsers.push('remote2');
  assert.deepEqual(rebaseClubStateAfterConflict(remote1, retry1, remote2).openGymSessions[0].registeredUsers,
    ['existing', 'remote1', 'remote2', 'local']);
});

test('retry reads edits after fetch, adopts booking UI, and polling respects debounce', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /const latest = await getClubState\(\);\s*\/\/[^\n]*\s*const retryPayload = localClubStateRef.current/);
  assert.match(app, /setSessions\(rebased.sessions as TrainingSession\[\]\)/);
  assert.match(app, /setOpenGymSessions\(rebased.openGymSessions as OpenGymSession\[\]\)/);
  assert.match(app, /setUsers\(rebased.users as User\[\]\)/);
  assert.match(app, /setPayments\(rebased.payments as Payment\[\]\)/);
  assert.match(app, /setMessages\(rebased.messages as Message\[\]\)/);
  assert.match(app, /localEditsPendingRef.current = true;\s*const timer = window.setTimeout/);
  assert.match(app, /&& !localEditsPendingRef.current/);
  assert.match(app, /editVersion === localEditVersionRef.current/);
  assert.match(app, /pendingClubStateRef.current = null;\s*applyServerPayload\(latest.payload, latest.revision\);[\s\S]*?break;/);
});
