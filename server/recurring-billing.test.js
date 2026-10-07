import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';
import { recurringPlan, recurringSchedule, recurringReceipt } from '../shared/recurring-billing.js';

test('one-off monthly prices never imply a recurring contract', () => {
  assert.equal(recurringPlan({ billingPeriod: 'MONTHLY' }), false);
  assert.equal(recurringPlan({ billingPeriod: 'MONTHLY_ANNUAL_COMMITMENT' }), true);
  assert.equal(recurringPlan({ billingPeriod: 'MONTHLY_ANNUAL_COMMITMENT', paymentMode: 'ONE_TIME' }), false);
});

test('annual schedule is finite, Jerusalem-based and never prorated', () => {
  const schedule = recurringSchedule(new Date('2026-12-31T22:30:00Z'));
  assert.equal(schedule.start, '01-01-2027');
  assert.equal(schedule.endsAt, '2028-01-01');
  assert.equal(schedule.fields.RecurringSaleCount, 12);
  assert.equal(schedule.fields.RecurringSaleDay, 1);
  assert.equal(schedule.fields.RecurringSaleProRata, false);
  assert.equal(schedule.fields.SaleType, 2);
});

test('J5 creation is not a paid receipt; reject failed and out-of-range charges', () => {
  assert.equal(recurringReceipt({ RecurringId: 'series', RecurringSaleChargeNumber: 0, TransactionStatus: 0, TransactionParamJ: 5 }).paid, false);
  for (const patch of [{ TransactionStatus: 1 }, { RecurringSaleChargeNumber: 13 }, { TransactionParamJ: 5 }]) {
    assert.throws(() => recurringReceipt({ RecurringId: 'series', RecurringSaleChargeNumber: 1, TransactionStatus: 0, TransactionParamJ: 0, ...patch }));
  }
});

function fixture(extra = {}) {
  let state = { revision: 1, payload: {
    users: [{ id: 'trainee', name: 'Trainee', role: 'TRAINEE', membershipType: 'GROUP_MONTHLY', membershipStatus: 'DEBT' }],
    settings: { membershipPlans: [{ id: 'GROUP_MONTHLY', label: 'שנתי חודשי', price: 500, active: true, billingPeriod: 'MONTHLY_ANNUAL_COMMITMENT', paymentMode: 'RECURRING' }] },
    payments: [], messages: []
  } };
  let signedOrder, requests = [], charge = 0;
  const sale = () => ({ SaleId: `sale-${charge}`, Custom1: signedOrder, Amount: 500, TransactionAmount: 500,
    RecurringId: 'series', RecurringSaleChargeNumber: charge, TransactionStatus: 0, TransactionParamJ: charge === 0 ? 5 : 0,
    CustomerTransactionId: `transaction-${charge}`, TransactionCardNum: '4580XXXX1111' });
  const env = {
    RIVHIT_ENVIRONMENT: 'production', RIVHIT_GROUP_PRIVATE_TOKEN: 'fixture-one-off-page',
    RIVHIT_RECURRING_GROUP_PRIVATE_TOKEN: 'fixture-recurring-page', RIVHIT_ENABLE_RECURRING: 'true', RIVHIT_RECURRING_CALENDAR_VERIFIED: 'true',
    PAYMENT_SIGNING_SECRET: 'fixture-signing-key', PUBLIC_APP_URL: 'https://club.test/',
    STATE_STORE: {
      getSession: async () => ({ club_id: 'baly-wellness', user_id: 'trainee' }),
      getAccount: async () => ({ user_id: 'trainee', role: 'TRAINEE' }),
      getClubState: async () => state,
      putClubState: async (_id, payload, revision) => {
        if (revision !== state.revision) return { conflict: true, revision: state.revision };
        state = { payload, revision: revision + 1 }; return { conflict: false, revision: state.revision };
      }
    },
    RIVHIT_FETCH: async (url, init) => {
      const body = JSON.parse(init.body); requests.push({ url, body });
      if (url.endsWith('/GetUrl')) {
        signedOrder = body.Custom1;
        return Response.json({ Status: 0, URL: 'https://icredit.rivhit.co.il/payment/fixture', PrivateSaleToken: 'fixture-private-sale' });
      }
      if (url.endsWith('/Verify')) {
        assert.equal(body.GroupPrivateToken, 'fixture-recurring-page');
        return Response.json({ Status: 'VERIFIED' });
      }
      if (url.endsWith('/SaleDetails')) return Response.json({ Status: 0, data: [sale()] });
      throw new Error('Unexpected provider operation');
    }, ...extra
  };
  const post = (path, body) => worker.fetch(new Request(`https://club.test/api/payments/rivhit/${path}`, {
    method: 'POST', headers: { Cookie: 'baly_session=fixture', 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }), env);
  const create = (patch = {}) => post('create', { userId: 'trainee', userName: 'Trainee', membershipType: 'GROUP_MONTHLY', mode: 'PRIMARY', ...patch });
  return { create, post, state: () => state, requests, charge: n => { charge = n; }, webhook: () => post('webhook', sale()) };
}

test('operator readiness and user consent are required before contacting provider', async () => {
  for (const extra of [{ RIVHIT_ENABLE_RECURRING: 'false' }, { RIVHIT_RECURRING_CALENDAR_VERIFIED: 'false' }, { RIVHIT_RECURRING_GROUP_PRIVATE_TOKEN: '' }]) {
    const f = fixture(extra); assert.equal((await f.create({ recurringAcknowledged: true })).status, 503); assert.equal(f.requests.length, 0);
  }
  const f = fixture();
  const response = await f.create(); assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'RECURRING_CONSENT_REQUIRED'); assert.equal(f.requests.length, 0);
});

