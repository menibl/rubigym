import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthenticatedSession } from './auth.js';
import worker from './index.js';

const createFixture = async payment => {
  let state = { payload: { users: [], payments: [payment] }, revision: 1 };
  const sessions = new Map();
  const store = {
    async createSession(tokenHash, clubId, userId, expiresAt) { sessions.set(tokenHash, { club_id: clubId, user_id: userId, expires_at: expiresAt }); },
    async getSession(tokenHash) { return sessions.get(tokenHash); },
    async getAccount() { return { user_id: 'manager-1', role: 'MANAGER', login: 'robi', profile: { name: 'רובי באלי' } }; },
    async getClubState() { return state; },
    async putClubState(_clubId, payload, expectedRevision) {
      if (expectedRevision !== state.revision) return { conflict: true, revision: state.revision };
      state = { payload, revision: state.revision + 1 };
      return { conflict: false, revision: state.revision };
    }
  };
  const auth = await createAuthenticatedSession(store, 'test-club', 'manager-1');
  return { store, cookie: auth.cookie, state: () => state };
};

const baseEnv = store => ({
  STATE_STORE: store,
  CLUB_ID: 'test-club',
  RIVHIT_ENVIRONMENT: 'test',
  RIVHIT_GROUP_PRIVATE_TOKEN: 'test-token',
  PAYMENT_SIGNING_SECRET: 'test-signing-secret',
  PUBLIC_APP_URL: 'https://balywellness.test/'
});

test('manager full refund is confirmed by RIVHIT before updating the payment ledger', async () => {
  const fixture = await createFixture({ id: 'payment-1', status: 'PAID', amount: 350, providerSaleId: 'sale-1' });
  let requestBody;
  const env = { ...baseEnv(fixture.store), RIVHIT_FETCH: async (url, init) => {
    assert.match(url, /\/CancelSale$/);
    requestBody = JSON.parse(init.body);
    return Response.json({ Status: 0, data: { DocumentLink: 'https://example.test/refund.pdf' } });
  } };
  const response = await worker.fetch(new Request('https://balywellness.test/api/payments/rivhit/admin/refund', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: fixture.cookie }, body: JSON.stringify({ paymentId: 'payment-1', reason: 'רכישה שגויה' })
  }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(requestBody, { SaleId: 'sale-1' });
  assert.equal(fixture.state().payload.payments[0].status, 'REFUNDED');
  assert.equal(fixture.state().payload.payments[0].refundedBy, 'רובי באלי');
});

test('manager can update a recurring amount only when a provider recurring id exists', async () => {
  const fixture = await createFixture({ id: 'payment-2', status: 'PAID', amount: 500, providerRecurringSaleId: 'recurring-1' });
  let requestBody;
  const env = { ...baseEnv(fixture.store), RIVHIT_FETCH: async (url, init) => {
    assert.match(url, /\/RecurringSaleUpdateItems$/);
    requestBody = JSON.parse(init.body);
    return Response.json({ Status: 0 });
  } };
  const response = await worker.fetch(new Request('https://balywellness.test/api/payments/rivhit/admin/update-recurring', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: fixture.cookie }, body: JSON.stringify({ paymentId: 'payment-2', amount: 600, reason: 'מעבר למסלול חודשי' })
  }), env);
  assert.equal(response.status, 200);
  assert.equal(requestBody.RecurringSaleId, 'recurring-1');
  assert.equal(requestBody.items[0].UnitPrice, 600);
  assert.equal(fixture.state().payload.payments[0].recurringAmount, 600);
});
