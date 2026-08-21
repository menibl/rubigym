import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';

test('family registration creates separate login accounts without storing plaintext passwords', async () => {
  let state = { payload: { users: [], payments: [] }, revision: 1 };
  const accounts = [];
  const store = {
    async getAccountByLogin() { return null; },
    async getClubState() { return state; },
    async putClubState(_clubId, payload, expectedRevision) {
      assert.equal(expectedRevision, state.revision);
      state = { payload, revision: state.revision + 1 };
      return { conflict: false, revision: state.revision };
    },
    async upsertAccount(account) { accounts.push(account); },
    async createSession() {}
  };
  const payer = {
    id: 'payer-1', name: 'Parent', username: 'parent', email: 'parent@example.com', phone: '0500000001',
    password: 'parent-password', role: 'TRAINEE', isFamilyPayer: true, familyId: 'family-1', familyMembersCount: 2
  };
  const member = {
    id: 'member-1', name: 'Child', username: 'child', email: 'child@example.com', phone: '',
    password: 'child-password', role: 'TRAINEE', familyPayerId: payer.id, familyId: payer.familyId
  };

  const response = await worker.fetch(new Request('https://balywellness.test/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: payer, familyUsers: [member], payment: { id: 'payment-1', status: 'PAID' } })
  }), { STATE_STORE: store, CLUB_ID: 'test-club' });

  assert.equal(response.status, 201);
  assert.equal(state.payload.users.length, 2);
  assert.equal(accounts.length, 2);
  assert.equal(state.payload.users.some(user => 'password' in user), false);
  assert.equal(accounts.every(account => account.passwordHash && !account.passwordHash.includes('password')), true);
});
