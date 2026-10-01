import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.js';

test('standalone paid payer can add a pending member without changing the existing membership or payment', async () => {
  const payer = { id: 'payer', role: 'TRAINEE', name: 'Payer', membershipType: 'OPEN_GYM', membershipStatus: 'ACTIVE', membershipExpiry: '2027-10-01' };
  let state = { revision: 1, payload: { users: [payer], payments: [{ id: 'paid', amount: 280 }], messages: [] } };
  const store = {
    async getSession() { return { club_id: 'test', user_id: 'payer' }; },
    async getAccount() { return { user_id: 'payer', role: 'TRAINEE' }; },
    async getAccountByLogin() { return null; },
    async getAccountsByLogin() { return []; },
    async upsertAccount() {},
    async getClubState() { return state; },
    async putClubState(_club, payload, revision) { assert.equal(revision, state.revision); state = { payload, revision: revision + 1 }; return { conflict: false, revision: state.revision }; },
  };
  const response = await worker.fetch(new Request('https://baly.test/api/auth/family-members', {
    method: 'POST', headers: { Cookie: 'baly_session=test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: { id: 'child', name: 'Child', username: 'child', email: 'child@example.com', password: 'password-for-test', role: 'TRAINEE', familyId: 'fam-payer', familyPayerId: 'payer', membershipType: 'OPEN_GYM', membershipStatus: 'ACTIVE', nutritionPlanPaid: true, personalTrainingRemaining: 999 } }),
  }), { STATE_STORE: store, CLUB_ID: 'test' });
  assert.equal(response.status, 201);
  const child = state.payload.users.find(user => user.id === 'child');
  assert.equal(child.familyPaymentPending, true);
  assert.equal(child.membershipStatus, 'DEBT');
  assert.equal(child.personalTrainingRemaining, 0);
  assert.equal(child.nutritionPlanPaid, false);
  const updated = state.payload.users.find(user => user.id === 'payer');
  assert.equal(updated.membershipType, payer.membershipType);
  assert.equal(updated.membershipExpiry, payer.membershipExpiry);
  assert.equal(updated.membershipStatus, 'ACTIVE');
  assert.equal(updated.isFamilyPayer, true);
  assert.deepEqual(state.payload.payments, [{ id: 'paid', amount: 280 }]);
});
