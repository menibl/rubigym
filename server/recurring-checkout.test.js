import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { inspectRecurringCheckout } from './index.js';
import { reconcileRecurringDaily } from './recurring-reconciliation.js';
import { openRecurringCheckout, readRecurringContinuation, saveRecurringContinuation, releaseUndispatchedRecurringCheckout, updateRecurringCheckout } from './recurring-checkout.js';
import { clubDate, nextMonthStart } from '../shared/membership-calendar.js';

function fixture() {
  let state = { revision: 1, payload: { users: [{ id: 'u', name: 'Test User', role: 'TRAINEE', membershipType: 'OPEN_GYM', membershipStatus: 'DEBT' },
    { id: 'm', name: 'Manager', role: 'MANAGER' }], payments: [], messages: [], settings: { membershipPlans: [
      { id: 'OPEN_GYM', label: 'Open recurring', price: 280, active: true, billingPeriod: 'MONTHLY_ANNUAL_COMMITMENT', paymentMode: 'RECURRING' }
    ] } } };
  let actor = 'u', signedOrder, submitted = false, charge = 0, unavailable = false, failCreation = false;
  const calls = [], rows = new Map();
  const group = '11111111-1111-4111-8111-111111111111', publicId = '22222222-2222-4222-8222-222222222222';
  const page = `https://icredit.rivhit.co.il/payment/PaymentItems.aspx?GroupId=${group}&Token=${publicId}`;
  const sale = () => ({ SaleId: 'fixture-sale', Custom1: signedOrder, Amount: 280, TransactionAmount: 280, GroupId: group,
    RecurringId: submitted ? 'fixture-series' : null, RecurringSaleChargeNumber: submitted ? charge : undefined,
    TransactionParamJ: submitted ? charge ? 0 : 5 : undefined, TransactionStatus: submitted ? 0 : null,
    CustomerTransactionId: submitted ? `fixture-tx-${charge}` : 'initial-record-id-is-not-a-charge' });
  const store = {
    getRecurringContinuation: async (_club, order) => rows.get(order) || null,
    saveRecurringContinuation: async (_club, order, user, encrypted) => { rows.set(order, { user_id: user, encrypted_checkout: encrypted }); },
    getClubState: async () => structuredClone(state),
    putClubState: async (_club, payload, revision) => {
      if (state.revision !== revision) return { conflict: true };
      state = { payload, revision: revision + 1 }; return { conflict: false, revision: state.revision };
    },
    getSession: async () => ({ club_id: 'test', user_id: actor }),
    getAccount: async () => ({ user_id: actor, role: actor === 'm' ? 'MANAGER' : 'TRAINEE' })
  };
  const env = { STATE_STORE: store, CLUB_ID: 'test', PUBLIC_APP_URL: 'https://club.test/',
    RIVHIT_ENVIRONMENT: 'production', PAYMENT_SIGNING_SECRET: 'fixture-signing-key',
    RIVHIT_GROUP_PRIVATE_TOKEN: 'fixture-one-off', RIVHIT_RECURRING_GROUP_PRIVATE_TOKEN: 'fixture-recurring',
    RIVHIT_ENABLE_RECURRING: 'true', RIVHIT_RECURRING_CALENDAR_VERIFIED: 'true',
    RIVHIT_FETCH: async (url, init) => {
      const body = JSON.parse(init.body); calls.push({ url, body });
      if (url.endsWith('/GetUrl')) { signedOrder = body.Custom1; if (failCreation) throw new Error('fixture-unknown-timeout');
        return Response.json({ Status: 0, URL: page, PrivateSaleToken: 'fixture-private', PublicSaleToken: publicId }); }
      if (url.endsWith('/SaleDetails')) { if (unavailable) throw new Error('fixture-read-timeout'); return Response.json({ Status: 0, data: [sale()] }); }
      if (url.endsWith('/Verify')) return Response.json({ Status: 'VERIFIED' });
      throw new Error('Unexpected provider mutation');
    } };
  const post = (path, body) => worker.fetch(new Request(`https://club.test/api/payments/rivhit/${path}`, {
    method: 'POST', headers: { Cookie: 'baly_session=fixture', 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }), env);
  const create = (patch = {}) => post('create', { userId: 'u', userName: 'Test User', membershipType: 'OPEN_GYM', mode: 'PRIMARY', recurringAcknowledged: true, ...patch });
  return { env, store, rows, calls, page, create, post, state: () => state, edit: update => update(state.payload),
    actor: value => { actor = value; }, submitted: number => { submitted = true; charge = number; },
    unavailable: () => { unavailable = true; }, failCreation: () => { failCreation = true; } };
}

test('back from unpaid page and retry resumes the exact same hosted page across browser restarts, without activation', async () => {
  const f = fixture(); const first = await (await f.create()).json();
  f.edit(payload => { payload.settings.membershipPlans[0].price = 500; });
  const repeat = await f.create({ recurringAcknowledged: false, discountCode: 'NEW-PRICE-MUST-NOT-APPLY' });
  assert.equal(repeat.status, 200, await repeat.clone().text());
  const resumed = await repeat.json(); assert.equal(resumed.resumed, true); assert.equal(resumed.url, first.url);
  assert.equal(resumed.resumeSummary.amount, 280); assert.equal(resumed.resumeSummary.discountCode, null);
  assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
  assert.equal(f.state().payload.users[0].membershipStatus, 'DEBT'); assert.equal(f.state().payload.payments.length, 0);
  const shared = JSON.stringify(f.state().payload);
  assert.ok(!shared.includes(first.paymentReference)); assert.ok(!shared.includes('fixture-private')); assert.ok(!shared.includes(first.url));
  assert.ok(!JSON.stringify([...f.rows.values()]).includes('fixture-private'));
});

test('self-service status and resume use the authenticated owner and the original encrypted page only', async () => {
  const f = fixture(); const first = await (await f.create()).json();
  const status = await f.post('checkout-recovery', { action: 'status', userId: 'someone-else' });
  assert.equal(status.status, 200);
  const result = await status.json(); assert.equal(result.items.length, 1);
  const item = result.items[0]; assert.equal(item.canRestart, false);
  const redacted = JSON.stringify(result);
  for (const privateValue of [first.paymentReference, first.url, 'fixture-private']) assert.ok(!redacted.includes(privateValue));
  f.actor('m');
  assert.deepEqual((await (await f.post('checkout-recovery', { action: 'status', userId: 'u' })).json()).items, []);
  assert.equal((await f.post('checkout-recovery', { action: 'resume', orderId: item.id, userId: 'u' })).status, 404);
  f.actor('u');
  const resumed = await f.post('checkout-recovery', { action: 'resume', orderId: item.id,
    userId: 'someone-else', url: 'https://attacker.invalid/', planAmount: 1 });
  assert.equal(resumed.status, 200, await resumed.clone().text());
  assert.equal((await resumed.json()).url, first.url);
  assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
  assert.equal(f.state().payload.payments.length, 0);
  assert.equal(f.state().payload.users[0].membershipStatus, 'DEBT');
  assert.equal((await f.post('checkout-recovery', { action: 'restart', orderId: item.id, confirmUndispatched: true })).status, 409);
  f.submitted(0);
  const approved = await f.post('checkout-recovery', { action: 'resume', orderId: item.id });
  assert.equal((await approved.json()).completed, true);
  assert.deepEqual((await (await f.post('checkout-recovery', { action: 'status' })).json()).items, []);
  assert.equal(f.state().payload.users[0].recurringMemberships.OPEN_GYM.status, 'PENDING_FIRST_CHARGE');
  assert.equal(f.state().payload.payments.length, 0);
});

test('customer restart releases only a proven never-dispatched reservation, then permits a fresh checkout', async () => {
  const f = fixture();
  f.edit(payload => { payload.recurringCheckouts = [{ orderId: 'never-sent', userId: 'u', membershipType: 'OPEN_GYM',
    stage: 'RESERVED', dispatchedAt: '2020-01-01T00:00:00Z', endsAt: '2099-01-01',
    orderSnapshot: { o: 'never-sent', u: 'u', m: 'OPEN_GYM', rc: 1 } }]; });
  const status = await (await f.post('checkout-recovery', { action: 'status' })).json();
  assert.equal(status.items[0].canRestart, true);
  assert.equal((await f.post('checkout-recovery', { action: 'restart', orderId: 'never-sent' })).status, 409);
  const response = await f.post('checkout-recovery', { action: 'restart', orderId: 'never-sent', confirmUndispatched: true });
  assert.equal(response.status, 200);
  assert.equal(f.state().payload.recurringCheckouts[0].cancelledBy, 'u');
  assert.equal(f.state().payload.recurringCheckouts[0].stage, 'RELEASED_UNDISPATCHED');
  assert.equal(f.calls.length, 0);
  assert.equal((await f.create()).status, 200);
  assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
});

test('payment retry automatically releases a proven never-dispatched reservation without manager action', async () => {
  const f = fixture();
  f.edit(payload => { payload.recurringCheckouts = [{ orderId: 'never-sent', userId: 'u', membershipType: 'OPEN_GYM',
    stage: 'RESERVED', dispatchedAt: '2020-01-01T00:00:00Z', endsAt: '2099-01-01',
    orderSnapshot: { o: 'never-sent', u: 'u', m: 'OPEN_GYM', rc: 1 } }]; });
  const response = await f.create();
  assert.equal(response.status, 200, await response.clone().text());
  const old = f.state().payload.recurringCheckouts.find(item => item.orderId === 'never-sent');
  assert.equal(old.stage, 'RELEASED_UNDISPATCHED');
  assert.equal(old.releaseReason, 'AUTO_RETRY_VERIFIED_NEVER_DISPATCHED');
  assert.equal(old.cancelledBy, 'u');
  assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
  assert.equal(f.state().payload.payments.length, 0);
  assert.equal(f.state().payload.users[0].membershipStatus, 'DEBT');
});

test('continuation of a never-dispatched reservation releases it automatically without creating a provider page', async () => {
  const f = fixture();
  f.edit(payload => { payload.recurringCheckouts = [{ orderId: 'not-sent', userId: 'u', membershipType: 'OPEN_GYM',
    stage: 'RESERVED', dispatchedAt: '2020-01-01T00:00:00Z', endsAt: '2099-01-01',
    orderSnapshot: { o: 'not-sent', u: 'u', m: 'OPEN_GYM', rc: 1 } }]; });
  // A passive read still never changes the reservation.
  await f.post('checkout-recovery', { action: 'status' });
  assert.equal(f.state().payload.recurringCheckouts[0].cancelledAt, undefined);
  const response = await f.post('checkout-recovery', { action: 'resume', orderId: 'not-sent' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).released, true);
  assert.equal(f.calls.length, 0);
  assert.equal(f.state().payload.recurringCheckouts[0].stage, 'RELEASED_UNDISPATCHED');
});

test('automatic release never trusts an unknown, fresh, dispatched, linked or stored-page reservation', async () => {
  for (const variation of ['unknown', 'fresh', 'dispatched', 'linked', 'stored', 'family', 'group', 'contract', 'receipt', 'other-owner']) {
    const f = fixture();
    f.edit(payload => {
      const item = { orderId: 'unsafe', userId: 'u', membershipType: 'OPEN_GYM', stage: 'RESERVED',
        dispatchedAt: '2020-01-01T00:00:00Z', endsAt: '2099-01-01',
        orderSnapshot: { o: 'unsafe', u: 'u', m: 'OPEN_GYM', rc: 1 } };
      if (variation === 'unknown') delete item.stage;
      if (variation === 'fresh') item.dispatchedAt = new Date().toISOString();
      if (variation === 'dispatched') item.requestDispatchedAt = '2020-01-01T00:00:00Z';
      if (variation === 'linked') item.recurringSaleId = 'some-series';
      if (variation === 'family') item.orderSnapshot.bs = 'batch';
      if (variation === 'group') item.orderSnapshot.gp = [{ memberId: 'u', membershipType: 'OPEN_GYM' }];
      if (variation === 'contract') payload.users[0].recurringMemberships = { OPEN_GYM: { orderId: 'unsafe', status: 'FAILED' } };
      if (variation === 'receipt') payload.payments.push({ recurringOrderId: 'unsafe', status: 'PAID' });
      if (variation === 'other-owner') item.orderSnapshot.u = 'someone-else';
      payload.recurringCheckouts = [item];
    });
    if (variation === 'stored') f.rows.set('unsafe', { user_id: 'u', encrypted_checkout: 'unreadable-but-present' });
    await f.create();
    assert.equal(f.state().payload.recurringCheckouts[0].cancelledAt, undefined, variation);
    assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 0, variation);
  }
});

