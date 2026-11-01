import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverTodayRecurring, publicRecovery } from './bulk-recurring-recovery.js';
import { clubDate } from '../shared/membership-calendar.js';
import { recurringSchedule } from '../shared/recurring-billing.js';
import worker from './index.js';

const series = '11111111-1111-4111-8111-111111111111';
const otherSeries = '22222222-2222-4222-8222-222222222222';
function fixture(now = new Date('2026-11-01T10:00:00Z')) {
  const endsAt = recurringSchedule(now).endsAt;
  const order = { o: 'order', u: 'u', m: 'GROUP_ANNUAL', d: 'PRIMARY', a: 5, c: 'ORIGINAL', rc: 1, rr: true, rm: 12,
    bp: 'MONTHLY_ANNUAL_COMMITMENT', tm: 12, re: endsAt, t: now.getTime() };
  const payload = { users: [{ id: 'u', role: 'TRAINEE', name: 'Fixture', phone: '0541234567', membershipStatus: 'DEBT' },
    { id: 'manager', role: 'MANAGER', name: 'Manager' }], payments: [], messages: [], settings: { membershipPlans: [{ id: 'GROUP_ANNUAL', label: 'שנתי', price: 500 }] },
    recurringCheckouts: [{ orderId: 'order', userId: 'u', membershipType: 'GROUP_ANNUAL', endsAt, dispatchedAt: now.toISOString(), orderSnapshot: order }] };
  const details = { Amount: 5, PhoneNumber: '972541234567', AutoCharge: true, IsActive: true, Currency: 1, ProRata: false,
    RecurringCycle: 3, RecurringDay: 1, RecurringStep: 1, RecurringSaleCount: 12, ChargeCount: 0,
    CreationDate: now.toISOString(), EndDate: new Date(Date.UTC(Number(endsAt.slice(0, 4)), Number(endsAt.slice(5, 7)) - 2, 1)).toISOString(), ChargeDate: now.toISOString(), IpnUrl: 'https://club.test/api/payments/rivhit/webhook',
    Token: 'fixture-sensitive-provider-field' };
  let list = { RecurringSales: [{ RecurringSaleId: series, IsActive: true }] }, history = { error_code: 0, RecurringSaleHistoryList: [] };
  const calls = [];
  const post = async (path, body) => {
    calls.push({ path, body });
    if (path === '/RecurringSaleList') return list;
    if (path === '/RecurringSaleDetails') return details;
    if (path === '/RecurringSaleHistory') return history;
    throw new Error('Provider mutation is forbidden');
  };
  const input = { payload, post, appUrl: 'https://club.test/', groupToken: 'fixture-private-page', now };
  return { input, payload, details, calls, order, setList: value => { list = value; }, setHistory: value => { history = value; } };
}

test('read-only discovery recovers old missing-link orders from unique verified series; catalog price never replaces signed amount', async () => {
  const f = fixture(); const before = JSON.stringify(f.payload);
  const result = await discoverTodayRecurring(f.input);
  assert.equal(result.entries[0].status, 'VERIFIED'); assert.equal(result.entries[0].prepared.order.a, 5);
  assert.equal(result.entries[0].prepared.payments.length, 0); assert.equal(JSON.stringify(f.payload), before);
  assert.deepEqual(f.calls.map(call => call.path), ['/RecurringSaleList', '/RecurringSaleDetails', '/RecurringSaleHistory']);
  const publicJson = JSON.stringify(publicRecovery(result));
  for (const value of ['fixture-sensitive-provider-field', '0541234567', 'fixture-private-page', 'prepared', 'provider']) assert.ok(!publicJson.includes(value));
});