test('separate hosted page; pending setup does not grant access; monthly receipts are idempotent', async () => {
  const f = fixture();
  assert.equal((await f.create({ recurringAcknowledged: true })).status, 200);
  const request = f.requests[0].body;
  assert.equal(request.GroupPrivateToken, 'fixture-recurring-page');
  assert.equal(request.RecurringSaleCount, 12); assert.equal(request.NumberOfPayments, 1);
  assert.equal(request.SaleType, 2); assert.equal(request.Items[0].UnitPrice, 500);
  const repeat = await f.create({ recurringAcknowledged: true });
  assert.equal(repeat.status, 409); assert.equal((await repeat.json()).code, 'RECURRING_CHECKOUT_EXISTS');
  assert.equal((await f.webhook()).status, 200);
  assert.equal(f.state().payload.payments.length, 0); assert.equal(f.state().payload.users[0].membershipStatus, 'DEBT');
  f.charge(1); assert.equal((await f.webhook()).status, 200);
  const firstExpiry = f.state().payload.users[0].membershipExpiry;
  const commitment = f.state().payload.users[0].membershipCommitmentEndsAt;
  assert.equal(f.state().payload.payments.length, 1);
  assert.equal(f.state().payload.users[0].membershipStatus, 'ACTIVE');
  assert.equal((await f.webhook()).status, 200); assert.equal(f.state().payload.payments.length, 1);
  f.charge(2); assert.equal((await f.webhook()).status, 200);
  assert.equal(f.state().payload.payments.length, 2);
  assert.ok(f.state().payload.users[0].membershipExpiry > firstExpiry);
  assert.equal(f.state().payload.users[0].membershipCommitmentEndsAt, commitment);
  const blocked = await f.create({ recurringAcknowledged: true, repeatPaymentAcknowledged: true });
  assert.equal(blocked.status, 409); assert.equal((await blocked.json()).code, 'RECURRING_ALREADY_ACTIVE');
  f.charge(13); assert.equal((await f.webhook()).status, 502); assert.equal(f.state().payload.payments.length, 2);
});

test('concurrent checkout requests reserve one contract before provider dispatch', async () => {
  const f = fixture();
  const responses = await Promise.all([f.create({ recurringAcknowledged: true }), f.create({ recurringAcknowledged: true })]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  assert.equal(f.requests.filter(request => request.url.endsWith('/GetUrl')).length, 1);
  assert.equal(f.state().payload.recurringCheckouts.length, 1);
});
