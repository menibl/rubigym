import test from 'node:test';
import assert from 'node:assert/strict';
import { recurringCustomerTarget, syncRecurringCustomerName, reconcileRecurringCustomerNames } from './recurring-customer-sync.js';
import { recurringCustomerPost } from './index.js';

const seriesId = '11111111-1111-4111-8111-111111111111';
const now = new Date('2026-11-22T10:00:00Z');
function fixture() {
  const contract = { seriesId, orderId: 'order', status: 'ACTIVE', amount: 280, endsAt: '2027-11-01', paidUntil: '2026-12-01' };
  let state = { revision: 1, payload: { users: [
    { id: 'payer', role: 'TRAINEE', name: 'עדי פנצר', username: 'unchanged', phone: '0500000001', membershipExpiry: '2026-12-01', recurringMemberships: { OPEN_GYM: contract } },
    { id: 'child', role: 'TRAINEE', name: 'ילד לדוגמה', phone: '0500000002', recurringMemberships: { OPEN_GYM: { ...contract } } }
  ], recurringCheckouts: [{ orderId: 'order', userId: 'payer', recurringSaleId: seriesId, orderSnapshot: { o: 'order', u: 'payer', a: 560 } }],
  payments: [{ id: 'paid', amount: 560, status: 'PAID' }] } };
  let details = { CustomerFirstName: 'עדי', CustomerLastName: 'BALY', PhoneNumber: '+972500000001', IsActive: true };
  const calls = []; let held = false, fail = false, conflict = false, timeoutAfterUpdate = false;
  const store = {
    getClubState: async () => state,
    getAllClubStates: async () => [{ club_id: 'baly-wellness', payload: state.payload }],
    putClubState: async (_club, payload, revision) => {
      if (conflict) { conflict = false; state.revision++; return { conflict: true }; }
      if (revision !== state.revision) return { conflict: true };
      state = { revision: revision + 1, payload }; return { conflict: false };
    },
    withRecurringSeriesLock: async (_club, _series, run) => { if (held) return false; held = true; try { await run(); return true; } finally { held = false; } }
  };
  const post = async (path, body) => {
    calls.push({ path, body });
    if (fail) throw new Error('fixture provider timeout');
    if (path === '/RecurringSaleDetails') return { data: structuredClone(details), Status: 0 };
    assert.equal(path, '/RecurringSaleUpdateCustomer');
    assert.deepEqual(Object.keys(body).sort(), ['CustomerFirstName', 'CustomerLastName', 'RecurringSaleId']);
    details = { ...details, CustomerFirstName: body.CustomerFirstName, CustomerLastName: body.CustomerLastName };
    if (timeoutAfterUpdate) { timeoutAfterUpdate = false; throw new Error('fixture lost response'); }
    return { Status: 0, error_code: 0 };
  };
  return { store, post, calls, state: () => state, details: () => details, fail: () => { fail = true; }, conflict: () => { conflict = true; },
    timeout: () => { timeoutAfterUpdate = true; } };
}

test('combined family instruction gets payer full name once, never child name or username', async () => {
  const f = fixture(); const before = structuredClone(f.state().payload);
  assert.equal(await syncRecurringCustomerName(f.store, 'baly-wellness', seriesId, f.post, now), 'SYNCED');
  assert.equal(f.details().CustomerLastName, 'פנצר');
  assert.deepEqual(f.calls.map(call => call.path), ['/RecurringSaleDetails', '/RecurringSaleUpdateCustomer', '/RecurringSaleDetails']);
  assert.deepEqual(f.state().payload.payments, before.payments);
  assert.equal(f.state().payload.users[0].username, 'unchanged');
  for (let i = 0; i < 2; i++) {
    const after = structuredClone(f.state().payload.users[i]); delete after.recurringMemberships.OPEN_GYM.customerNameSync;
    assert.deepEqual(after, before.users[i]);
  }
  assert.deepEqual(f.state().payload.recurringCheckouts[0].orderSnapshot, before.recurringCheckouts[0].orderSnapshot);
});

test('lost update response is recovered by reading provider state, not reissuing an update or charge', async () => {
  const f = fixture(); f.timeout();
  assert.equal(await syncRecurringCustomerName(f.store, 'baly-wellness', seriesId, f.post, now), 'NAME_SYNC_PROVIDER_UNAVAILABLE');
  assert.equal(await syncRecurringCustomerName(f.store, 'baly-wellness', seriesId, f.post, new Date(now.getTime() + 15 * 60_000)), 'SYNCED');
  assert.equal(f.calls.filter(call => call.path === '/RecurringSaleUpdateCustomer').length, 1);
});

for (const kind of ['missing-name', 'missing-checkout', 'wrong-owner', 'other-owner', 'inactive', 'provider-failure']) test(`uncertain series is not mutated: ${kind}`, async () => {
  const f = fixture();
  if (kind === 'missing-name') f.state().payload.users[0].name = 'עדי';
  if (kind === 'missing-checkout') f.state().payload.recurringCheckouts = [];
  if (kind === 'wrong-owner') f.details().PhoneNumber = '0500000009';
  if (kind === 'other-owner') f.state().payload.recurringCheckouts.push({ orderId: 'other', recurringSaleId: seriesId, orderSnapshot: { o: 'other', u: 'child' } });
  if (kind === 'inactive') f.details().IsActive = false;
  if (kind === 'provider-failure') f.fail();
  assert.notEqual(await syncRecurringCustomerName(f.store, 'baly-wellness', seriesId, f.post, now), 'SYNCED');
  assert.equal(f.calls.some(call => call.path !== '/RecurringSaleDetails'), false);
  assert.equal(f.state().payload.users[0].recurringMemberships.OPEN_GYM.status, 'ACTIVE');
});

