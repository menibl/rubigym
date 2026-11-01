import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileRecurringDaily } from './recurring-reconciliation.js';

const env = { PAYMENT_SIGNING_SECRET: 'fixture-only', PUBLIC_APP_URL: 'https://club.test' };
function fixture() {
  const claims = new Set();
  const checkout = { orderId: 'o', userId: 'u', endsAt: '2027-11-01', orderSnapshot: { rc: 1 } };
  const club = { club_id: 'baly-wellness', payload: { users: [{ id: 'u' }], recurringCheckouts: [checkout] } };
  return { checkout, club, store: { getAllClubStates: async () => [club], claimPushDelivery: async (_, key) => {
    if (claims.has(key)) return false;
    claims.add(key); return true;
  } } };
}
test('daily provider checks are persistent, scoped and deduplicated across concurrent runs/restarts', async () => {
  const { store } = fixture(); let calls = 0;
  const inspect = async supplied => { assert.equal(supplied.STATE_STORE, store); calls++; };
  const now = new Date('2026-11-01T10:00:00Z');
  await Promise.all([reconcileRecurringDaily(store, env, inspect, now), reconcileRecurringDaily(store, env, inspect, now)]);
  await reconcileRecurringDaily(store, env, inspect, now);
  assert.equal(calls, 1);
  await reconcileRecurringDaily(store, env, inspect, new Date('2026-11-02T10:00:00Z'));
  assert.equal(calls, 2);
});
test('provider errors never alter membership, never charge, and do not stop another request', async () => {
  const { club, store, checkout } = fixture(); club.payload.recurringCheckouts.push({ ...checkout, orderId: 'other' });
  const before = JSON.stringify(club); let calls = 0;
  await reconcileRecurringDaily(store, env, async () => { calls++; throw new Error('provider body must not be logged'); }, new Date('2026-11-01'));
  assert.equal(calls, 2); assert.equal(JSON.stringify(club), before);
});
test('skip another merchant, cancelled, ended and deleted users', async () => {
  for (const mutate of [f => { f.club.club_id = 'other'; }, f => { f.checkout.cancelledAt = '2026-10-30'; },
    f => { f.checkout.endsAt = '2026-11-01'; }, f => { f.club.payload.users = []; }]) {
    const f = fixture(); mutate(f); let calls = 0;
    await reconcileRecurringDaily(f.store, env, async () => { calls++; }, new Date('2026-11-01'));
    assert.equal(calls, 0);
  }
});

test('a new setup is retried each minute after early failure, deduplicated across concurrent runs', async () => {
  const f = fixture(); f.checkout.dispatchedAt = '2026-11-01T10:00:00Z'; f.checkout.stage = 'PAGE_AVAILABLE';
  let calls = 0;
  const inspect = async () => {
    calls++;
    if (calls < 3) throw new Error('provider is still processing');
    f.club.payload.users[0].recurringMemberships = { OPEN_GYM: { orderId: 'o', status: 'PENDING_FIRST_CHARGE' } };
  };
  for (let minute = 0; minute < 3; minute++) {
    const now = new Date(Date.parse(f.checkout.dispatchedAt) + minute * 60_000);
    await Promise.all([reconcileRecurringDaily(f.store, env, inspect, now), reconcileRecurringDaily(f.store, env, inspect, now)]);
    assert.equal(calls, minute + 1);
  }
  // Once approved, normal daily reconciliation is used (not minute polling).
  await reconcileRecurringDaily(f.store, env, inspect, new Date('2026-11-01T10:03:00Z'));
  await reconcileRecurringDaily(f.store, env, inspect, new Date('2026-11-01T10:04:00Z'));
  assert.equal(calls, 4);
});

test('unapproved setup slows to 15 minutes after ten minutes and daily after 24 hours', async () => {
  const f = fixture(); f.checkout.dispatchedAt = '2026-11-01T10:00:00Z';
  let calls = 0; const inspect = async () => { calls++; };
  for (const time of ['10:16', '10:17', '10:18']) await reconcileRecurringDaily(f.store, env, inspect, new Date(`2026-11-01T${time}:00Z`));
  assert.equal(calls, 1);
  await reconcileRecurringDaily(f.store, env, inspect, new Date('2026-11-01T10:30:00Z')); assert.equal(calls, 2);
  await reconcileRecurringDaily(f.store, env, inspect, new Date('2026-11-02T11:30:00Z'));
  await reconcileRecurringDaily(f.store, env, inspect, new Date('2026-11-02T11:31:00Z')); assert.equal(calls, 3);
});

test('pending setup polling skips never-dispatched work and caps provider load per run', async () => {
  const f = fixture(); f.checkout.stage = 'RESERVED'; f.checkout.dispatchedAt = '2026-11-01T10:00:00Z';
  let calls = 0;
  await reconcileRecurringDaily(f.store, env, async () => { calls++; }, new Date('2026-11-01T10:01:00Z')); assert.equal(calls, 0);
  delete f.checkout.stage;
  f.club.payload.recurringCheckouts = Array.from({ length: 50 }, (_, i) => ({ ...f.checkout, orderId: `order-${i}` }));
  const seen = new Set(); const inspect = async (_, row) => { calls++; seen.add(row.orderId); };
  await reconcileRecurringDaily(f.store, env, inspect, new Date('2026-11-01T10:01:00Z')); assert.equal(calls, 20);
  await reconcileRecurringDaily(f.store, env, inspect, new Date('2026-11-01T10:02:00Z')); assert.equal(calls, 40);
  assert.ok(seen.size > 20, 'capped work rotates rather than starving later requests');
});