test('automatic payment retry cannot release a reservation that concurrently starts dispatch', async () => {
  const f = fixture();
  f.edit(payload => { payload.recurringCheckouts = [{ orderId: 'race-auto', userId: 'u', membershipType: 'OPEN_GYM',
    stage: 'RESERVED', dispatchedAt: '2020-01-01T00:00:00Z', endsAt: '2099-01-01',
    orderSnapshot: { o: 'race-auto', u: 'u', m: 'OPEN_GYM', rc: 1 } }]; });
  const put = f.store.putClubState; let race = true;
  f.store.putClubState = async (club, payload, revision) => {
    if (!race) return put(club, payload, revision);
    race = false;
    const latest = structuredClone(f.state().payload);
    Object.assign(latest.recurringCheckouts[0], { stage: 'DISPATCHED', requestDispatchedAt: new Date().toISOString() });
    await put(club, latest, revision);
    return { conflict: true };
  };
  const response = await f.create(); assert.equal(response.status, 409);
  assert.equal(f.state().payload.recurringCheckouts[0].cancelledAt, undefined);
  assert.equal(f.calls.length, 0);
});

test('an existing authenticated account can resume its historical registration checkout without registering again', async () => {
  const f = fixture(); const first = await (await f.create({ mode: 'REGISTRATION' })).json();
  const orderId = f.state().payload.recurringCheckouts[0].orderId;
  const response = await f.post('checkout-recovery', { action: 'resume', orderId });
  assert.equal(response.status, 200, await response.clone().text());
  const result = await response.json();
  assert.equal(result.url, first.url); assert.equal(result.resumeSummary.mode, 'REGISTRATION');
  f.submitted(0);
  const approved = await f.post('checkout-recovery', { action: 'resume', orderId });
  assert.equal(approved.status, 200, await approved.clone().text());
  assert.equal((await approved.json()).completed, true);
  assert.equal(f.state().payload.users[0].membershipStatus, 'ACTIVE');
  assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
});

