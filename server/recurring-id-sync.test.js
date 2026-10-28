import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareRecurringIdSync, recurringId } from './recurring-id-sync.js';
import { sameProviderPayment, uniquePayments } from '../shared/payment-ledger.js';
import worker from './index.js';
import { createHmac } from 'node:crypto';

const seriesId = '11111111-1111-4111-8111-111111111111'; // Fixture, never a live provider call.
const now = new Date('2026-10-28T21:00:00Z');
export const syncFixture = () => ({ seriesId, userId: 'u', appUrl: 'https://club.test/', now,
  payload: { users: [{ id: 'u', name: 'Test Trainee', role: 'TRAINEE', phone: '0541234567', membershipType: 'WORKOUT_PLAN', membershipStatus: 'ACTIVE' }],
    settings: { membershipPlans: [{ id: 'OPEN_GYM', label: 'Open Gym', price: 500 }] },
    recurringCheckouts: [{ userId: 'u', orderId: 'o', membershipType: 'OPEN_GYM', endsAt: '2027-10-01', dispatchedAt: '2026-10-28T09:32:47Z' }], payments: [] },
  details: { Amount: 280, PhoneNumber: '+972541234567', AutoCharge: true, IsActive: true, Currency: 1, ProRata: false,
    RecurringCycle: 3, RecurringDay: 1, RecurringStep: 1, RecurringSaleCount: 12, ChargeCount: 1,
    CreationDate: '2026-10-28T12:32:47+03:00', EndDate: '2027-10-01T00:00:00+03:00', ChargeDate: '2026-11-01T00:00:00+02:00',
    IpnUrl: 'https://club.test/api/payments/rivhit/webhook' },
  history: { error_code: 0, RecurringSaleHistoryList: [{ Amount: 280, ChargeDate: '28-10-2026',
    Timestamp: '2026-10-28T19:51:32Z', StatusCode: 3, StatusDescription: 'הצלחה', RivhitCode: 0,
    DocumentLink: 'https://api.rivhit.co.il/pdf/fixture/document/02_000001', TruncCardNum: '458000XXXX0222' }] } });

test('series UUID finds the saved plan and real documented charge without using catalog price or inventing SaleId', () => {
  const f = syncFixture(); const before = JSON.stringify(f);
  const prepared = prepareRecurringIdSync(f);
  assert.equal(prepared.order.m, 'OPEN_GYM'); assert.equal(prepared.order.a, 280); assert.equal(prepared.preview.amount, 280);
  assert.equal(prepared.payments.length, 1); assert.equal(prepared.payments[0].saleId, undefined);
  assert.equal(prepared.payments[0].recurringChargeNumber, 1); assert.equal(prepared.payments[0].last4Digits, '0222');
  assert.equal(prepared.discountUnknown, true); assert.equal(prepared.preview.discountCode, null);
  assert.equal(prepared.payments[0].providerChargeDate, '2026-10-28'); assert.equal(JSON.stringify(f), before);
});

test('an approved contract with zero successful charges remains explicitly unpaid', () => {
  const f = syncFixture(); f.details.ChargeCount = 0; f.history.RecurringSaleHistoryList = [];
  const prepared = prepareRecurringIdSync(f);
  assert.equal(prepared.preview.successfulCharges, 0); assert.deepEqual(prepared.payments, []);
});

test('WCF creation/end/history dates sync to the same calendar term and receipt as ISO dates', () => {
  const f = syncFixture(), iso = prepareRecurringIdSync(f);
  for (const field of ['CreationDate', 'EndDate', 'ChargeDate']) f.details[field] = `/Date(${Date.parse(f.details[field])}+0300)/`;
  f.history.RecurringSaleHistoryList[0].Timestamp = `/Date(${Date.parse(f.history.RecurringSaleHistoryList[0].Timestamp)})/`;
  const wcf = prepareRecurringIdSync(f);
  assert.deepEqual(wcf, iso);
});

test('date parsing errors and genuine expiry have separate codes without raw provider data', () => {
  const cases = [
    ['CreationDate', '2026-10-28T12:32:47', 'RIVHIT_CREATION_DATE_FORMAT', 'ISO_WITHOUT_ZONE'],
    ['EndDate', '/Date(bad)/', 'RIVHIT_END_DATE_FORMAT', 'WCF_DATE'],
    ['CreationDate', '2028-01-01T00:00:00Z', 'RIVHIT_CREATION_DATE_FUTURE', 'ISO_OFFSET'],
    ['EndDate', '2026-01-01T00:00:00Z', 'RIVHIT_END_BEFORE_CREATION', 'ISO_OFFSET'],
    ['EndDate', '2030-01-01T00:00:00Z', 'RIVHIT_END_DATE_RANGE', 'ISO_OFFSET']
  ];
  for (const [field, value, code, format] of cases) {
    const f = syncFixture(); f.details[field] = value;
    assert.throws(() => prepareRecurringIdSync(f), error => {
      assert.equal(error.code, code); assert.deepEqual(error.diagnostic, { code, field, format });
      assert.ok(!JSON.stringify(error.diagnostic).includes(value)); return true;
    });
  }
  const expired = syncFixture(); expired.now = new Date('2027-10-01T12:00:00Z');
  assert.throws(() => prepareRecurringIdSync(expired), { code: 'RIVHIT_CONTRACT_ENDED' });
});

