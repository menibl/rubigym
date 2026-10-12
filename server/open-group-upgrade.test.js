import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.js';
import { openGroupUpgradeQuote } from './open-group-upgrade.js';
import { clubDate, nextMonthStart } from '../shared/membership-calendar.js';
import { repairCalendarMemberships } from '../shared/membership-calendar.js';

function fixture() {
  let state = { revision: 1, payload: { users: [{ id: 'user', name: 'User', role: 'TRAINEE', membershipType: 'OPEN_GYM',
    membershipStatus: 'ACTIVE', membershipExpiry: nextMonthStart(clubDate()), membershipExpiryExclusive: true }],
    settings: { membershipPlans: [{ id: 'GROUP_MONTHLY', label: 'Group', price: 500, billingPeriod: 'MONTHLY', active: true, category: 'PRIMARY' }] },
    payments: [{ id: 'old', traineeId: 'user', amount: 280, timestamp: new Date().toISOString(), status: 'PAID',
      membershipTypePurchased: 'OPEN_GYM', provider: 'RIVHIT', providerTransactionId: 'old-tx' }], messages: [] } };
  const claims = new Map(); let calls = 0; let amount;
  const store = {
    async getSession() { return { club_id: 'test', user_id: 'user' }; },
    async getAccount() { return { user_id: 'user', role: 'TRAINEE' }; },
    async getClubState() { return state; },
    async putClubState(_club, payload, revision) { if (revision !== state.revision) return { conflict: true }; state = { payload, revision: revision + 1 }; return { conflict: false }; },
    async reserveFamilyCredit(_club, source, claim_id, fingerprint) {
      if (claims.has(source)) return { ...claims.get(source), created: false };
      const claim = { claim_id, fingerprint }; claims.set(source, claim); return { ...claim, created: true };
    },
    async saveFamilyCreditCheckout(_club, source, _claim, checkout) { claims.get(source).checkout = checkout; }
  };
  const env = { STATE_STORE: store, CLUB_ID: 'test', RIVHIT_ENVIRONMENT: 'production', RIVHIT_GROUP_PRIVATE_TOKEN: 'fixture-page',
    PAYMENT_SIGNING_SECRET: 'fixture-secret', PUBLIC_APP_URL: 'https://baly.test/', RIVHIT_FETCH: async (url, init) => {
      if (url.endsWith('/GetUrl')) { calls++; amount = JSON.parse(init.body).Items[0].UnitPrice;
        return Response.json({ Status: 0, URL: 'https://icredit.rivhit.co.il/payment/example', PrivateSaleToken: 'private' }); }
      if (url.endsWith('/SaleDetails')) return Response.json({ Status: 0, data: [{ SaleId: 'new-sale', TransactionId: 'new-tx', Amount: amount }] });
      if (url.endsWith('/Verify')) return Response.json({ Status: 'VERIFIED' });
      throw new Error('unexpected provider call');
    } };
  const request = { userId: 'user', userName: 'User', membershipType: 'GROUP_MONTHLY', mode: 'PRIMARY' };
  const post = (path, body) => worker.fetch(new Request(`https://baly.test/api/payments/rivhit/${path}`, {
    method: 'POST', headers: { Cookie: 'baly_session=test', 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }), env);
  return { post, request, state: () => state, calls: () => calls, amount: () => amount, claims };
}

test('upgrade quotes 220, requires exact confirmation, activates only after verification and reuses checkout', async () => {
  const f = fixture();
  const response = await f.post('create', { ...f.request, planAmount: 1, creditAmount: 499 });
  assert.equal(response.status, 409);
  const quote = await response.json();
  assert.equal(quote.code, 'OPEN_GROUP_UPGRADE_CONFIRMATION');
  assert.equal(quote.amountDue, 220); assert.equal(f.calls(), 0);
  assert.equal(f.state().payload.users[0].membershipType, 'OPEN_GYM');
  const checkout = await (await f.post('create', { ...f.request, upgradeQuoteKey: quote.upgradeQuoteKey })).json();
  assert.ok(checkout.paymentReference); assert.equal(f.amount(), 220);
  assert.equal(f.state().payload.users[0].membershipType, 'OPEN_GYM');
  const again = await (await f.post('create', { ...f.request, upgradeQuoteKey: quote.upgradeQuoteKey })).json();
  assert.deepEqual(again, checkout); assert.equal(f.calls(), 1);
  for (let i = 0; i < 2; i++) assert.equal((await f.post('verify', { paymentReference: checkout.paymentReference })).status, 200);
  assert.equal(f.state().payload.users[0].membershipType, 'GROUP_MONTHLY');
  assert.equal(f.state().payload.users[0].membershipExpiry, nextMonthStart(clubDate()));
  assert.equal(f.state().payload.payments.length, 2);
  assert.equal(f.state().payload.payments[0].amount, 220);
  assert.equal(f.state().payload.payments[0].upgradeCreditAmount, 280);
  const nextMonth = new Date(`${nextMonthStart(clubDate())}T12:00:00Z`);
  assert.equal(repairCalendarMemberships(f.state().payload, nextMonth).changed, false);
});

test('parallel confirmation dispatches one checkout; fully covered upgrade charges nothing', async () => {
  const f = fixture();
  const quote = await (await f.post('create', f.request)).json();
  await Promise.all([1, 2].map(() => f.post('create', { ...f.request, upgradeQuoteKey: quote.upgradeQuoteKey })));
  assert.equal(f.calls(), 1);
  const covered = fixture(); covered.state().payload.payments[0].amount = 500;
  const coveredQuote = await (await covered.post('create', covered.request)).json();
  assert.equal(coveredQuote.amountDue, 0);
  const result = await (await covered.post('create', { ...covered.request, upgradeQuoteKey: coveredQuote.upgradeQuoteKey })).json();
  assert.equal(result.completed, true); assert.equal(covered.calls(), 0);
  assert.equal(covered.state().payload.users[0].membershipType, 'GROUP_MONTHLY');
});

test('family payment cannot be guessed as individual Open credit', () => {
  const f = fixture(); f.state().payload.payments[0].membershipTypePurchased = 'FAMILY_MEMBERSHIP';
  assert.throws(() => openGroupUpgradeQuote(f.state().payload, f.request, { amount: 500, billingPeriod: 'MONTHLY' }), /UPGRADE_REVIEW_REQUIRED/);
});

test('refund or membership change after confirmation never falls back to full-price charge', async () => {
  for (const edit of [payload => { payload.payments[0].refundedAt = 'today'; }, payload => { payload.users[0].membershipType = 'GROUP_MONTHLY'; }]) {
    const f = fixture(); const quote = await (await f.post('create', f.request)).json();
    edit(f.state().payload);
    const response = await f.post('create', { ...f.request, upgradeQuoteKey: quote.upgradeQuoteKey });
    assert.equal(response.status, 409); assert.equal((await response.json()).code, 'UPGRADE_QUOTE_CHANGED');
    assert.equal(f.calls(), 0);
  }
});

test('receipt discounted to 200 credits only 200; stale quote and reused source cannot dispatch again', async () => {
  const f = fixture();
  const quote = await (await f.post('create', f.request)).json();
  f.state().payload.payments[0].amount = 200;
  const changed = await (await f.post('create', { ...f.request, upgradeQuoteKey: quote.upgradeQuoteKey })).json();
  assert.equal(changed.code, 'OPEN_GROUP_UPGRADE_CONFIRMATION'); assert.equal(changed.amountDue, 300);
  assert.equal(f.calls(), 0);
  f.claims.set('old', { claim_id: 'existing-family', fingerprint: 'different' });
  const blocked = await (await f.post('create', { ...f.request, upgradeQuoteKey: changed.upgradeQuoteKey })).json();
  assert.equal(blocked.code, 'UPGRADE_CHECKOUT_EXISTS'); assert.equal(f.calls(), 0);
});

test('expired, previous-month, refunded and mock receipts never provide upgrade credit', () => {
  const f = fixture(); const purchase = { amount: 500, billingPeriod: 'MONTHLY' };
  for (const edit of [p => { p.date = '2020-01-01'; p.timestamp = '2020-01-01'; }, p => { p.refundedAt = 'today'; }, p => { p.isMock = true; }]) {
    const payload = structuredClone(f.state().payload); edit(payload.payments[0]);
    assert.equal(openGroupUpgradeQuote(payload, f.request, purchase), null);
  }
  f.state().payload.users[0].membershipExpiry = clubDate();
  assert.equal(openGroupUpgradeQuote(f.state().payload, f.request, purchase), null);
});

test('recurring source or recurring target requires manager review without charging', async () => {
  const f = fixture(); f.state().payload.payments[0].providerRecurringSaleId = 'active-series';
  const result = await (await f.post('create', f.request)).json();
  assert.equal(result.code, 'UPGRADE_REVIEW_REQUIRED'); assert.equal(f.calls(), 0);
  delete f.state().payload.payments[0].providerRecurringSaleId;
  assert.throws(() => openGroupUpgradeQuote(f.state().payload, f.request, { amount: 500, billingPeriod: 'MONTHLY', recurring: true }), /UPGRADE_REVIEW_REQUIRED/);
});