test('a concurrent dispatch wins over customer restart and does not release the request', async () => {
  const f = fixture();
  f.edit(payload => { payload.recurringCheckouts = [{ orderId: 'race', userId: 'u', membershipType: 'OPEN_GYM',
    stage: 'RESERVED', dispatchedAt: '2020-01-01T00:00:00Z', endsAt: '2099-01-01',
    orderSnapshot: { o: 'race', u: 'u', m: 'OPEN_GYM', rc: 1 } }]; });
  const put = f.store.putClubState; let race = true;
  f.store.putClubState = async (club, payload, revision) => {
    if (!race) return put(club, payload, revision);
    race = false;
    const latest = structuredClone(f.state().payload);
    latest.recurringCheckouts[0].stage = 'DISPATCHED'; latest.recurringCheckouts[0].requestDispatchedAt = new Date().toISOString();
    await put(club, latest, revision);
    return { conflict: true };
  };
  assert.equal((await f.post('checkout-recovery', { action: 'restart', orderId: 'race', confirmUndispatched: true })).status, 409);
  assert.equal(f.state().payload.recurringCheckouts[0].cancelledAt, undefined);
  assert.equal(f.state().payload.recurringCheckouts[0].stage, 'DISPATCHED');
  assert.equal(f.calls.length, 0);
});

