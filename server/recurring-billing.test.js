import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';
import { createPhoneVerificationToken } from './sms-auth.js';
import { recurringPlan, recurringSchedule, recurringReceipt, familyRecurringSelections } from '../shared/recurring-billing.js';

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
  let signedOrder, requests = [], charge = 0, amount = 500, failure = 0, providerUnavailable = false, role = 'TRAINEE';
  const sale = () => ({ SaleId: `sale-${charge}`, Custom1: signedOrder, Amount: amount, TransactionAmount: amount,
    RecurringId: 'series', RecurringSaleChargeNumber: charge, TransactionStatus: failure, TransactionParamJ: charge === 0 ? 5 : 0,
    CustomerTransactionId: `transaction-${charge}`, TransactionCardNum: '4580XXXX1111' });
  const env = {
    RIVHIT_ENVIRONMENT: 'production', RIVHIT_GROUP_PRIVATE_TOKEN: 'fixture-one-off-page',
    RIVHIT_RECURRING_GROUP_PRIVATE_TOKEN: 'fixture-recurring-page', RIVHIT_ENABLE_RECURRING: 'true', RIVHIT_RECURRING_CALENDAR_VERIFIED: 'true',
    PAYMENT_SIGNING_SECRET: 'fixture-signing-key', PUBLIC_APP_URL: 'https://club.test/',
    SMS_OTP_SIGNING_SECRET: 'fixture-registration-signing-key-long-enough',
    STATE_STORE: {
      getAccountByLogin: async () => null,
      upsertAccount: async () => {}, createSession: async () => {},
      getSession: async () => ({ club_id: 'baly-wellness', user_id: 'trainee' }),
      getAccount: async () => ({ user_id: 'trainee', role }),
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
        amount = body.Items[0].UnitPrice;
        return Response.json({ Status: 0, URL: 'https://icredit.rivhit.co.il/payment/fixture', PrivateSaleToken: 'fixture-private-sale' });
      }
      if (url.endsWith('/Verify')) {
        assert.equal(body.GroupPrivateToken, 'fixture-recurring-page');
        return Response.json({ Status: 'VERIFIED' });
      }
      if (url.endsWith('/SaleDetails')) return providerUnavailable ? Response.json({ Status: 1 }) : Response.json({ Status: 0, data: [sale()] });
      throw new Error('Unexpected provider operation');
    }, ...extra
  };
  const post = (path, body) => worker.fetch(new Request(`https://club.test/api/payments/rivhit/${path}`, {
    method: 'POST', headers: { Cookie: 'baly_session=fixture', 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }), env);
  const create = (patch = {}) => post('create', { userId: 'trainee', userName: 'Trainee', membershipType: 'GROUP_MONTHLY', mode: 'PRIMARY', ...patch });
  return { create, post, env, state: () => state, requests, charge: n => { charge = n; }, failure: n => { failure = n; },
    asManager: () => { role = 'MANAGER'; }, unavailable: value => { providerUnavailable = value; }, webhook: (patch = {}) => post('webhook', { ...sale(), ...patch }) };
}

test('operator readiness and user consent are required before contacting provider', async () => {
  for (const extra of [{ RIVHIT_ENABLE_RECURRING: 'false' }, { RIVHIT_RECURRING_CALENDAR_VERIFIED: 'false' }, { RIVHIT_RECURRING_GROUP_PRIVATE_TOKEN: '' }]) {
    const f = fixture(extra); assert.equal((await f.create({ recurringAcknowledged: true })).status, 503); assert.equal(f.requests.length, 0);
  }
  const f = fixture();
  const response = await f.create(); assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'RECURRING_CONSENT_REQUIRED'); assert.equal(f.requests.length, 0);
});