test('saved signed order snapshot preserves historical coupon even if catalog or coupon changed', () => {
  const f = syncFixture(); f.payload.recurringCheckouts[0].orderSnapshot = { o: 'o', u: 'u', m: 'OPEN_GYM', rc: 1, a: 280, c: 'ORIGINAL', re: '2027-10-01' };
  const prepared = prepareRecurringIdSync(f);
  assert.equal(prepared.discountUnknown, false); assert.equal(prepared.preview.discountCode, 'ORIGINAL');
  f.details.Amount = 200; assert.throws(() => prepareRecurringIdSync(f), /שונים מהבקשה/);
});

test('never match by shared family email, name or amount; reject different phone, merchant and beneficiary', () => {
  for (const mutate of [f => { f.details.PhoneNumber = '0529999999'; },
    f => { f.details.IpnUrl = 'https://another.test/webhook'; }, f => { f.userId = 'other'; },
    f => { f.payload.users.push({ id: 'other', recurringMemberships: { OPEN_GYM: { seriesId } } }); }]) {
    const f = syncFixture(); mutate(f); assert.throws(() => prepareRecurringIdSync(f));
  }
});

test('family payer phone requires the selected beneficiary own saved checkout', () => {
  const f = syncFixture(); f.payload.users[0].phone = ''; f.payload.users[0].familyPayerId = 'payer';
  f.payload.users.push({ id: 'payer', phone: '0541234567' });
  assert.equal(prepareRecurringIdSync(f).order.bu, 'u');
  f.payload.recurringCheckouts[0].userId = 'payer';
  assert.throws(() => prepareRecurringIdSync(f), /לא נמצאה בקשת הקמה/);
});

test('inactive/wrong schedule, expired, missing and ambiguous checkout do not grant access', () => {
  for (const mutate of [f => { f.details.IsActive = false; }, f => { f.details.AutoCharge = false; },
    f => { f.details.RecurringSaleCount = 0; }, f => { f.details.Currency = 2; },
    f => { f.details.EndDate = '2025-01-01T00:00:00Z'; }, f => { f.payload.recurringCheckouts = []; },
    f => { f.payload.recurringCheckouts.push({ ...f.payload.recurringCheckouts[0], orderId: 'ambiguous' }); },
    f => { f.payload.recurringCheckouts[0].cancelledAt = now.toISOString(); }]) {
    const f = syncFixture(); mutate(f); assert.throws(() => prepareRecurringIdSync(f));
  }
});

test('missing or failed history, mismatched amounts/counts, duplicate or unsafe documents never become receipts', () => {
  for (const mutate of [f => { f.history.error_code = 5; }, f => { f.history.RecurringSaleHistoryList = undefined; },
    f => { f.details.ChargeCount = 2; }, f => { f.history.RecurringSaleHistoryList[0].Amount = 500; },
    f => { f.history.RecurringSaleHistoryList[0].StatusCode = 2; }, f => { f.history.RecurringSaleHistoryList[0].RivhitCode = 5; },
    f => { f.history.RecurringSaleHistoryList[0].DocumentLink = ''; },
    f => { f.history.RecurringSaleHistoryList[0].DocumentLink = 'https://fake.test/invoice'; },
    f => { f.history.RecurringSaleHistoryList[0].Timestamp = 'bad'; },
    f => { f.details.ChargeCount = 2; f.history.RecurringSaleHistoryList.push({ ...f.history.RecurringSaleHistoryList[0] }); }]) {
    const f = syncFixture(); mutate(f); assert.throws(() => prepareRecurringIdSync(f));
  }
});

test('failed attempts require review rather than guessing a charge counter or reactivating a declined contract', () => {
  const f = syncFixture();
  f.history.RecurringSaleHistoryList.unshift({ Timestamp: '2026-10-28T18:00:00Z', StatusCode: 2 });
  assert.throws(() => prepareRecurringIdSync(f), /כשל/);
  f.history.RecurringSaleHistoryList.push({ Timestamp: '2026-10-28T20:00:00Z', StatusCode: 2 });
  assert.throws(() => prepareRecurringIdSync(f), /כשל/);
});