test('self-service continuation ignores only a verified series for another family beneficiary', async () => {
  const f = fixture(); const first = await (await f.create()).json();
  const seriesId = '11111111-1111-4111-8111-111111111111';
  const orderId = f.state().payload.recurringCheckouts[0].orderId;
  f.edit(payload => {
    payload.users[0].phone = '0541234567';
    payload.users.push({ id: 'child', recurringMemberships: { GROUP_ANNUAL: { seriesId, orderId: 'old-child',
      status: 'ACTIVE', endsAt: '2099-01-01', approvedAt: '2026-01-01T12:00:00Z', events: ['PAID:fixture:1'] } } });
    payload.recurringCheckouts.push({ orderId: 'old-child', userId: 'child', membershipType: 'GROUP_ANNUAL',
      recurringSaleId: seriesId, endsAt: '2099-01-01', orderSnapshot: { o: 'old-child', u: 'u', bu: 'child', m: 'GROUP_ANNUAL', re: '2099-01-01', rc: 1 } });
  });
  const original = f.env.RIVHIT_FETCH;
  f.env.RIVHIT_FETCH = async (url, init) => url.endsWith('/SaleDetails') ? Response.json({ Status: 0, data: [] })
    : url.endsWith('/RecurringSaleList') ? Response.json({ RecurringSales: [{ RecurringSaleId: seriesId, IsActive: true }] }) : original(url, init);
  const resumed = await f.post('checkout-recovery', { action: 'resume', orderId });
  assert.equal(resumed.status, 200, await resumed.clone().text());
  assert.equal((await resumed.json()).url, first.url);
  assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
  assert.deepEqual(f.state().payload.payments, []);
});

