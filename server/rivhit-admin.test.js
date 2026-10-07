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

test('manager can safely enrich a historical provider alias without any charge, refund or entitlement changes', async () => {
  const fixture = await createFixture({ id: 'payment-rivhit-old', traineeId: 'trainee', amount: 280, isMock: true, status: 'PAID', paymentMethod: 'RIVHIT iCredit' });
  let signedOrder;
  const calls = [];
  const env = { ...baseEnv(fixture.store), RIVHIT_FETCH: async (url, init) => {
    calls.push(url.split('/').at(-1));
    if (url.endsWith('/GetUrl')) { signedOrder = JSON.parse(init.body).Custom1; return Response.json({ Status: 0, URL: 'https://testicredit.rivhit.co.il/pay', PrivateSaleToken: 'fixture-private' }); }
    if (url.endsWith('/SaleDetails')) return Response.json({ Status: 0, data: [{ SaleId: 'canonical-sale', CustomerTransactionId: 'canonical-transaction', Amount: 1, TransactionCardNum: '****2016', Custom1: signedOrder }] });
    if (url.endsWith('/Verify')) return Response.json({ Status: 'VERIFIED' });
    throw new Error('Unexpected financial operation');
  } };
  await worker.fetch(new Request('https://balywellness.test/api/payments/rivhit/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'trainee', userName: 'Test', membershipType: 'OPEN_GYM', mode: 'REGISTRATION' }) }), env);
  calls.length = 0;
  const response = await worker.fetch(new Request('https://balywellness.test/api/payments/rivhit/admin/reconcile', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: fixture.cookie }, body: JSON.stringify({ paymentId: 'payment-rivhit-old' }) }), env);
  assert.equal(response.status, 200);
  const payment = (await response.json()).payment;
  assert.equal(payment.providerSaleId, 'canonical-sale'); assert.match(payment.paymentMethod, /2016/);
  assert.equal(payment.providerTransactionId, 'canonical-transaction');
  assert.equal(payment.amount, 280); assert.equal(payment.status, 'PAID');
  assert.deepEqual(calls, ['SaleDetails', 'Verify']); assert.equal(fixture.state().payload.payments.length, 1);
  assert.deepEqual(fixture.state().payload.users, []);
});

test('reconciliation requires a manager, and unverifiable historical records are not changed', async () => {
  const fixture = await createFixture({ id: 'payment-rivhit-old', traineeId: 'trainee', amount: 280, isMock: true, status: 'PAID' });
  const env = { ...baseEnv(fixture.store), RIVHIT_FETCH: async () => Response.json({ Status: 0, data: [{ SaleId: 'sale', Amount: 1 }] }) };
  const request = cookie => new Request('https://balywellness.test/api/payments/rivhit/admin/reconcile', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify({ paymentId: 'payment-rivhit-old' }) });
  assert.equal((await worker.fetch(request(), env)).status, 403);
  assert.equal((await worker.fetch(request(fixture.cookie), env)).status, 422);
  assert.equal(fixture.state().revision, 1);
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
  assert.equal(requestBody.items[0].Name, 'ייעוץ ואימון');
  assert.equal(fixture.state().payload.payments[0].recurringAmount, 600);
});
