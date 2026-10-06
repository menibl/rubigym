import test from 'node:test';
import assert from 'node:assert/strict';
import { updateTrainingCard } from '../shared/training-card.js';
import { clubArrivalChoices } from '../shared/club-check-in.js';

test('personal quantity adds only personal credit, preserving primary plan and payment state', () => {
  const user = { membershipType: 'GROUP_MONTHLY', membershipStatus: 'DEBT', membershipExpiry: '2026-11-01', personalTrainingRemaining: 2, personalTrainingCardSize: 10, duoTrainingRemaining: 4, punchCardRemaining: 7 };
  const next = updateTrainingCard(user, 'PERSONAL_TRAINING', '5');
  assert.equal(next.personalTrainingRemaining, 7); assert.equal(next.personalTrainingCardSize, 15);
  assert.equal(next.duoTrainingRemaining, 4); assert.equal(next.punchCardRemaining, 7);
  assert.equal(next.membershipType, 'GROUP_MONTHLY'); assert.equal(next.membershipStatus, 'DEBT');
  assert.equal(next.membershipExpiry, user.membershipExpiry);
  assert.deepEqual(next.secondaryMemberships, ['PERSONAL_TRAINING']);
  assert.equal(user.personalTrainingRemaining, 2);
});

test('duo and Open Gym balances are independent and do not duplicate secondary membership', () => {
  let user = updateTrainingCard({ membershipType: 'PERSONAL_TRAINING', personalTrainingRemaining: 8 }, 'DUO_TRAINING', 10);
  user = updateTrainingCard(user, 'DUO_TRAINING', 2);
  user = updateTrainingCard(user, 'OPEN_PUNCH_CARD', 5);
  assert.equal(user.personalTrainingRemaining, 8); assert.equal(user.duoTrainingRemaining, 12); assert.equal(user.punchCardRemaining, 5);
  assert.equal(user.membershipType, 'PERSONAL_TRAINING');
  assert.deepEqual(user.secondaryMemberships, ['DUO_TRAINING', 'OPEN_PUNCH_CARD']);
});

test('explicit set corrects remaining without shrinking purchased size; invalid quantities rejected', () => {
  assert.equal(updateTrainingCard({ personalTrainingCardSize: 10 }, 'PERSONAL_TRAINING', 0, 'SET').personalTrainingCardSize, 10);
  assert.equal(updateTrainingCard({}, 'PERSONAL_TRAINING', 5, 'SET').personalTrainingRemaining, 5);
  for (const quantity of ['', ' ', '2abc', -1, 0, 1.5, Infinity, 1001]) assert.throws(() => updateTrainingCard({}, 'DUO_TRAINING', quantity));
  assert.throws(() => updateTrainingCard({}, 'GROUP_MONTHLY', 1));
  assert.throws(() => updateTrainingCard({ personalTrainingRemaining: 1000 }, 'PERSONAL_TRAINING', 1));
});

test('generic Open Gym punch card never grants personal or duo scanner access', () => {
  const state = { users: [{ id: 'u', role: 'TRAINEE', membershipType: 'OPEN_PUNCH_CARD', membershipStatus: 'ACTIVE', membershipExpiry: '2026-11-01',
    healthDeclarationSigned: true, healthDeclarationDate: '2026-10-01', punchCardRemaining: 10 }], sessions: [], openGymSessions: [], attendanceLogs: [] };
  assert.deepEqual(clubArrivalChoices(state, 'u', Date.parse('2026-10-06T09:00:00Z')).map(c => c.trainingType), ['OPEN_GYM']);
});