test('multiple provider instructions, mismatched identities and missing original orders never activate automatically', async () => {
  const ambiguous = fixture(); ambiguous.setList({ RecurringSales: [series, otherSeries].map(id => ({ RecurringSaleId: id, IsActive: true })) });
  assert.equal((await discoverTodayRecurring(ambiguous.input)).entries[0].code, 'AMBIGUOUS_SERIES');
  for (const mutate of [f => { f.details.Amount = 500; }, f => { f.details.PhoneNumber = '0529999999'; },
    f => { f.details.IpnUrl = 'https://other.test/webhook'; }, f => { f.details.CreationDate = '2026-10-31T10:00:00Z'; }]) {
    const f = fixture(); mutate(f); assert.equal((await discoverTodayRecurring(f.input)).entries[0].status, 'REVIEW');
  }
  const missing = fixture(); delete missing.payload.recurringCheckouts[0].orderSnapshot;
  assert.equal((await discoverTodayRecurring(missing.input)).entries[0].code, 'ORIGINAL_ORDER_MISSING'); assert.equal(missing.calls.length, 0);
});

test('one series cannot satisfy two independent family orders with a shared phone', async () => {
  const f = fixture(); f.payload.users.push({ id: 'child', role: 'TRAINEE', name: 'Child', phone: '0541234567' });
  f.payload.recurringCheckouts.push({ ...f.payload.recurringCheckouts[0], orderId: 'child-order', userId: 'child', orderSnapshot: { ...f.order, o: 'child-order', u: 'child' } });
  const result = await discoverTodayRecurring(f.input);
  assert.ok(result.entries.every(entry => entry.code === 'SERIES_MATCHES_MULTIPLE_ORDERS'));
  assert.equal(f.calls.filter(call => call.path === '/RecurringSaleList').length, 1);
});

test('partial provider lookup errors do not turn an ambiguous search into a unique match', async () => {
  const f = fixture(); f.payload.users[0].familyPayerId = 'payer'; f.payload.users.push({ id: 'payer', role: 'TRAINEE', phone: '0521111111' });
  f.order.u = 'payer'; f.order.bu = 'u';
  const post = f.input.post;
  f.input.post = async (path, body) => { if (path === '/RecurringSaleList' && body.PhoneNumber === '0521111111') throw new Error('network'); return post(path, body); };
  assert.equal((await discoverTodayRecurring(f.input)).entries[0].code, 'PROVIDER_LIST_UNAVAILABLE');
});

test('an unresolved same-payer/same-amount order also blocks its apparently unique peer', async () => {
  const f = fixture(); f.payload.users.push({ id: 'child', role: 'TRAINEE', name: 'Child', familyPayerId: 'u', phone: '0529999999' });
  f.payload.recurringCheckouts.push({ ...f.payload.recurringCheckouts[0], orderId: 'child-order', userId: 'child',
    orderSnapshot: { ...f.order, o: 'child-order', bu: 'child' } });
  const post = f.input.post;
  f.input.post = async (path, body) => { if (path === '/RecurringSaleList' && body.PhoneNumber === '0529999999') throw new Error('timeout'); return post(path, body); };
  const result = await discoverTodayRecurring(f.input);
  assert.ok(result.entries.every(entry => entry.status === 'REVIEW'));
  assert.equal(result.entries.find(entry => entry.orderId === 'order').code, 'AMBIGUOUS_PEER_ORDER');
});

test('zero-charge approval tolerates unavailable history but positive-charge history is mandatory', async () => {
  const f = fixture(); f.setHistory({ error_code: 9 });
  assert.equal((await discoverTodayRecurring(f.input)).entries[0].status, 'VERIFIED');
  f.details.ChargeCount = 1;
  assert.equal((await discoverTodayRecurring(f.input)).entries[0].code, 'HISTORY_OR_TERMS_REQUIRE_REVIEW');
});

test('no card approval evidence or null charge count cannot be treated as completed setup', async () => {
  const empty = fixture(); delete empty.details.Token;
  assert.equal((await discoverTodayRecurring(empty.input)).entries[0].status, 'REVIEW');
  const missingCount = fixture(); missingCount.details.ChargeCount = null;
  assert.equal((await discoverTodayRecurring(missingCount.input)).entries[0].status, 'REVIEW');
});

