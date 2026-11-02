import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.js';
import { hashPassword } from './auth.js';
import { checkStuckCheckout, releaseContext, releaseStuckCheckout } from './stuck-checkout-release.js';
import { openRecurringCheckout } from './recurring-checkout.js';

const password = 'Fixture-only-password';
const passwordHash = await hashPassword(password);
const series = '11111111-1111-4111-8111-111111111111';
function fixture() {
  const club = `release-${crypto.randomUUID()}`;
  let actor = 'manager', revision = 1;
  let payload = { users: [{ id: 'u', role: 'TRAINEE', phone: '0541234567', name: 'Fixture', membershipStatus: 'DEBT' },
    { id: 'manager', role: 'MANAGER', name: 'Manager' }], payments: [], messages: [],
    discountCodes: [{ code: 'FIXTURE', reservedRecurringOrderId: 'old' }],
    recurringCheckouts: [{ userId: 'u', orderId: 'old', membershipType: 'OPEN_GYM', endsAt: '2027-11-01',
      dispatchedAt: '2026-11-01T07:00:00Z', orderSnapshot: { o: 'old', u: 'u', m: 'OPEN_GYM', rc: 1, a: 280 } }] };
  const store = { getClubState: async () => ({ payload: structuredClone(payload), revision }),
    putClubState: async (_, next, expected) => {
      if (expected !== revision) return { conflict: true };
      payload = structuredClone(next); revision++; return { conflict: false };
    }, getSession: async () => ({ club_id: club, user_id: actor }),
    getAccount: async () => ({ user_id: actor, role: actor === 'manager' ? 'MANAGER' : 'TRAINEE', password_hash: passwordHash }) };
  const calls = [];
  let provider = { RecurringSales: [] };
  const env = { STATE_STORE: store, CLUB_ID: club, PUBLIC_APP_URL: 'https://club.test/', PAYMENT_SIGNING_SECRET: 'fixture-signing-only',
    RIVHIT_ENVIRONMENT: 'production', RIVHIT_GROUP_PRIVATE_TOKEN: series, RIVHIT_RECURRING_GROUP_PRIVATE_TOKEN: series,
    RIVHIT_FETCH: async (url, init) => {
      assert.ok(url.endsWith('/RecurringSaleList'), 'No charge, create or cancellation calls allowed');
      calls.push(JSON.parse(init.body));
      if (provider instanceof Error) throw provider;
      return Response.json(provider);
    } };
  const post = (body, origin = 'https://club.test') => worker.fetch(new Request('https://club.test/api/payments/rivhit/admin/stuck-checkout-release', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'baly_session=fixture', Origin: origin },
    body: JSON.stringify({ userId: 'u', orderId: 'old', ...body }) }), env);
  const confirmation = preview => ({ action: 'confirm', checkedAt: preview.checkedAt, confirmationKey: preview.confirmationKey,
    password, reason: 'Customer abandoned before submitting; checked with provider', providerReference: 'Support ticket fixture 2026-11-01',
    oldPageUnusable: true, noChargeOrInstruction: true });
  return { env, store, calls, post, confirmation, state: () => payload, edit: fn => fn(payload),
    actor: value => { actor = value; }, provider: value => { provider = value; } };
}

test('preview never releases; explicit manager evidence/password releases only the local request and preserves history', async () => {
  const f = fixture(), before = JSON.stringify(f.state());
  const response = await f.post({ action: 'preview' }); assert.equal(response.status, 200);
  const preview = await response.json(); assert.equal(JSON.stringify(f.state()), before);
  assert.ok(!JSON.stringify(preview).includes('0541234567'));
  assert.equal((await f.post(f.confirmation(preview))).status, 200);
  assert.equal(f.calls.length, 2); assert.equal(f.state().recurringCheckouts.length, 1);
  assert.equal(f.state().recurringCheckouts[0].stage, 'RELEASED_MANAGER_REVIEW');
  assert.equal(f.state().recurringCheckouts[0].cancelledBy, 'manager');
  assert.equal(f.state().recurringCheckouts[0].releaseEvidence.evidenceSource, 'MANAGER_ATTESTATION_WITH_NEGATIVE_PROVIDER_LIST');
  assert.equal(f.state().discountCodes[0].reservedRecurringOrderId, undefined);
  assert.equal(openRecurringCheckout(f.state(), 'u', 'OPEN_GYM'), undefined);
  assert.equal(f.state().users[0].membershipStatus, 'DEBT'); assert.deepEqual(f.state().payments, []); assert.deepEqual(f.state().messages, []);
  assert.ok(!JSON.stringify(f.state()).includes(password));
  assert.equal((await f.post(f.confirmation(preview))).status, 409);
});