test('history import and later SaleId IPN of the same series counter are one receipt, not two charges', () => {
  const common = { provider: 'RIVHIT', providerRecurringSaleId: seriesId, recurringChargeNumber: 1, amount: 280, status: 'PAID' };
  const history = { ...common, id: 'payment-rivhit-series-charge-1', providerTransactionId: 'history-tx' };
  const ipn = { ...common, id: 'payment-rivhit-sale', providerSaleId: 'real-sale', providerTransactionId: 'real-tx' };
  assert.equal(sameProviderPayment(history, ipn), true); assert.equal(uniquePayments([history, ipn]).length, 1);
  assert.equal(sameProviderPayment(history, { ...ipn, recurringChargeNumber: 2 }), false);
  assert.equal(sameProviderPayment(history, { ...ipn, isMock: true }), false);
  assert.equal(sameProviderPayment(history, { ...ipn, providerRecurringSaleId: 'other' }), false);
  assert.equal(sameProviderPayment({ ...history, recurringChargeNumber: 0 }, { ...ipn, recurringChargeNumber: 0 }), false);
  assert.equal(recurringId('bad'), null);
});

function httpFixture() {
  const f = syncFixture();
  f.payload.users.push({ id: 'manager', name: 'Manager', role: 'MANAGER' });
  f.payload.messages = [];
  let state = { revision: 1, payload: f.payload }, role = 'MANAGER', ipn;
  const calls = [];
  const env = { STATE_STORE: {
    getSession: async () => ({ club_id: 'test', user_id: role === 'MANAGER' ? 'manager' : 'u' }),
    getAccount: async () => ({ role, user_id: role === 'MANAGER' ? 'manager' : 'u' }),
    getClubState: async () => state,
    putClubState: async (_club, payload, revision) => {
      if (state.revision !== revision) return { conflict: true };
      state = { payload, revision: revision + 1 }; return { conflict: false, revision: state.revision };
    }
  }, RIVHIT_ENVIRONMENT: 'production', PUBLIC_APP_URL: f.appUrl, CLUB_ID: 'test',
  PAYMENT_SIGNING_SECRET: 'fixture-signing-key', RIVHIT_GROUP_PRIVATE_TOKEN: 'fixture-page', RIVHIT_RECURRING_GROUP_PRIVATE_TOKEN: 'fixture-recurring-page',
  RIVHIT_FETCH: async (url, init) => {
    const body = JSON.parse(init.body); calls.push({ url, body });
    if (url.endsWith('/RecurringSaleDetails')) { assert.equal(body.RecurringSaleId, seriesId); return Response.json(f.details); }
    if (url.endsWith('/RecurringSaleHistory')) { assert.equal(body.RecurringSaleId, seriesId); return Response.json(f.history); }
    if (url.endsWith('/SaleDetails') && ipn) return Response.json({ Status: 0, data: [ipn] });
    if (url.endsWith('/Verify') && ipn) return Response.json({ Status: 'VERIFIED' });
    throw new Error('Unexpected provider mutation or operation');
  } };
  const post = (body, path = 'admin/recurring-sync') => worker.fetch(new Request(`https://club.test/api/payments/rivhit/${path}`, {
    method: 'POST', headers: { Cookie: 'baly_session=fixture', 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }), env);
  const input = { userId: 'u', recurringSaleId: seriesId, action: 'preview' };
  const preview = async () => {
    const response = await post(input); assert.equal(response.status, 200, await response.clone().text()); return response.json();
  };
  return { f, calls, input, post, preview, state: () => state, asTrainee: () => { role = 'TRAINEE'; }, webhook: async () => {
    const prepared = prepareRecurringIdSync({ ...f, payload: state.payload });
    const encoded = Buffer.from(JSON.stringify(prepared.order)).toString('base64url');
    const signed = `${encoded}.${createHmac('sha256', env.PAYMENT_SIGNING_SECRET).update(encoded).digest('base64url')}`;
    ipn = { SaleId: 'real-sale', Custom1: signed, RecurringId: seriesId, RecurringSaleChargeNumber: 1, RecurringSaleCount: 12,
      TransactionAmount: 280, TransactionStatus: 0, TransactionParamJ: 0, CustomerTransactionId: 'real-tx', TransactionDateTime: '28.10.2026 22:51:32', TransactionCardNum: '4580XXXX0222' };
    return post(ipn, 'webhook');
  } };
}

test('manager preview is read-only; confirmed history sync is idempotent and later IPN only enriches the same receipt', async () => {
  const f = httpFixture(); const before = JSON.stringify(f.state());
  const preview = await f.preview();
  assert.equal(preview.preview.successfulCharges, 1); assert.equal(JSON.stringify(f.state()), before);
  assert.equal((await f.post({ ...f.input, action: 'confirm', confirmationKey: 'wrong' })).status, 409);
  assert.equal(JSON.stringify(f.state()), before);
  const confirm = { ...f.input, action: 'confirm', confirmationKey: preview.confirmationKey };
  assert.equal((await f.post(confirm)).status, 200);
  assert.equal(f.state().payload.payments.length, 1);
  assert.equal(f.state().payload.payments[0].amount, 280); assert.equal(f.state().payload.payments[0].providerSaleId, undefined);
  assert.equal(f.state().payload.payments[0].discountCode, undefined); // Unknown is not "no coupon".
  assert.equal(f.state().payload.payments[0].date, '2026-10-28');
  assert.equal(f.state().payload.users[0].membershipType, 'WORKOUT_PLAN');
  assert.ok(f.state().payload.users[0].secondaryMemberships.includes('OPEN_GYM'));
  assert.equal(f.state().payload.users[0].recurringMemberships.OPEN_GYM.recoveredBy, 'manager');
  const notices = f.state().payload.messages.length;
  assert.equal((await f.post(confirm)).status, 200); assert.equal(f.state().payload.payments.length, 1);
  assert.equal(f.state().payload.messages.length, notices);
  assert.equal((await f.webhook()).status, 200);
  assert.equal(f.state().payload.payments.length, 1); assert.equal(f.state().payload.payments[0].providerSaleId, 'real-sale');
  assert.equal(f.state().payload.payments[0].providerTransactionId, 'real-tx'); assert.equal(f.state().payload.messages.length, notices);
  assert.ok(f.calls.every(call => /\/(RecurringSaleDetails|RecurringSaleHistory|SaleDetails|Verify)$/.test(call.url)));
});

test('confirmed zero-charge series activates pending access without fake paid rows', async () => {
  const f = httpFixture(); f.f.details.ChargeCount = 0; f.f.history.RecurringSaleHistoryList = [];
  const preview = await f.preview();
  assert.equal((await f.post({ ...f.input, action: 'confirm', confirmationKey: preview.confirmationKey })).status, 200);
  assert.equal(f.state().payload.payments.length, 0);
  assert.equal(f.state().payload.users[0].recurringMemberships.OPEN_GYM.status, 'PENDING_FIRST_CHARGE');
});

test('HTTP preview accepts WCF dates, but invalid end date returns a precise safe diagnostic without a write', async () => {
  const f = httpFixture();
  for (const field of ['CreationDate', 'EndDate', 'ChargeDate']) f.f.details[field] = `/Date(${Date.parse(f.f.details[field])}+0300)/`;
  f.f.history.RecurringSaleHistoryList[0].Timestamp = `/Date(${Date.parse(f.f.history.RecurringSaleHistoryList[0].Timestamp)})/`;
  const before = JSON.stringify(f.state());
  const preview = await f.preview(); assert.equal(preview.preview.endsAt, '2027-10-01');
  assert.equal(JSON.stringify(f.state()), before);
  f.f.details.EndDate = 'bad-provider-data';
  const response = await f.post(f.input); const result = await response.json();
  assert.equal(response.status, 422); assert.equal(result.code, 'RIVHIT_END_DATE_FORMAT');
  assert.match(result.message, /EndDate/); assert.doesNotMatch(result.message, /ההתקשרות הסתיימה/);
  assert.deepEqual(result.diagnostic, { code: 'RIVHIT_END_DATE_FORMAT', field: 'EndDate', format: 'UNSUPPORTED_STRING' });
  assert.ok(!JSON.stringify(result).includes('bad-provider-data')); assert.equal(JSON.stringify(f.state()), before);
});

test('trainee, invalid identifiers and changed provider history cannot bypass manager preview', async () => {
  const f = httpFixture();
  assert.equal((await f.post({ ...f.input, recurringSaleId: 'not-uuid' })).status, 400);
  const preview = await f.preview(); const before = JSON.stringify(f.state());
  f.f.details.Amount = 300;
  assert.equal((await f.post({ ...f.input, action: 'confirm', confirmationKey: preview.confirmationKey })).status, 422);
  assert.equal(JSON.stringify(f.state()), before);
  f.f.history.RecurringSaleHistoryList[0].Amount = 300;
  assert.equal((await f.post({ ...f.input, action: 'confirm', confirmationKey: preview.confirmationKey })).status, 409);
  assert.equal(JSON.stringify(f.state()), before);
  f.asTrainee(); assert.equal((await f.post(f.input)).status, 403);
});

test('simultaneous confirmations do not duplicate receipts or notifications', async () => {
  const f = httpFixture(); const preview = await f.preview();
  const input = { ...f.input, action: 'confirm', confirmationKey: preview.confirmationKey };
  const responses = await Promise.all([f.post(input), f.post(input)]);
  assert.ok(responses.every(response => response.status === 200));
  assert.equal(f.state().payload.payments.length, 1); assert.equal(f.state().payload.messages.length, 2);
});