test('an approved setup with empty page details synchronizes only with strict provider card and ownership evidence', async () => {
  for (const cardApproved of [true, false]) {
    const f = fixture();
    f.edit(payload => { payload.users[0].phone = '0541234567'; });
    await f.create();
    const checkout = f.state().payload.recurringCheckouts[0];
    const seriesId = '11111111-1111-4111-8111-111111111111';
    const original = f.env.RIVHIT_FETCH;
    f.env.RIVHIT_FETCH = async (url, init) => {
      if (url.endsWith('/SaleDetails')) return Response.json({ Status: 0, data: [] });
      if (url.endsWith('/RecurringSaleList')) return Response.json({ RecurringSales: [{ RecurringSaleId: seriesId, IsActive: true }] });
      if (url.endsWith('/RecurringSaleDetails')) return Response.json({ Amount: checkout.orderSnapshot.a, PhoneNumber: '0541234567',
        Token: cardApproved ? 'fixture-card-proof' : null, AutoCharge: true, IsActive: true, Currency: 1, ProRata: false,
        RecurringCycle: 3, RecurringDay: 1, RecurringStep: 1, RecurringSaleCount: 12, ChargeCount: 0,
        CreationDate: checkout.dispatchedAt,
        EndDate: new Date(Date.UTC(Number(checkout.endsAt.slice(0, 4)), Number(checkout.endsAt.slice(5, 7)) - 2, 1)).toISOString(),
        IpnUrl: 'https://club.test/api/payments/rivhit/webhook' });
      if (url.endsWith('/RecurringSaleHistory')) return Response.json({ RecurringSaleHistoryList: [] });
      return original(url, init);
    };
    const response = await f.post('checkout-recovery', { action: 'resume', orderId: checkout.orderId });
    assert.equal(response.status, cardApproved ? 200 : 409, await response.clone().text());
    if (cardApproved) assert.equal((await response.json()).completed, true);
    assert.equal(f.state().payload.users[0].membershipStatus, cardApproved ? 'ACTIVE' : 'DEBT');
    assert.equal(f.state().payload.payments.length, 0);
    assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
  }
});

test('incomplete pre-card SaleDetails resumes only the encrypted original page after a complete negative lookup', async () => {
  for (const shape of ['empty', 'missing-order', 'zero-transaction']) {
    const f = fixture(); f.edit(payload => { payload.users[0].phone = '0541234567'; });
    const first = await (await f.create()).json();
    const original = f.env.RIVHIT_FETCH;
    f.env.RIVHIT_FETCH = async (url, init) => {
      if (url.endsWith('/RecurringSaleList')) { f.calls.push({ url, body: JSON.parse(init.body) }); return Response.json({ RecurringSales: [] }); }
      const response = await original(url, init);
      if (!url.endsWith('/SaleDetails')) return response;
      const result = await response.json();
      if (shape === 'empty') result.data = [];
      if (shape === 'missing-order') delete result.data[0].Custom1;
      if (shape === 'zero-transaction') result.data[0].TransactionAmount = 0;
      return Response.json(result);
    };
    const response = await f.create();
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal((await response.json()).url, first.url);
    assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
    assert.equal(f.calls.filter(call => call.url.endsWith('/RecurringSaleList')).length, 1);
    assert.equal(f.state().payload.users[0].membershipStatus, 'DEBT'); assert.deepEqual(f.state().payload.payments, []);
  }
});

