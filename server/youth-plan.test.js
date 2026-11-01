import test from 'node:test';
import assert from 'node:assert/strict';
import { canPurchasePlan, membershipAge, invalidYouthPurchase } from '../shared/youth-plan.js';
import worker from './index.js';

const now = new Date('2026-11-01T10:00:00Z');
const youth = 'YOUTH_TWICE_WEEKLY';
test('youth plans allow age 18 inclusive; unknown/adult ages and invalid birth dates are rejected', () => {
  for (const age of [12, 17, 18]) assert.equal(canPurchasePlan(youth, { age }, now), true);
  for (const age of [19, 40, 0, undefined, NaN]) assert.equal(canPurchasePlan(youth, { age }, now), false);
  for (const birthDate of ['invalid', '2026-02-30', '2030-01-01']) assert.equal(canPurchasePlan(youth, { birthDate, age: 16 }, now), false);
  assert.equal(canPurchasePlan({ id: 'CUSTOM', label: 'קבוצת נוער' }, { age: 40 }, now), false);
  assert.equal(canPurchasePlan('OPEN_GYM', {}, now), true);
  assert.equal(canPurchasePlan('PERSONAL_TRAINING', { age: 40 }, now), true);
});
test('birth date overrides stale age and birthdays follow Jerusalem date', () => {
  assert.equal(membershipAge({ birthDate: '2007-11-02', age: 40 }, now), 18);
  assert.equal(canPurchasePlan(youth, { birthDate: '2007-11-01', age: 16 }, now), false);
  assert.equal(canPurchasePlan(youth, { birthDate: '2007-11-02' }, new Date('2026-11-01T22:30:00Z')), false);
});
test('family eligibility follows each beneficiary, including additions and grouped split lines', () => {
  const payload = { users: [{ id: 'p', age: 40 }, { id: 'c', age: 16 }] };
  const body = { userId: 'p', membershipType: 'FAMILY_MEMBERSHIP', familyMemberPlans: [
    { memberId: 'p', membershipType: 'OPEN_GYM' }, { memberId: 'c', membershipType: youth }
  ] };
  assert.equal(invalidYouthPurchase(payload, body, undefined, now), false);
  body.familyMemberPlans[0].additionalPlans = [{ membershipType: youth }];
  assert.equal(invalidYouthPurchase(payload, body, undefined, now), true);
  body.familyMemberPlans[0].participation = 'SKIP';
  assert.equal(invalidYouthPurchase(payload, body, undefined, now), false);
  assert.equal(invalidYouthPurchase(payload, { membershipType: youth }, { beneficiaryId: 'c' }, now), false);
  assert.equal(invalidYouthPurchase(payload, { membershipType: youth }, { beneficiaryId: 'c', groupLines: [{ memberId: 'c', membershipType: youth }, { memberId: 'p', membershipType: youth }] }, now), true);
});
test('payment API rejects adult/unknown youth purchases before provider calls, reservations or stale continuation', async () => {
  for (const age of [40, undefined]) {
    let dispatches = 0, writes = 0;
    const env = { CLUB_ID: 'test', RIVHIT_ENVIRONMENT: 'test', RIVHIT_GROUP_PRIVATE_TOKEN: 'fixture-only', PAYMENT_SIGNING_SECRET: 'fixture-only', PUBLIC_APP_URL: 'https://club.test/',
      STATE_STORE: { getSession: async () => ({ user_id: 'p', club_id: 'test' }), getAccount: async () => ({ user_id: 'p' }),
        getClubState: async () => ({ payload: { users: [{ id: 'p', age }], recurringCheckouts: [{ userId: 'p', membershipType: youth, orderId: 'old', endsAt: '2099-01-01' }] }, revision: 1 }),
        putClubState: async () => { writes++; return {}; } },
      RIVHIT_FETCH: async () => { dispatches++; throw new Error('unexpected provider call'); } };
    for (const mode of ['PRIMARY', 'REGISTRATION']) {
      const response = await worker.fetch(new Request('https://club.test/api/payments/rivhit/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'baly_session=test' },
        body: JSON.stringify({ userId: 'p', membershipType: youth, mode, age: 16, birthDate: '2010-01-01' }) }), env);
      assert.equal(response.status, 422, await response.clone().text());
      assert.equal((await response.json()).code, 'YOUTH_PLAN_AGE_MISMATCH');
    }
    const familyResponse = await worker.fetch(new Request('https://club.test/api/payments/rivhit/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'baly_session=test' },
      body: JSON.stringify({ userId: 'p', membershipType: 'FAMILY_MEMBERSHIP', mode: 'PRIMARY', familyMemberPlans: [{ memberId: 'p', membershipType: youth }] }) }), env);
    assert.equal(familyResponse.status, 422);
    // Even a previously prepared split page is checked before returning its URL.
    env.STATE_STORE.getFamilySplitCheckout = async () => ({ payload: { id: 'batch', items: [{ id: 'line', memberId: 'p', membershipType: youth, status: 'PAGE', checkout: { url: 'https://testicredit.rivhit.co.il/old' } }] } });
    const splitResponse = await worker.fetch(new Request('https://club.test/api/payments/rivhit/family-split/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'baly_session=test' },
      body: JSON.stringify({ batchId: 'batch', itemId: 'line' }) }), env);
    assert.equal(splitResponse.status, 422);
    assert.equal((await splitResponse.json()).code, 'YOUTH_PLAN_AGE_MISMATCH');
    assert.equal(dispatches, 0); assert.equal(writes, 0);
  }
});