test('separate hosted page; verified setup grants pending access, not a receipt; monthly receipts are idempotent', async () => {
  const f = fixture();
  assert.equal((await f.create({ recurringAcknowledged: true })).status, 200);
  const request = f.requests[0].body;
  assert.equal(request.GroupPrivateToken, 'fixture-recurring-page');
  assert.equal(request.RecurringSaleCount, 12); assert.equal(request.NumberOfPayments, 1);
  assert.equal(request.SaleType, 2); assert.equal(request.Items[0].UnitPrice, 500);
  assert.equal(f.state().payload.users[0].membershipStatus, 'DEBT'); // GetUrl alone never activates.
  const repeat = await f.create({ recurringAcknowledged: true });
  assert.equal(repeat.status, 409); assert.equal((await repeat.json()).code, 'RECURRING_CHECKOUT_EXISTS');
  assert.equal((await f.webhook()).status, 200);
  assert.equal(f.state().payload.payments.length, 0); assert.equal(f.state().payload.users[0].membershipStatus, 'ACTIVE');
  assert.equal(f.state().payload.users[0].recurringMemberships.GROUP_MONTHLY.status, 'PENDING_FIRST_CHARGE');
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

test('mixed family recurring checkout is blocked before quote, reservation or provider call', async () => {
  for (const enabled of ['false', 'true']) {
    for (const quoteOnly of [true, false]) {
      for (const additional of [false, true]) {
        const f = fixture({ RIVHIT_ENABLE_RECURRING: enabled });
        if (additional) f.state().payload.settings.membershipPlans[0].category = 'ADD_ON';
        f.state().payload.settings.membershipPlans.push({ id: 'OPEN_GYM', price: 280, active: true, billingPeriod: 'MONTHLY', paymentMode: 'ONE_TIME' });
        const before = JSON.stringify(f.state());
        const recurringMember = { memberId: 'trainee', memberName: 'Trainee', membershipType: additional ? 'OPEN_GYM' : 'GROUP_MONTHLY',
          ...(additional ? { additionalPlans: [{ membershipType: 'GROUP_MONTHLY' }] } : {}) };
        const response = await f.create({ membershipType: 'FAMILY_MEMBERSHIP', familyMembersCount: 2, familyBillingMode: 'CUSTOM_COMBINED',
          familyMemberPlans: [recurringMember, { memberId: 'child', memberName: 'Child', membershipType: 'OPEN_GYM' }], quoteOnly, recurringAcknowledged: true });
        assert.equal(response.status, enabled === 'false' ? 503 : 422);
        assert.equal((await response.json()).code, enabled === 'false' ? 'RECURRING_DISABLED' : 'FAMILY_RECURRING_UNSUPPORTED');
        assert.equal(f.requests.length, 0);
        assert.equal(JSON.stringify(f.state()), before);
      }
    }
  }
});

test('family detection excludes already paid, not-started and frozen members, including their add-ons', () => {
  const catalog = [{ id: 'annual', billingPeriod: 'MONTHLY_ANNUAL_COMMITMENT' }, { id: 'monthly', billingPeriod: 'MONTHLY' }];
  for (const participation of ['SKIP', 'NOT_STARTED', 'FROZEN']) {
    assert.deepEqual(familyRecurringSelections([
      { memberName: 'Annual', membershipType: 'monthly', additionalPlans: [{ membershipType: 'annual' }], participation },
      { memberName: 'Monthly', membershipType: 'monthly', participation: 'INCLUDED' }
    ], catalog), []);
  }
  assert.equal(familyRecurringSelections([{ memberName: 'Annual', membershipType: 'annual' }], catalog).length, 1);
});

test('legacy annual family mode cannot fall back to one-off when recurring is disabled', async () => {
  const f = fixture({ RIVHIT_ENABLE_RECURRING: 'false' });
  const response = await f.create({ membershipType: 'FAMILY_MEMBERSHIP', familyMembersCount: 2, familyBillingMode: 'ANNUAL_BY_SIZE', quoteOnly: true });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'RECURRING_DISABLED');
  assert.equal(f.requests.length, 0);
});

test('a single recurring plan keeps the discounted price in every charge, not just the first', async () => {
  const f = fixture();
  f.state().payload.discountCodes = [{ id: 'coupon', code: 'TEN', discountPercent: 10, isSingleUse: true }];
  assert.equal((await f.create({ discountCode: 'TEN', recurringAcknowledged: true })).status, 200);
  assert.equal(f.requests[0].body.Items[0].UnitPrice, 450);
  // Inspect the signed immutable order, not a recalculation against a mutable coupon.
  const order = JSON.parse(Buffer.from(f.requests[0].body.Custom1.split('.')[0], 'base64url').toString());
  assert.equal(order.a, 450); assert.equal(order.c, 'TEN'); assert.equal(order.rm, 12);
  assert.equal((await f.webhook()).status, 200);
  f.state().payload.discountCodes[0].discountPercent = 50;
  for (const number of [1, 2, 12]) {
    f.charge(number); assert.equal((await f.webhook()).status, 200);
    assert.equal(f.state().payload.payments[0].amount, 450);
  }
  assert.equal(f.state().payload.users[0].recurringMemberships.GROUP_MONTHLY.amount, 450);
  assert.equal(f.state().payload.discountCodes[0].usedByPaymentId, order.o);
});

test('only provider-confirmed failure suspends; untrusted IPN and unavailable provider do not', async () => {
  const f = fixture();
  assert.equal((await f.create({ recurringAcknowledged: true })).status, 200);
  assert.equal((await f.webhook({ TransactionStatus: 5 })).status, 200);
  assert.equal(f.state().payload.users[0].recurringMemberships.GROUP_MONTHLY.status, 'PENDING_FIRST_CHARGE');
  f.charge(1); f.unavailable(true);
  assert.equal((await f.webhook()).status, 502);
  assert.equal(f.state().payload.users[0].recurringMemberships.GROUP_MONTHLY.status, 'PENDING_FIRST_CHARGE');
  f.unavailable(false); f.failure(5);
  assert.equal((await f.webhook({ TransactionStatus: 0 })).status, 200);
  assert.equal(f.state().payload.users[0].recurringMemberships.GROUP_MONTHLY.status, 'PAYMENT_FAILED');
  assert.equal(f.state().payload.payments.length, 0);
  f.failure(0);
  assert.equal((await f.webhook()).status, 200);
  assert.equal(f.state().payload.users[0].recurringMemberships.GROUP_MONTHLY.status, 'ACTIVE');
  assert.equal(f.state().payload.payments.length, 1);
});

test('manager can sync an existing approved setup without a new charge; trainee and wrong beneficiary cannot', async () => {
  const f = fixture(); await f.create({ recurringAcknowledged: true });
  const body = { saleId: 'sale-0', userId: 'trainee' };
  assert.equal((await f.post('admin/recurring-sync', body)).status, 403);
  assert.equal(f.state().payload.users[0].membershipStatus, 'DEBT');
  f.asManager();
  assert.equal((await f.post('admin/recurring-sync', { ...body, userId: 'other' })).status, 422);
  assert.equal(f.state().payload.users[0].membershipStatus, 'DEBT');
  assert.equal((await f.post('admin/recurring-sync', body)).status, 200);
  assert.equal(f.state().payload.users[0].recurringMemberships.GROUP_MONTHLY.status, 'PENDING_FIRST_CHARGE');
  assert.equal(f.state().payload.payments.length, 0);
  assert.equal(f.requests.filter(request => request.url.endsWith('/GetUrl')).length, 1);
  assert.equal(f.requests.filter(request => /Charge|RecurringSaleCreate/.test(request.url)).length, 0);
});

test('concurrent duplicate setups and failures preserve one notice per recipient and no phantom receipt', async () => {
  const f = fixture(); f.state().payload.users.push({ id: 'manager', role: 'MANAGER', name: 'Manager' });
  await f.create({ recurringAcknowledged: true });
  await Promise.all([f.webhook(), f.webhook()]);
  assert.equal(f.state().payload.messages.length, 2);
  f.charge(1); f.failure(4);
  await Promise.all([f.webhook(), f.webhook()]);
  assert.equal(f.state().payload.messages.length, 4);
  assert.equal(f.state().payload.payments.length, 0);
});

test('legacy registration return with verified J5 completes profile without fabricating a paid receipt', async () => {
  const f = fixture();
  const checkout = await f.create({ mode: 'REGISTRATION', recurringAcknowledged: true });
  assert.equal(checkout.status, 200);
  const { paymentReference } = await checkout.json();
  const user = { id: 'trainee', role: 'TRAINEE', name: 'Test Trainee', username: 'fixture-user', email: 'fixture@example.com',
    phone: '0541234567', password: 'fixture-password', membershipType: 'GROUP_MONTHLY', membershipStatus: 'ACTIVE' };
  const phoneVerificationToken = await createPhoneVerificationToken({ env: f.env, clubId: 'baly-wellness', phone: user.phone });
  const response = await worker.fetch(new Request('https://club.test/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user, phoneVerificationToken, payment: { paymentReference, status: 'PAID' } }) }), f.env);
  assert.equal(response.status, 201, await response.clone().text());
  assert.equal(f.state().payload.payments.length, 0);
  assert.equal(f.state().payload.users[0].registrationPaymentPending, false);
  assert.equal(f.state().payload.users[0].recurringMemberships.GROUP_MONTHLY.status, 'PENDING_FIRST_CHARGE');
});