test('concurrent schedulers share a series lock and sync a family once, not once per member', async () => {
  const f = fixture(); const env = { RIVHIT_RECURRING_GROUP_PRIVATE_TOKEN: 'fixture' };
  await Promise.all([reconcileRecurringCustomerNames(f.store, env, f.post, now), reconcileRecurringCustomerNames(f.store, env, f.post, now)]);
  await reconcileRecurringCustomerNames(f.store, env, f.post, now);
  assert.equal(f.calls.filter(call => call.path === '/RecurringSaleUpdateCustomer').length, 1);
  assert.equal(f.calls.length, 3);
  f.state().payload.users[0].name = 'עדי כהן';
  await reconcileRecurringCustomerNames(f.store, env, f.post, new Date(now.getTime() + 60_000));
  assert.equal(f.details().CustomerLastName, 'כהן');
});

test('state save conflict retries without replaying provider mutation; wrong club is skipped', async () => {
  const f = fixture(); f.conflict();
  await syncRecurringCustomerName(f.store, 'baly-wellness', seriesId, f.post, now);
  assert.equal(f.calls.filter(call => call.path === '/RecurringSaleUpdateCustomer').length, 1);
  await reconcileRecurringCustomerNames(f.store, { CLUB_ID: 'other', RIVHIT_RECURRING_GROUP_PRIVATE_TOKEN: 'fixture' }, f.post, now);
  assert.equal(f.calls.length, 3);
});

test('provider adapter rejects every money, token and creation operation', () => {
  for (const path of ['/GetUrl', '/SaleChargeToken', '/CreateSale', '/ChargePendingSale', '/RecurringSaleCancel', '/RecurringSaleUpdate', '/RecurringSaleUpdateItems', '/RecurringSaleUpdateToken']) {
    assert.throws(() => recurringCustomerPost(path, {}, {}), /NAME_SYNC_OPERATION_NOT_ALLOWED/);
  }
  assert.throws(() => recurringCustomerPost('/RecurringSaleUpdateCustomer', { RecurringSaleId: seriesId,
    CustomerFirstName: 'Test', CustomerLastName: 'Customer', Token: 'must-not-forward' }, {}), /NAME_SYNC_FIELDS_NOT_ALLOWED/);
});

test('missing or conflicting payer identity cannot be guessed from family membership', () => {
  const f = fixture(); f.state().payload.recurringCheckouts[0].orderSnapshot.u = 'unknown';
  assert.throws(() => recurringCustomerTarget(f.state().payload, seriesId), /NAME_SYNC_FULL_NAME_REQUIRED/);
});

test('legacy contract without saved payer binding is surfaced for review without provider mutation', async () => {
  const f = fixture(); f.state().payload.recurringCheckouts = [];
  await reconcileRecurringCustomerNames(f.store, { RIVHIT_RECURRING_GROUP_PRIVATE_TOKEN: 'fixture' }, f.post, now);
  assert.equal(f.calls.length, 0);
  assert.equal(f.state().payload.users[0].recurringMemberships.OPEN_GYM.customerNameSync.status, 'REVIEW_REQUIRED');
  assert.equal(f.state().payload.users[0].recurringMemberships.OPEN_GYM.customerNameSync.code, 'NAME_SYNC_OWNER_REVIEW');
});

test('a profile change during provider lookup is not overwritten by a stale name', async () => {
  const f = fixture();
  const post = async (path, body) => { const result = await f.post(path, body); if (path === '/RecurringSaleDetails') f.state().payload.users[0].name = 'עדי כהן'; return result; };
  assert.equal(await syncRecurringCustomerName(f.store, 'baly-wellness', seriesId, post, now), 'NAME_SYNC_PROFILE_CHANGED');
  assert.equal(f.calls.some(call => call.path === '/RecurringSaleUpdateCustomer'), false);
  assert.equal(f.state().payload.users[0].name, 'עדי כהן');
  assert.equal(f.state().payload.users[0].recurringMemberships.OPEN_GYM.customerNameSync.status, 'PENDING');
});

test('provider-side invoice-payer transfer is never silently reverted to original payer', async () => {
  const f = fixture(); f.details().CustomerFirstName = 'אורן'; f.details().CustomerLastName = 'פנצר';
  assert.equal(await syncRecurringCustomerName(f.store, 'baly-wellness', seriesId, f.post, now), 'NAME_SYNC_PROVIDER_NAME_REVIEW');
  assert.equal(f.calls.filter(call => call.path === '/RecurringSaleUpdateCustomer').length, 0);
  assert.equal(f.details().CustomerFirstName, 'אורן');
  assert.equal(f.state().payload.users[0].recurringMemberships.OPEN_GYM.customerNameSync.status, 'REVIEW_REQUIRED');
});