test('incomplete details cannot resume through an active series, missing phone, malformed list or provider outage', async () => {
  for (const scenario of ['active', 'missing-phone', 'invalid', 'outage']) {
    const f = fixture(); f.edit(payload => { payload.users[0].phone = scenario === 'missing-phone' ? '' : '0541234567'; });
    await f.create();
    const original = f.env.RIVHIT_FETCH;
    f.env.RIVHIT_FETCH = async (url, init) => {
      if (url.endsWith('/SaleDetails')) return Response.json({ Status: 0, data: [] });
      if (url.endsWith('/RecurringSaleList')) {
        if (scenario === 'outage') throw new Error('fixture-timeout');
        return Response.json(scenario === 'invalid' ? {} : { RecurringSales: [{ RecurringSaleId: '11111111-1111-4111-8111-111111111111', IsActive: true }] });
      }
      return original(url, init);
    };
    const response = await f.create(); assert.equal(response.status, 409);
    assert.match((await response.json()).reasonCode, /^CONTINUATION_/);
    assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
    assert.deepEqual(f.state().payload.payments, []);
  }
});

test('gross TransactionAmount takes precedence over a net Amount; explicit order/amount conflicts still block', async () => {
  for (const mismatch of [null, 'amount', 'order']) {
    const f = fixture(); const first = await (await f.create()).json();
    const original = f.env.RIVHIT_FETCH;
    f.env.RIVHIT_FETCH = async (url, init) => {
      const response = await original(url, init);
      if (!url.endsWith('/SaleDetails')) return response;
      const result = await response.json(); result.data[0].Amount = 237.29;
      if (mismatch === 'amount') result.data[0].TransactionAmount = 999;
      if (mismatch === 'order') result.data[0].Custom1 = 'different-order';
      return Response.json(result);
    };
    const response = await f.create(); assert.equal(response.status, mismatch ? 409 : 200);
    const outcome = await response.json();
    if (mismatch) assert.equal(outcome.reasonCode, mismatch === 'amount' ? 'CONTINUATION_AMOUNT_MISMATCH' : 'CONTINUATION_ORDER_MISMATCH');
    else assert.equal(outcome.url, first.url);
    assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
  }
});

test('legacy request recovers the same page from its original signed browser reference, not another GetUrl', async () => {
  const f = fixture(); const first = await (await f.create()).json(); f.rows.clear();
  f.edit(payload => { delete payload.recurringCheckouts[0].stage; delete payload.recurringCheckouts[0].requestDispatchedAt; });
  const blocked = await f.create(); assert.equal(blocked.status, 409);
  const response = await f.create({ pendingPaymentReference: first.paymentReference });
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await response.json()).url, first.url); assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
  assert.equal(f.rows.size, 1); assert.equal(f.state().payload.payments.length, 0);
});

test('forged legacy reference and provider timeout keep the original guard without creating another page', async () => {
  const f = fixture(); const first = await (await f.create()).json(); f.rows.clear();
  assert.equal((await f.create({ pendingPaymentReference: `${first.paymentReference}tampered` })).status, 409);
  assert.equal(f.rows.size, 0); f.unavailable();
  assert.equal((await f.create({ pendingPaymentReference: first.paymentReference })).status, 409);
  assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
});

test('a recurring setup completed meanwhile is synchronized instead of redirecting to card entry again', async () => {
  const f = fixture(); await f.create(); f.submitted(0);
  const response = await f.create(); assert.equal(response.status, 200);
  assert.equal((await response.json()).completed, true);
  assert.equal(f.state().payload.users[0].recurringMemberships.OPEN_GYM.status, 'PENDING_FIRST_CHARGE');
  assert.equal(f.state().payload.payments.length, 0); assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
});

