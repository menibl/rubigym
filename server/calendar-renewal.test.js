import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.js';
import { clubDate, nextMonthStart, repairCalendarMemberships } from '../shared/membership-calendar.js';
import { repeatedMonthlyPayments } from '../shared/monthly-payment-warning.js';

function fixture(type = 'OPEN_GYM') {
  const today = clubDate(), expiry = nextMonthStart(today);
  let state = { revision: 1, payload: { users: [{ id: 'u', name: 'User Example', role: 'TRAINEE', membershipType: type,
    membershipStatus: 'ACTIVE', membershipExpiry: expiry, membershipExpiryExclusive: true }], settings: { membershipPlans: [
      { id: type, price: 500, active: true, billingPeriod: 'MONTHLY', paymentMode: 'ONE_TIME' },
      ...(type !== 'OPEN_GYM' ? [{ id: 'OPEN_GYM', price: 280, active: true, billingPeriod: 'MONTHLY', paymentMode: 'ONE_TIME' }] : [])
    ] }, payments: [{ id: 'old', traineeId: 'u', status: 'PAID', membershipTypePurchased: type, date: today, amount: 500 }], messages: [] } };
  let signedOrder, calls = 0;
  const store = {
    getSession: async () => ({ club_id: 'test', user_id: 'u' }),
    getAccount: async () => ({ user_id: 'u', role: 'TRAINEE' }),
    getClubState: async () => structuredClone(state),
    putClubState: async (_club, payload, revision) => {
      if (revision !== state.revision) return { conflict: true };
      state = { payload, revision: revision + 1 }; return { conflict: false };
    }
  };
  const env = { STATE_STORE: store, CLUB_ID: 'test', RIVHIT_ENVIRONMENT: 'production', RIVHIT_GROUP_PRIVATE_TOKEN: 'fixture-page',
    PAYMENT_SIGNING_SECRET: 'fixture-signing', PUBLIC_APP_URL: 'https://club.test/', RIVHIT_FETCH: async (url, init) => {
      const body = JSON.parse(init.body);
      if (url.endsWith('/GetUrl')) { calls++; signedOrder = body.Custom1; return Response.json({ Status: 0, URL: 'https://icredit.rivhit.co.il/payment/fixture', PrivateSaleToken: 'fixture-private' }); }
      if (url.endsWith('/SaleDetails')) return Response.json({ Status: 0, data: [{ SaleId: 'new-sale', Custom1: signedOrder, CustomerTransactionId: 'new-tx', Amount: 500 }] });
      if (url.endsWith('/Verify')) return Response.json({ Status: 'VERIFIED' });
      throw new Error('Unexpected provider request');
    } };
  const post = (path, body) => worker.fetch(new Request(`https://club.test/api/payments/rivhit/${path}`, {
    method: 'POST', headers: { Cookie: 'baly_session=fixture', 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }), env);
  const create = (patch = {}) => post('create', { userId: 'u', userName: 'User Example', membershipType: type, mode: 'PRIMARY', ...patch });
  return { expiry, create, post, state: () => state, calls: () => calls };
}
for (const type of ['OPEN_GYM', 'GROUP_MONTHLY']) test(`${type}: confirmation shows current/new expiry and verified payment extends once`, async () => {
  const f = fixture(type);
  const warning = await f.create(); assert.equal(warning.status, 409);
  const message = await warning.json();
  assert.equal(message.code, 'REPEAT_MONTHLY_PAYMENT');
  assert.ok(message.message.includes(f.expiry)); assert.ok(message.message.includes(nextMonthStart(f.expiry)));
  assert.equal(f.calls(), 0);
  const checkout = await (await f.create({ repeatPaymentAcknowledged: true })).json();
  for (let i = 0; i < 2; i++) {
    const verified = await f.post('verify', { paymentReference: checkout.paymentReference }); assert.equal(verified.status, 200);
    assert.equal((await verified.json()).membershipExpiry, nextMonthStart(f.expiry));
  }
  assert.equal(f.state().payload.users[0].membershipExpiry, nextMonthStart(f.expiry));
  assert.equal(f.state().payload.users[0].membershipExpiryManualOverride, true, 'older calendar repair must preserve paid advance renewal on rollback');
  assert.equal(f.state().payload.payments.length, 2);
  assert.equal(repairCalendarMemberships(f.state().payload).payload.users[0].membershipExpiry, nextMonthStart(f.expiry));
});
test('concurrent renewal requests cannot open two provider pages for the same extension', async () => {
  const f = fixture();
  const responses = await Promise.all([f.create({ repeatPaymentAcknowledged: true }), f.create({ repeatPaymentAcknowledged: true })]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]); assert.equal(f.calls(), 1);
});
test('Open Gym already included in group access is not sold as an unnecessary extra', async () => {
  const f = fixture('GROUP_MONTHLY');
  const response = await f.create({ membershipType: 'OPEN_GYM', repeatPaymentAcknowledged: true });
  assert.equal(response.status, 409); assert.equal((await response.json()).code, 'OPEN_ALREADY_INCLUDED'); assert.equal(f.calls(), 0);
});

test('prepaid access still warns in later months, and inclusive expiry is extended by a whole calendar month', () => {
  const payload = { users: [{ id: 'u', membershipType: 'OPEN_GYM', membershipStatus: 'ACTIVE', membershipExpiry: '2026-11-30' }],
    payments: [{ id: 'paid', traineeId: 'u', membershipTypePurchased: 'OPEN_GYM', status: 'PAID', date: '2026-09-30' }] };
  const matches = repeatedMonthlyPayments(payload, { userId: 'u', membershipType: 'OPEN_GYM' }, {}, new Date('2026-10-12T09:00:00Z'));
  assert.equal(matches[0].currentExpiry, '2026-11-30'); assert.equal(matches[0].newExpiry, '2027-01-01');
});
