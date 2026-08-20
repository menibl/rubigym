import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, mergePayloadForUser, payloadForUser, verifyPassword } from './auth.js';

test('password hashes verify without storing plaintext', async () => {
  const hash = await hashPassword('Strong-password-42');
  assert.equal(hash.includes('Strong-password-42'), false);
  assert.equal(await verifyPassword('Strong-password-42', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('trainee payload excludes other trainees private records', () => {
  const payload = {
    users: [
      { id: 't1', role: 'TRAINEE', name: 'One', email: 'one@example.com', password: 'secret' },
      { id: 't2', role: 'TRAINEE', name: 'Two', email: 'two@example.com' },
      { id: 'm1', role: 'MANAGER', name: 'Manager', email: 'manager@example.com' }
    ],
    workoutPlans: [{ id: 'w1', traineeId: 't1' }, { id: 'w2', traineeId: 't2' }],
    nutritionPlans: [], blackPoints: [], payments: [], messages: [], attendanceLogs: [],
    traineeProfiles: [], traineeMemoryEntries: [], discountCodes: []
  };
  const visible = payloadForUser(payload, 't1', 'TRAINEE');
  assert.deepEqual(visible.users.map(user => user.id), ['t1', 'm1']);
  assert.equal('password' in visible.users[0], false);
  assert.deepEqual(visible.workoutPlans.map(plan => plan.id), ['w1']);
  assert.equal(visible.users[1].email, '');
});

test('trainee can only change their own booking membership', () => {
  const current = {
    users: [{ id: 't1', role: 'TRAINEE', name: 'One' }, { id: 't2', role: 'TRAINEE', name: 'Two' }],
    sessions: [{ id: 's1', title: 'Original', registeredUsers: ['t2'], waitlistUsers: [] }],
    openGymSessions: [], messages: [], attendanceLogs: [], traineeProfiles: []
  };
  const incoming = {
    ...current,
    users: [{ id: 't1', role: 'MANAGER', name: 'Updated' }],
    sessions: [{ id: 's1', title: 'Tampered', registeredUsers: ['t1'], waitlistUsers: [] }]
  };
  const merged = mergePayloadForUser(current, incoming, 't1', 'TRAINEE');
  assert.equal(merged.users[0].role, 'TRAINEE');
  assert.equal(merged.users[0].name, 'Updated');
  assert.equal(merged.sessions[0].title, 'Original');
  assert.deepEqual(merged.sessions[0].registeredUsers.sort(), ['t1', 't2']);
});
