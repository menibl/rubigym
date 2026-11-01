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