test('active series, malformed/partial lookup or provider outage never become absence', async () => {
  for (const provider of [new Error('timeout'), { Status: 5 }, {}, { RecurringSales: null },
    { RecurringSales: [{ RecurringSaleId: series, IsActive: true }] }, { RecurringSales: [{ RecurringSaleId: series }] }]) {
    const f = fixture(); f.provider(provider); const before = JSON.stringify(f.state());
    assert.equal((await f.post({ action: 'preview' })).status, 409);
    assert.equal(JSON.stringify(f.state()), before);
  }
});

test('new provider instruction between preview and confirmation blocks release', async () => {
  const f = fixture(), preview = await (await f.post({ action: 'preview' })).json();
  f.provider({ RecurringSales: [{ RecurringSaleId: series, IsActive: true }] });
  assert.equal((await f.post(f.confirmation(preview))).status, 409);
  assert.equal(f.state().recurringCheckouts[0].cancelledAt, undefined);
});

test('password, evidence, both attestations and unexpired manager-bound preview are mandatory', async () => {
  for (const patch of [{ password: 'wrong' }, { providerReference: '' }, { reason: '' }, { oldPageUnusable: false },
    { noChargeOrInstruction: false }, { checkedAt: Date.now() - 6 * 60_000 }, { confirmationKey: 'forged' }]) {
    const f = fixture(), preview = await (await f.post({ action: 'preview' })).json();
    assert.notEqual((await f.post({ ...f.confirmation(preview), ...patch })).status, 200);
    assert.equal(f.state().recurringCheckouts[0].cancelledAt, undefined);
  }
  const f = fixture(), preview = await (await f.post({ action: 'preview' })).json();
  f.edit(payload => { payload.recurringCheckouts[0].orderSnapshot.a = 500; });
  assert.equal((await f.post(f.confirmation(preview))).status, 409);
});

test('trainees, wrong tenant and incorrect origins cannot invoke release', async () => {
  const f = fixture(); f.actor('u'); assert.equal((await f.post({ action: 'preview' })).status, 403);
  f.actor('manager'); assert.equal((await f.post({ action: 'preview' }, 'https://unrelated.test')).status, 403);
  f.env.CLUB_ID = 'another'; assert.equal((await f.post({ action: 'preview' })).status, 403);
  assert.equal(f.calls.length, 0);
});

test('password guessing is bounded before provider lookup', async () => {
  const f = fixture(), preview = await (await f.post({ action: 'preview' })).json();
  for (let i = 0; i < 5; i++) assert.equal((await f.post({ ...f.confirmation(preview), password: 'wrong' })).status, 403);
  assert.equal((await f.post(f.confirmation(preview))).status, 429); assert.equal(f.calls.length, 1);
});

test('paid, bound, cancelled, split or unidentified requests never release; all group members are checked', async () => {
  for (const mutate of [p => p.payments.push({ recurringOrderId: 'old', status: 'PAID' }),
    p => { p.users[1].recurringMemberships = { OPEN_GYM: { orderId: 'old' } }; },
    p => { p.recurringCheckouts[0].recurringSaleId = series; }, p => { p.recurringCheckouts[0].cancelledAt = '2026-11-01'; },
    p => { p.recurringCheckouts[0].orderSnapshot.bs = 'batch'; }, p => { p.users[0].phone = ''; }]) {
    const f = fixture(); f.edit(mutate); assert.equal((await f.post({ action: 'preview' })).status, 409); assert.equal(f.calls.length, 0);
  }
  const f = fixture(); f.edit(p => {
    p.users.push({ id: 'child', role: 'TRAINEE', phone: '0529999999' });
    p.recurringCheckouts[0].orderSnapshot.gp = [{ memberId: 'u' }, { memberId: 'child' }];
  });
  assert.equal((await f.post({ action: 'preview' })).status, 200);
  assert.deepEqual(f.calls.map(call => call.PhoneNumber).sort(), ['0529999999', '0541234567']);
});

