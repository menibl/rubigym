import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthenticatedSession } from './auth.js';
import worker from './index.js';

const rivhitFetch = async (url, init) => {
  const body = JSON.parse(init.body);
  if (url.endsWith('/GetUrl')) return Response.json({
    Status: 0,
    URL: 'https://testicredit.rivhit.co.il/payment/test',
    PrivateSaleToken: 'private-sale-token',
    PublicSaleToken: 'public-sale-token'
  });
  if (url.endsWith('/SaleDetails')) return Response.json({
    Status: 0,
    data: [{ SaleId: 'sale-1', TransactionId: 'transaction-1', Amount: 1, CardNum: '4580********1111' }]
  });
  if (url.endsWith('/Verify')) {
    assert.equal(body.GroupPrivateToken, 'test-group-token');
    assert.equal(body.TotalAmount, 1);
    return Response.json({ Status: 'VERIFIED' });
  }
  return Response.json({}, { status: 404 });
};

test('verified nutrition payment unlocks the purchased service and is idempotent', async () => {
  let state = {
    payload: {
      users: [{ id: 'trainee-1', name: 'Trainee', role: 'TRAINEE', nutritionPlanPaid: false, secondaryMemberships: [] }],
      nutritionPlans: [{ id: 'nutrition-1', traineeId: 'trainee-1', isPaid: false, paymentStatus: 'UNPAID', price: 0 }],
      payments: []
    },
    revision: 1
  };
  const sessions = new Map();
  const store = {
    async createSession(tokenHash, clubId, userId, expiresAt) { sessions.set(tokenHash, { club_id: clubId, user_id: userId, expires_at: expiresAt }); },
    async getSession(tokenHash) { return sessions.get(tokenHash); },
    async getAccount() { return { user_id: 'trainee-1', role: 'TRAINEE' }; },
    async getClubState() { return state; },
    async putClubState(_clubId, payload, expectedRevision) {
      if (expectedRevision !== state.revision) return { conflict: true, revision: state.revision };
      state = { payload, revision: state.revision + 1 };
      return { conflict: false, revision: state.revision };
    }
  };
  const env = {
    STATE_STORE: store,
    CLUB_ID: 'test-club',
    RIVHIT_ENVIRONMENT: 'test',
    RIVHIT_GROUP_PRIVATE_TOKEN: 'test-group-token',
    RIVHIT_FETCH: rivhitFetch,
    PAYMENT_SIGNING_SECRET: 'nutrition-payment-test-secret',
    PUBLIC_APP_URL: 'https://balywellness.test/',
    PAYMENT_ALLOWED_ORIGIN: 'https://balywellness.test'
  };
  const auth = await createAuthenticatedSession(store, 'test-club', 'trainee-1');
  const createResponse = await worker.fetch(new Request('https://balywellness.test/api/payments/rivhit/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: auth.cookie, Origin: 'https://balywellness.test' },
    body: JSON.stringify({ userId: 'trainee-1', userName: 'Trainee', membershipType: 'NUTRITION_COACHING', mode: 'ADDON' })
  }), env);
  assert.equal(createResponse.status, 200);
  const checkout = await createResponse.json();
  const verifyRequest = () => new Request('https://balywellness.test/api/payments/rivhit/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: auth.cookie, Origin: 'https://balywellness.test' },
    body: JSON.stringify({ paymentReference: checkout.paymentReference })
  });

  const verifyResponse = await worker.fetch(verifyRequest(), env);
  assert.equal(verifyResponse.status, 200);
  assert.equal(state.payload.users[0].nutritionPlanPaid, true);
  assert.deepEqual(state.payload.users[0].secondaryMemberships, ['NUTRITION_COACHING']);
  assert.equal(state.payload.nutritionPlans[0].isPaid, true);
  assert.equal(state.payload.nutritionPlans[0].price, 350);
  assert.equal(state.payload.nutritionPlans[0].paymentStatus, 'PAID');
  assert.equal(state.payload.payments.length, 1);
  assert.equal(state.payload.payments[0].amount, 350);

  const repeatedResponse = await worker.fetch(verifyRequest(), env);
  assert.equal(repeatedResponse.status, 200);
  assert.equal(state.payload.payments.length, 1);
});

test('verified non-nutrition purchase is persisted for staff alerts', async () => {
  let state = {
    payload: {
      users: [{ id: 'trainee-2', name: 'Meni', role: 'TRAINEE', secondaryMemberships: [] }],
      nutritionPlans: [],
      payments: []
    },
    revision: 1
  };
  const sessions = new Map();
  const store = {
    async createSession(tokenHash, clubId, userId, expiresAt) { sessions.set(tokenHash, { club_id: clubId, user_id: userId, expires_at: expiresAt }); },
    async getSession(tokenHash) { return sessions.get(tokenHash); },
    async getAccount() { return { user_id: 'trainee-2', role: 'TRAINEE' }; },
    async getClubState() { return state; },
    async putClubState(_clubId, payload, expectedRevision) {
      if (expectedRevision !== state.revision) return { conflict: true, revision: state.revision };
      state = { payload, revision: state.revision + 1 };
      return { conflict: false, revision: state.revision };
    }
  };
  const env = {
    STATE_STORE: store,
    CLUB_ID: 'test-club',
    RIVHIT_ENVIRONMENT: 'test',
    RIVHIT_GROUP_PRIVATE_TOKEN: 'test-group-token',
    RIVHIT_FETCH: rivhitFetch,
    PAYMENT_SIGNING_SECRET: 'workout-payment-test-secret',
    PUBLIC_APP_URL: 'https://balywellness.test/',
    PAYMENT_ALLOWED_ORIGIN: 'https://balywellness.test'
  };
  const auth = await createAuthenticatedSession(store, 'test-club', 'trainee-2');
  const createResponse = await worker.fetch(new Request('https://balywellness.test/api/payments/rivhit/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: auth.cookie, Origin: 'https://balywellness.test' },
    body: JSON.stringify({ userId: 'trainee-2', userName: 'Meni', membershipType: 'WORKOUT_COACHING', mode: 'ADDON' })
  }), env);
  assert.equal(createResponse.status, 200);
  const checkout = await createResponse.json();
  const verifyResponse = await worker.fetch(new Request('https://balywellness.test/api/payments/rivhit/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: auth.cookie, Origin: 'https://balywellness.test' },
    body: JSON.stringify({ paymentReference: checkout.paymentReference })
  }), env);

  assert.equal(verifyResponse.status, 200);
  assert.equal(state.payload.payments.length, 1);
  assert.equal(state.payload.payments[0].traineeId, 'trainee-2');
  assert.equal(state.payload.payments[0].membershipTypePurchased, 'WORKOUT_COACHING');
  assert.match(state.payload.payments[0].timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(state.payload.users[0].secondaryMemberships, ['WORKOUT_COACHING']);
  assert.equal(state.payload.users[0].requestedWorkoutPlan, true);
});