test('delayed provider setup opens access automatically on the next minute without another checkout or receipt', async () => {
  const f = fixture(); const created = await (await f.create()).json();
  const pending = await f.post('verify', { paymentReference: created.paymentReference });
  assert.equal(pending.status, 409); assert.equal((await pending.json()).code, 'RIVHIT_RECURRING_PENDING');
  assert.equal(f.state().payload.users[0].membershipStatus, 'DEBT');
  const claims = new Set();
  f.store.getAllClubStates = async () => [{ club_id: 'test', payload: f.state().payload }];
  f.store.claimPushDelivery = async (_, key) => { if (claims.has(key)) return false; claims.add(key); return true; };
  const start = Date.parse(f.state().payload.recurringCheckouts[0].dispatchedAt);
  await reconcileRecurringDaily(f.store, f.env, inspectRecurringCheckout, new Date(start + 1000));
  assert.equal(f.state().payload.users[0].membershipStatus, 'DEBT');
  f.submitted(0);
  await reconcileRecurringDaily(f.store, f.env, inspectRecurringCheckout, new Date(start + 61_000));
  const user = f.state().payload.users[0];
  assert.equal(user.membershipStatus, 'ACTIVE'); assert.equal(user.recurringMemberships.OPEN_GYM.status, 'PENDING_FIRST_CHARGE');
  assert.equal(f.state().payload.payments.length, 0);
  assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
  const messages = f.state().payload.messages.length;
  await reconcileRecurringDaily(f.store, f.env, inspectRecurringCheckout, new Date(start + 121_000));
  assert.equal(f.state().payload.messages.length, messages);
});

test('a different real payment recorded meanwhile blocks unpaid-page continuation rather than charging the month twice', async () => {
  const f = fixture(); await f.create();
  f.edit(payload => { payload.payments.push({ id: 'real-cash', traineeId: 'u', status: 'PAID', membershipTypePurchased: 'OPEN_GYM', amount: 280, date: clubDate(), timestamp: new Date().toISOString() }); });
  const response = await f.create(); assert.equal(response.status, 409);
  assert.match((await response.json()).message, /תשלום כפול/);
  assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1); assert.equal(f.state().payload.payments.length, 1);
});

test('paid checkout syncs once, unrelated users cannot resume, and managers only receive redacted inspection', async () => {
  const f = fixture(); await f.create();
  f.actor('m'); const list = await (await f.post('admin/recurring-checkouts', { userId: 'u' })).json();
  assert.equal(list.items.length, 1); assert.equal(list.items[0].canRelease, false);
  const result = await (await f.post('admin/recurring-checkouts', { action: 'inspect', userId: 'u', orderId: list.items[0].orderId })).json();
  assert.match(result.message, /דף תשלום שמור/); assert.equal(result.url, undefined); assert.equal(result.paymentReference, undefined);
  assert.equal((await f.create()).status, 403);
  f.actor('u'); assert.equal((await f.post('admin/recurring-checkouts', { userId: 'u' })).status, 403);
  f.submitted(1); assert.equal((await f.create()).status, 200); assert.equal((await f.create()).status, 200);
  assert.equal(f.state().payload.payments.length, 1); assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
});

test('unknown creation timeout cannot be retried or released merely because time passed', async () => {
  const f = fixture(); f.failCreation(); assert.equal((await f.create()).status, 502);
  f.edit(payload => { payload.recurringCheckouts[0].dispatchedAt = '2020-01-01T00:00:00Z'; });
  assert.equal((await f.create()).status, 409);
  const item = f.state().payload.recurringCheckouts[0];
  assert.equal(await releaseUndispatchedRecurringCheckout(f.store, 'test', 'u', item.orderId, 'm', 'Safe review attempt'), false);
  assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
});

