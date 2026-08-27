import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, isValidEmail, mergePayloadForUser, payloadForUser, verifyPassword } from './auth.js';

test('validates email addresses used as login identities', () => {
  assert.equal(isValidEmail('trainee@example.com'), true);
  assert.equal(isValidEmail(' Coach.Name+gym@Example.CO.IL '), true);
  assert.equal(isValidEmail('missing-at.example.com'), false);
  assert.equal(isValidEmail('missing-domain@'), false);
});

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

test('trainee can mark only received chat messages as read', () => {
  const current = {
    users: [{ id: 't1', role: 'TRAINEE', name: 'One' }, { id: 'm1', role: 'MANAGER', name: 'Manager' }],
    sessions: [], openGymSessions: [], attendanceLogs: [], traineeProfiles: [],
    messages: [
      { id: 'incoming', senderId: 'm1', receiverId: 't1', content: 'Hello', read: false },
      { id: 'outgoing', senderId: 't1', receiverId: 'm1', content: 'Hi', read: false }
    ]
  };
  const incoming = {
    ...current,
    messages: current.messages.map(message => ({ ...message, read: true }))
  };
  const merged = mergePayloadForUser(current, incoming, 't1', 'TRAINEE');
  assert.equal(merged.messages.find(message => message.id === 'incoming').read, true);
  assert.equal(merged.messages.find(message => message.id === 'outgoing').read, false);
});

test('family members are visible to each other and the payer can manage tracks and removal', () => {
  const payload = {
    users: [
      { id: 'payer', role: 'TRAINEE', name: 'Parent', familyId: 'family-1', isFamilyPayer: true, membershipType: 'FAMILY_MEMBERSHIP' },
      { id: 'child', role: 'TRAINEE', name: 'Child', familyId: 'family-1', familyPayerId: 'payer', membershipType: 'OPEN_GYM' },
      { id: 'other', role: 'TRAINEE', name: 'Other', familyId: 'family-2' }
    ],
    sessions: [], openGymSessions: [], workoutPlans: [], nutritionPlans: [], blackPoints: [], payments: [],
    messages: [], attendanceLogs: [], traineeProfiles: [], traineeMemoryEntries: [], discountCodes: []
  };
  const visible = payloadForUser(payload, 'payer', 'TRAINEE');
  assert.deepEqual(visible.users.map(user => user.id), ['payer', 'child']);
  const visibleToChild = payloadForUser(payload, 'child', 'TRAINEE');
  assert.deepEqual(visibleToChild.users.map(user => user.id), ['payer', 'child']);

  const changed = mergePayloadForUser(payload, {
    ...payload,
    users: [{ ...payload.users[0], membershipType: 'GROUP_ANNUAL' }, { ...payload.users[1], membershipType: 'GROUP_MONTHLY' }, payload.users[2]]
  }, 'payer', 'TRAINEE');
  assert.equal(changed.users.find(user => user.id === 'payer').membershipType, 'GROUP_ANNUAL');
  assert.equal(changed.users.find(user => user.id === 'child').membershipType, 'GROUP_MONTHLY');

  const removed = mergePayloadForUser(payload, { ...payload, users: [payload.users[0], payload.users[2]] }, 'payer', 'TRAINEE');
  assert.equal(removed.users.some(user => user.id === 'child'), false);
});

test('coach can persist only their own staff alert acknowledgements', () => {
  const current = {
    users: [
      { id: 'coach-1', role: 'COACH', name: 'Coach', staffAlertAcknowledgements: [] },
      { id: 'trainee-1', role: 'TRAINEE', name: 'Trainee' }
    ],
    sessions: [], openGymSessions: [], workoutPlans: [], nutritionPlans: [], blackPoints: [], announcements: [],
    messages: [], attendanceLogs: [], traineeProfiles: [], traineeMemoryEntries: [], gymEquipment: [],
    coachPdfDocuments: [], workoutAssistantMessages: [], workoutAssistantDrafts: [], groupWorkoutPrograms: []
  };
  const incoming = {
    ...current,
    users: [
      { ...current.users[0], name: 'Tampered', staffAlertAcknowledgements: ['purchase-1', 'chat-2', 'purchase-1', 7] },
      { ...current.users[1], name: 'Changed by coach' }
    ]
  };

  const merged = mergePayloadForUser(current, incoming, 'coach-1', 'COACH');
  assert.equal(merged.users[0].name, 'Coach');
  assert.deepEqual(merged.users[0].staffAlertAcknowledgements, ['purchase-1', 'chat-2']);
  assert.equal(merged.users[1].name, 'Trainee');
});