test('scope is Jerusalem today, excludes cancelled orders, bounds batches and requires configured merchant', async () => {
  const f = fixture(); f.payload.recurringCheckouts[0].cancelledAt = f.input.now.toISOString();
  assert.equal((await discoverTodayRecurring(f.input)).entries.length, 0); assert.equal(f.calls.length, 0);
  const old = fixture(); old.payload.recurringCheckouts[0].dispatchedAt = '2026-10-31T10:00:00Z';
  assert.equal((await discoverTodayRecurring(old.input)).entries.length, 0);
  const large = fixture(); large.payload.recurringCheckouts = Array.from({ length: 51 }, (_, i) => ({ ...large.payload.recurringCheckouts[0], orderId: `${i}` }));
  await assert.rejects(discoverTodayRecurring(large.input), { code: 'RECOVERY_BATCH_TOO_LARGE' });
  const unconfigured = fixture(); unconfigured.input.groupToken = '';
  await assert.rejects(discoverTodayRecurring(unconfigured.input), { code: 'RECURRING_PAGE_NOT_CONFIGURED' });
});

function httpFixture() {
  const f = fixture(new Date()); let state = { revision: 1, payload: f.payload }, role = 'MANAGER';
  const env = { CLUB_ID: 'test', RIVHIT_ENVIRONMENT: 'production', PUBLIC_APP_URL: 'https://club.test/',
    PAYMENT_SIGNING_SECRET: 'fixture-only-signing-key', RIVHIT_GROUP_PRIVATE_TOKEN: 'fixture-normal-page', RIVHIT_RECURRING_GROUP_PRIVATE_TOKEN: 'fixture-private-page',
    STATE_STORE: { getSession: async () => ({ club_id: 'test', user_id: 'manager' }), getAccount: async () => ({ user_id: 'manager', role }),
      getClubState: async () => state, putClubState: async (_, payload, revision) => {
        if (revision !== state.revision) return { conflict: true }; state = { payload, revision: revision + 1 }; return { conflict: false };
      } },
    RIVHIT_FETCH: async (url, options) => Response.json(await f.input.post(new URL(url).pathname.split('.svc')[1], JSON.parse(options.body))) };
  const request = body => worker.fetch(new Request('https://club.test/api/payments/rivhit/admin/recurring-recovery', {
    method: 'POST', headers: { Cookie: 'baly_session=fixture', 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }), env);
  return { ...f, env, request, state: () => state, asTrainee: () => { role = 'TRAINEE'; } };
}

test('manager preview is read-only, confirm revalidates and activates pending without receipt; repeated confirmation is idempotent', async () => {
  const f = httpFixture(); const first = await f.request({ action: 'preview' }); assert.equal(first.status, 200);
  const preview = await first.json(); assert.equal(preview.items[0].status, 'VERIFIED'); assert.equal(preview.day, clubDate(new Date()));
  assert.equal(f.state().payload.users[0].membershipStatus, 'DEBT'); assert.equal(f.state().revision, 1);
  const confirm = { action: 'confirm', checkedAt: preview.checkedAt, confirmationKey: preview.confirmationKey };
  const applied = await f.request(confirm); assert.equal(applied.status, 200); assert.equal((await applied.json()).results[0].status, 'SYNCED');
  assert.equal(f.state().payload.users[0].membershipStatus, 'ACTIVE'); assert.equal(f.state().payload.users[0].recurringMemberships.GROUP_ANNUAL.status, 'PENDING_FIRST_CHARGE');
  assert.equal(f.state().payload.payments.length, 0); const messages = f.state().payload.messages.length;
  assert.equal((await f.request(confirm)).status, 200); assert.equal(f.state().payload.messages.length, messages);
});

test('changed provider amounts, expired preview, forged confirmation and trainee cannot apply recovery', async () => {
  const f = httpFixture(); const preview = await (await f.request({ action: 'preview' })).json();
  const confirm = { action: 'confirm', checkedAt: preview.checkedAt, confirmationKey: preview.confirmationKey };
  assert.equal((await f.request({ ...confirm, confirmationKey: 'forged' })).status, 409);
  assert.equal((await f.request({ ...confirm, checkedAt: Date.now() - 11 * 60_000 })).status, 409);
  f.details.Amount = 10; assert.equal((await f.request(confirm)).status, 409); assert.equal(f.state().revision, 1);
  f.asTrainee(); assert.equal((await f.request({ action: 'preview' })).status, 403);
});

test('another club cannot use the configured merchant to recover or read its instructions', async () => {
  const f = httpFixture(); f.env.CLUB_ID = 'another-club';
  assert.equal((await f.request({ action: 'preview' })).status, 403); assert.equal(f.calls.length, 0);
});

test('recovery replaces an expired primary plan but preserves an unrelated current paid primary plan', async () => {
  for (const expired of [true, false]) {
    const f = httpFixture(); Object.assign(f.payload.users[0], { membershipType: expired ? 'GROUP_MONTHLY' : 'WORKOUT_PLAN',
      membershipStatus: 'ACTIVE', membershipExpiry: expired ? clubDate(new Date()) : '2099-01-01', membershipExpiryExclusive: true });
    const preview = await (await f.request({ action: 'preview' })).json();
    assert.equal((await f.request({ action: 'confirm', checkedAt: preview.checkedAt, confirmationKey: preview.confirmationKey })).status, 200);
    assert.equal(f.state().payload.users[0].membershipType, expired ? 'GROUP_ANNUAL' : 'WORKOUT_PLAN');
    assert.equal(f.state().payload.users[0].recurringMemberships.GROUP_ANNUAL.status, 'PENDING_FIRST_CHARGE');
  }
});

test('actual verified history creates one receipt and never multiplies it on repeated bulk synchronization', async () => {
  const f = httpFixture(); f.details.ChargeCount = 1;
  f.setHistory({ error_code: 0, RecurringSaleHistoryList: [{ Amount: 5, Timestamp: f.input.now.toISOString(),
    StatusCode: 3, RivhitCode: 0, DocumentLink: 'https://api.rivhit.co.il/pdf/fixture/02_000001' }] });
  const preview = await (await f.request({ action: 'preview' })).json();
  const confirmation = { action: 'confirm', checkedAt: preview.checkedAt, confirmationKey: preview.confirmationKey };
  assert.equal((await f.request(confirmation)).status, 200); assert.equal((await f.request(confirmation)).status, 200);
  assert.equal(f.state().payload.payments.length, 1); assert.equal(f.state().payload.payments[0].amount, 5);
  assert.equal(f.state().payload.users[0].recurringMemberships.GROUP_ANNUAL.status, 'ACTIVE');
});

test('a shared signed family instruction is one recovery operation with separate pending entitlements', async () => {
  const f = httpFixture(); f.payload.users.push({ id: 'child', role: 'TRAINEE', name: 'Child', familyPayerId: 'u' });
  f.order.gp = [{ memberId: 'u', memberName: 'Fixture', membershipType: 'GROUP_ANNUAL', amount: 2, mode: 'PRIMARY' },
    { memberId: 'child', memberName: 'Child', membershipType: 'OPEN_GYM', amount: 3, mode: 'PRIMARY' }];
  const preview = await (await f.request({ action: 'preview' })).json();
  assert.equal(preview.items.length, 1); assert.equal(preview.items[0].status, 'VERIFIED');
  const response = await f.request({ action: 'confirm', checkedAt: preview.checkedAt, confirmationKey: preview.confirmationKey });
  assert.equal((await response.json()).results[0].status, 'SYNCED');
  assert.equal(f.state().payload.users[0].recurringMemberships.GROUP_ANNUAL.amount, 2);
  assert.equal(f.state().payload.users.find(user => user.id === 'child').recurringMemberships.OPEN_GYM.amount, 3);
  assert.equal(f.state().payload.payments.length, 0);
});