test('an expired quote with unknown provider state is not implicitly released to create another live page', () => {
  const old = { orderId: 'old', userId: 'u', membershipType: 'OPEN_GYM', endsAt: '2020-01-01', stage: 'DISPATCHED' };
  assert.equal(openRecurringCheckout({ recurringCheckouts: [old] }, 'u', 'OPEN_GYM'), old);
  assert.equal(openRecurringCheckout({ recurringCheckouts: [{ ...old, recurringSaleId: 'approved-series' }] }, 'u', 'OPEN_GYM'), undefined);
});

test('encrypted continuations reject wrong user, key and order and never enter public club state', async () => {
  const f = fixture();
  await saveRecurringContinuation(f.store, 'fixture-key', 'test', 'o', 'u', { url: f.page, paymentReference: 'fixture-private-reference' });
  assert.equal((await readRecurringContinuation(f.store, 'fixture-key', 'test', 'o', 'u')).url, f.page);
  await assert.rejects(readRecurringContinuation(f.store, 'fixture-key', 'test', 'o', 'other'));
  await assert.rejects(readRecurringContinuation(f.store, 'wrong-key', 'test', 'o', 'u'));
  f.rows.set('other-order', f.rows.get('o'));
  await assert.rejects(readRecurringContinuation(f.store, 'fixture-key', 'test', 'other-order', 'u'));
});

test('only never-dispatched stale reservations can release, and release races atomically with dispatch', async () => {
  const f = fixture();
  f.edit(payload => { payload.recurringCheckouts = [{ orderId: 'o', userId: 'u', membershipType: 'OPEN_GYM', stage: 'RESERVED',
    endsAt: nextMonthStart(clubDate()), dispatchedAt: '2020-01-01T00:00:00Z' }];
    payload.discountCodes = [{ code: 'TEST', reservedRecurringOrderId: 'o' }]; });
  const [released, dispatched] = await Promise.all([
    releaseUndispatchedRecurringCheckout(f.store, 'test', 'u', 'o', 'm', 'Test reservation release'),
    updateRecurringCheckout(f.store, 'test', 'o', item => !item.cancelledAt && item.stage === 'RESERVED' ? { ...item, stage: 'DISPATCHED', requestDispatchedAt: new Date().toISOString() } : null)
  ]);
  assert.notEqual(released, dispatched);
  if (released) { assert.equal(f.state().payload.discountCodes[0].reservedRecurringOrderId, undefined); assert.equal(f.state().payload.recurringCheckouts[0].cancelledBy, 'm'); }
  const legacy = fixture(); legacy.edit(payload => { payload.recurringCheckouts = [{ orderId: 'old', userId: 'u', dispatchedAt: '2020-01-01T00:00:00Z' }]; });
  assert.equal(await releaseUndispatchedRecurringCheckout(legacy.store, 'test', 'u', 'old', 'm', 'Do not release legacy'), false);
});

test('manager release requires confirmation and a reason, audits only never-dispatched work and never calls provider cancellation', async () => {
  const f = fixture();
  f.edit(payload => { payload.recurringCheckouts = [{ orderId: 'never-sent', userId: 'u', membershipType: 'OPEN_GYM',
    stage: 'RESERVED', dispatchedAt: '2020-01-01T00:00:00Z', endsAt: nextMonthStart(clubDate()) }]; });
  const body = { userId: 'u', orderId: 'never-sent', action: 'release', reason: 'Verified not sent yet', confirmUndispatched: true };
  assert.equal((await f.post('admin/recurring-checkouts', body)).status, 403);
  f.actor('m'); assert.equal((await f.post('admin/recurring-checkouts', { ...body, confirmUndispatched: false })).status, 400);
  assert.equal((await f.post('admin/recurring-checkouts', { ...body, reason: '' })).status, 400);
  assert.equal((await f.post('admin/recurring-checkouts', body)).status, 200);
  assert.equal(f.state().payload.recurringCheckouts[0].cancelledBy, 'm'); assert.equal(f.calls.length, 0);
  assert.equal((await f.post('admin/recurring-checkouts', body)).status, 409);
});

test('authenticated pending payment references cannot be used to resume someone else reservation', async () => {
  const f = fixture(); const first = await (await f.create()).json(); f.rows.clear();
  f.actor('other'); assert.equal((await f.create({ pendingPaymentReference: first.paymentReference })).status, 403);
  assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
});