test('CAS retries recheck local payment/contract guards rather than overwriting a concurrent completion', async () => {
  const f = fixture(), context = releaseContext(f.state(), 'u', 'old');
  const save = f.store.putClubState; let first = true;
  f.store.putClubState = async (...args) => {
    if (first) { first = false; f.edit(p => p.payments.push({ recurringOrderId: 'old', status: 'PAID' })); return { conflict: true }; }
    return save(...args);
  };
  await assert.rejects(releaseStuckCheckout(f.store, f.env.CLUB_ID, 'u', 'old', {
    managerId: 'manager', reason: 'fixture reason', providerReference: 'fixture reference', releasedAt: new Date().toISOString()
  }, context.fingerprint));
  assert.equal(f.state().recurringCheckouts[0].cancelledAt, undefined); assert.equal(f.state().payments.length, 1);
});

test('missing merchant and partial family phone failure fail closed', async () => {
  const f = fixture();
  await assert.rejects(checkStuckCheckout({ payload: f.state(), userId: 'u', orderId: 'old', post: async () => ({ RecurringSales: [] }) }));
  f.edit(p => { p.users[0].familyPayerId = 'payer'; p.users.push({ id: 'payer', phone: '0529999999' }); });
  let calls = 0;
  await assert.rejects(checkStuckCheckout({ payload: f.state(), userId: 'u', orderId: 'old', groupToken: series,
    post: async () => { if (++calls === 2) throw new Error('partial timeout'); return { RecurringSales: [] }; } }));
  assert.equal(f.state().recurringCheckouts[0].cancelledAt, undefined);
});

function splitFixture() {
  const f = fixture(); let revision = 1;
  f.edit(payload => { payload.recurringCheckouts[0].orderSnapshot = { ...payload.recurringCheckouts[0].orderSnapshot, bs: 'batch', bi: 'line' };
    payload.discountCodes[0] = { code: 'FIXTURE', reservedFamilySplitId: 'batch' }; });
  let batch = { id: 'batch', payerId: 'u', items: [{ id: 'line', memberId: 'u', status: 'PAGE', checkout: { paymentReference: 'fixture-private' } },
    { id: 'paid-other', memberId: 'someone-else', status: 'PAID' }] };
  f.store.getFamilySplitCheckout = async () => ({ payload: structuredClone(batch), revision });
  f.store.putFamilySplitCheckout = async (_, payerId, next, expected) => {
    assert.equal(payerId, 'u'); if (expected !== revision) return false;
    batch = structuredClone(next); revision++; return true;
  };
  return { ...f, batch: () => batch, changeBatch: fn => { fn(batch); revision++; } };
}

test('audited family release cancels only the selected journal line before releasing its reservation', async () => {
  const f = splitFixture();
  const response = await f.post({ action: 'preview' }); assert.equal(response.status, 200);
  const preview = await response.json();
  assert.ok(!JSON.stringify(preview).includes('fixture-private'));
  assert.equal((await f.post(f.confirmation(preview))).status, 200);
  assert.equal(f.batch().items[0].status, 'CANCELLED');
  assert.equal(f.batch().items[0].releasedOrderId, 'old');
  assert.equal(f.batch().items[1].status, 'PAID');
  assert.equal(f.state().recurringCheckouts[0].stage, 'RELEASED_MANAGER_REVIEW');
  assert.equal(f.state().discountCodes[0].reservedFamilySplitId, undefined);
  assert.deepEqual(f.state().payments, []); assert.equal(f.state().users[0].membershipStatus, 'DEBT');
});

test('completed or changed family journal never releases; lost CAS can be reviewed again without undoing payments', async () => {
  const inFlight = splitFixture(); inFlight.changeBatch(batch => { batch.items[0].status = 'DISPATCHING'; });
  const blocked = await inFlight.post({ action: 'preview' }); assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).code, 'STUCK_SPLIT_IN_PROGRESS');
  const changed = splitFixture(); const preview = await (await changed.post({ action: 'preview' })).json();
  changed.changeBatch(batch => { batch.items[0].status = 'SETUP'; });
  assert.equal((await changed.post(changed.confirmation(preview))).status, 409);
  assert.equal(changed.state().recurringCheckouts[0].cancelledAt, undefined);
  const f = splitFixture(); const first = await (await f.post({ action: 'preview' })).json();
  const originalSave = f.store.putClubState; let conflict = true;
  f.store.putClubState = async (...args) => { if (conflict) { conflict = false; return { conflict: true }; } return originalSave(...args); };
  assert.equal((await f.post(f.confirmation(first))).status, 409);
  assert.equal(f.batch().items[0].status, 'CANCELLED');
  assert.equal(f.state().recurringCheckouts[0].cancelledAt, undefined);
  const second = await (await f.post({ action: 'preview' })).json();
  assert.equal((await f.post(f.confirmation(second))).status, 200);
  assert.equal(f.batch().items[1].status, 'PAID');
});
