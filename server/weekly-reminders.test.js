import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyReminderSlot, weeklyMessages, sendWeeklyReminders } from './weekly-reminders.js';
const saturday = Date.parse('2026-10-03T17:00:00Z');
const sunday = Date.parse('2026-10-04T06:00:00Z');
const data = () => ({ users: [{ id: 'manager', role: 'MANAGER', name: 'מנהל' }, { id: 'trainee', role: 'TRAINEE', membershipStatus: 'ACTIVE', membershipExpiry: '2026-11-01', membershipType: 'GROUP_MONTHLY' }], messages: [], sessions: [] });
test('Israel summer and winter time, no early or late catchup', () => {
  assert.equal(weeklyReminderSlot(saturday).kind, 'saturday');
  assert.equal(weeklyReminderSlot(sunday).kind, 'sunday');
  assert.equal(weeklyReminderSlot(Date.parse('2026-11-07T18:00:00Z')).kind, 'saturday');
  assert.equal(weeklyReminderSlot(saturday - 1000), null);
  assert.equal(weeklyReminderSlot(saturday + 3600000), null);
});
test('one combined message with balances and action link', () => {
  const p = data();
  Object.assign(p.users[1], { secondaryMemberships: ['OPEN_GYM', 'PERSONAL_TRAINING'], personalTrainingRemaining: 4 });
  const messages = weeklyMessages(p, saturday);
  assert.equal(messages.length, 1);
  assert.match(messages[0].content, /4 אימונים אישיים/);
  assert.match(messages[0].content, /Open Gym/);
  assert.equal(messages[0].actionUrl, '?workspace=booking');
  assert.equal(weeklyMessages({ ...p, messages }, saturday).length, 0);
});
test('exclude unpaid, frozen, expired and empty personal cards', () => {
  for (const patch of [{ membershipStatus: 'DEBT' }, { isMembershipFrozen: true }, { membershipExpiry: '2026-10-02' }, { registrationIncomplete: true }, { familyPaymentPending: true }, { membershipType: 'PERSONAL_TRAINING', personalTrainingRemaining: 0 }]) {
    const p = data(); Object.assign(p.users[1], patch);
    assert.equal(weeklyMessages(p, saturday).length, 0);
  }
});
test('Sunday checks all seven days of group registrations, not personal, waitlist or past week', () => {
  for (const session of [
    { date: '2026-10-04', registeredUsers: ['trainee'] },
    { date: '2026-10-10', registeredUsers: ['trainee'] }
  ]) { const p = data(); p.sessions = [session]; assert.equal(weeklyMessages(p, sunday).length, 0); }
  for (const session of [
    { date: '2026-10-03', registeredUsers: ['trainee'] },
    { date: '2026-10-11', registeredUsers: ['trainee'] },
    { date: '2026-10-05', registeredUsers: ['trainee'], isPersonalTraining: true },
    { date: '2026-10-05', waitlistUsers: ['trainee'] }
  ]) { const p = data(); p.sessions = [session]; assert.equal(weeklyMessages(p, sunday).length, 1); }
  const p = data(); p.users[1].membershipType = 'OPEN_GYM'; assert.equal(weeklyMessages(p, sunday).length, 0);
});
test('CAS retries and restarts preserve one persisted message and one dispatch', async () => {
  let state = { revision: 1, payload: data() }; let conflict = true; let pushes = 0;
  const store = { getAllClubStates: async () => [{ club_id: 'club' }], getClubState: async () => structuredClone(state),
    putClubState: async (_id, payload, revision) => {
      if (conflict) { conflict = false; return { conflict: true }; }
      if (revision !== state.revision) return { conflict: true };
      state = { revision: revision + 1, payload }; return { conflict: false };
    } };
  await Promise.all([1, 2].map(() => sendWeeklyReminders(store, {}, async () => { pushes++; }, saturday)));
  await sendWeeklyReminders(store, {}, async () => { pushes++; }, saturday);
  assert.equal(state.payload.messages.length, 1); assert.equal(pushes, 1);
});
