import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.js';
import { familyPlanAmount } from '../shared/family-pricing.js';
import { familyCreditQuote } from './family-credit.js';

function fixture(paid = 280) {
  let state = { revision: 1, payload: { users: [
    { id: 'payer', name: 'Payer', role: 'TRAINEE', familyId: 'fam-payer', isFamilyPayer: true, membershipType: 'OPEN_GYM', membershipStatus: 'ACTIVE', membershipExpiry: '2099-12-31' },
    { id: 'child', name: 'Child', role: 'TRAINEE', familyId: 'fam-payer', familyPayerId: 'payer', membershipType: 'OPEN_GYM', membershipStatus: 'DEBT', familyPaymentPending: true },
  ], payments: [{ id: 'old', traineeId: 'payer', amount: paid, timestamp: new Date().toISOString(), status: 'PAID', membershipTypePurchased: 'OPEN_GYM', provider: 'RIVHIT', providerTransactionId: 'old-tx' }], messages: [] } };
  const claims = new Map();
  let providerCalls = 0;
  let amount;
  let role = 'TRAINEE';
  const store = {
    async getSession() { return { club_id: 'test', user_id: 'payer' }; },
    async getAccount() { return { user_id: 'payer', role }; },
    async getClubState() { return state; },
    async putClubState(_club, payload, revision) { if (revision !== state.revision) return { conflict: true }; state = { payload, revision: revision + 1 }; return { conflict: false, revision: state.revision }; },
    async reserveFamilyCredit(_club, source, claim_id, fingerprint) {
      if (claims.has(source)) return { ...claims.get(source), created: false };
      const claim = { claim_id, fingerprint }; claims.set(source, claim); return { ...claim, created: true };
    },
    async saveFamilyCreditCheckout(_club, source, _claim, checkout) { claims.get(source).checkout = checkout; },
    async getFamilyCreditClaim(_club, source) { return claims.get(source); },
  };
  const env = { STATE_STORE: store, CLUB_ID: 'test', RIVHIT_ENVIRONMENT: 'production', RIVHIT_GROUP_PRIVATE_TOKEN: 'production-group-private-token', PAYMENT_SIGNING_SECRET: 'test-signing-secret', PUBLIC_APP_URL: 'https://baly.test/', RIVHIT_FETCH: async (url, init) => {
    if (url.endsWith('/GetUrl')) {
      providerCalls++; const body = JSON.parse(init.body); amount = body.Items[0].UnitPrice;
      assert.equal(body.CreateRecurringSale, false);
      return Response.json({ Status: 0, URL: 'https://icredit.rivhit.co.il/payment/example', PrivateSaleToken: 'private' });
    }
    if (url.endsWith('/SaleDetails')) return Response.json({ Status: 0, data: [{ SaleId: 'new-sale', TransactionId: 'new-tx', Amount: amount }] });
    if (url.endsWith('/Verify')) return Response.json({ Status: 'VERIFIED' });
    throw new Error('unexpected provider call');
  } };
  const post = (path, body) => worker.fetch(new Request(`https://baly.test/api/payments/rivhit/${path}`, { method: 'POST', headers: { Cookie: 'baly_session=test', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env);
  const request = { userId: 'payer', userName: 'Payer', membershipType: 'FAMILY_MEMBERSHIP', mode: 'PRIMARY', familyMembersCount: 2, familyBillingMode: 'CUSTOM_COMBINED', familyMemberPlans: [{ memberId: 'payer', memberName: 'Payer', membershipType: 'OPEN_GYM' }, { memberId: 'child', memberName: 'Child', membershipType: 'OPEN_GYM' }] };
  return { post, request, state: () => state, calls: () => providerCalls, amount: () => amount, asManager: () => { role = 'MANAGER'; } };
}

test('manager recovery reconciles saved signed checkout without another GetUrl or duplicate receipt', async () => {
  const f = fixture();
  const quote = await (await f.post('create', { ...f.request, quoteOnly: true })).json();
  assert.equal((await f.post('create', { ...f.request, quoteKey: quote.quoteKey })).status, 200);
  f.asManager();
  const result = await f.post('admin/family-credit-recovery', { paymentId: 'old', action: 'check' });
  assert.equal(result.status, 200);
  assert.equal((await result.json()).state, 'SYNCED');
  assert.equal(f.state().payload.users[1].membershipStatus, 'ACTIVE');
  assert.equal((await (await f.post('admin/family-credit-recovery', { paymentId: 'old', action: 'check' })).json()).state, 'USED');
  assert.equal(f.state().payload.payments.length, 2);
  assert.equal(f.calls(), 1);
});

test('Open Gym family pays only 280 more; successful repeated verification activates child once', async () => {
  const f = fixture();
  const quote = await (await f.post('create', { ...f.request, quoteOnly: true })).json();
  assert.equal(quote.packageAmount, 560); assert.equal(quote.creditAmount, 280); assert.equal(quote.amountDue, 280);
  const request = { ...f.request, quoteKey: quote.quoteKey };
  const response = await f.post('create', request); assert.equal(response.status, 200);
  const checkout = await response.json();
  assert.equal(f.amount(), 280);
  assert.equal(f.state().payload.users[1].familyPaymentPending, true);
  assert.deepEqual(await (await f.post('create', request)).json(), checkout);
  assert.equal(f.calls(), 1);
  for (let i = 0; i < 2; i++) assert.equal((await f.post('verify', { paymentReference: checkout.paymentReference })).status, 200);
  const child = f.state().payload.users.find(user => user.id === 'child');
  assert.equal(child.familyPaymentPending, false); assert.equal(child.membershipStatus, 'ACTIVE');
  assert.equal(f.state().payload.payments.length, 2);
  assert.equal(f.state().payload.payments[0].amount, 280);
  assert.equal(f.state().payload.payments[0].familyPackageAmount, 560);
});

test('zero balance applies credit without sending a charge to Rivhit', async () => {
  const f = fixture(560);
  const quote = await (await f.post('create', { ...f.request, quoteOnly: true })).json();
  const response = await f.post('create', { ...f.request, quoteKey: quote.quoteKey });
  assert.equal(response.status, 200); assert.equal((await response.json()).completed, true);
  assert.equal(f.calls(), 0); assert.equal(f.state().payload.payments[0].amount, 0);
});

test('unrelated, missing and duplicate members cannot receive a family purchase', async () => {
  const f = fixture();
  for (const memberId of ['stranger', undefined, 'payer']) {
    const plans = [f.request.familyMemberPlans[0], { ...f.request.familyMemberPlans[1], memberId }];
    assert.equal((await f.post('create', { ...f.request, familyMemberPlans: plans, quoteOnly: true })).status, 400);
  }
  assert.equal(f.calls(), 0);
});

test('family plans use full catalog prices without an automatic group discount', () => {
  assert.equal(familyPlanAmount('GROUP_ANNUAL', 500) * 2 + familyPlanAmount('OPEN_GYM', 280) * 2, 1560);
  assert.equal(familyPlanAmount('GROUP_MONTHLY', 600), 600);
  assert.equal(familyPlanAmount('PERSONAL_TRAINING', 800), 800);
});

test('credit is not offered for refunded payments or a past billing month', () => {
  const f = fixture();
  const payload = f.state().payload;
  payload.payments[0].timestamp = '2020-01-01T10:00:00Z';
  assert.equal(familyCreditQuote(payload, 'payer', 560).creditAmount, 0);
  payload.payments[0].timestamp = new Date().toISOString();
  payload.payments[0].status = 'REFUNDED';
  assert.equal(familyCreditQuote(payload, 'payer', 560).creditAmount, 0);
});

test('legacy paid registration receipts remain eligible without provider columns', () => {
  const f = fixture();
  const payment = f.state().payload.payments[0];
  payment.id = 'payment-rivhit-old-tx';
  payment.paymentMethod = 'RIVHIT iCredit';
  delete payment.provider;
  delete payment.providerTransactionId;
  assert.equal(familyCreditQuote(f.state().payload, 'payer', 560).amountDue, 280);
});

test('simultaneous checkout attempts cannot create two credit-backed provider pages', async () => {
  const f = fixture();
  const quote = await (await f.post('create', { ...f.request, quoteOnly: true })).json();
  const responses = await Promise.all([1, 2].map(() => f.post('create', { ...f.request, quoteKey: quote.quoteKey })));
  assert.ok(responses.some(response => response.status === 200));
  assert.ok(responses.every(response => [200, 409].includes(response.status)));
  assert.equal(f.calls(), 1);
});

test('unstarted dependent has no charge and receives no paid rights after verification', async () => {
  const f = fixture();
  f.request.familyMemberPlans[1].participation = 'NOT_STARTED';
  f.request.familyMemberPlans[1].membershipType = 'RETIRED_PLAN';
  const before = structuredClone(f.state().payload.users[1]);
  const quote = await (await f.post('create', { ...f.request, quoteOnly: true })).json();
  assert.equal(quote.amountDue, 280);
  assert.equal(quote.creditAmount, 0);
  const checkout = await (await f.post('create', { ...f.request, quoteKey: quote.quoteKey })).json();
  assert.equal((await f.post('verify', { paymentReference: checkout.paymentReference })).status, 200);
  assert.deepEqual(f.state().payload.users[1], before);
});

test('paid payer may skip their retired plan and pay only for the dependent', async () => {
  const f = fixture();
  f.request.familyMemberPlans[0].participation = 'SKIP';
  f.request.familyMemberPlans[0].membershipType = 'RETIRED_PLAN';
  const quote = await (await f.post('create', { ...f.request, quoteOnly: true })).json();
  assert.equal(quote.amountDue, 280);
  assert.equal(quote.creditAmount, 0);
  const checkout = await (await f.post('create', { ...f.request, quoteKey: quote.quoteKey })).json();
  assert.equal((await f.post('verify', { paymentReference: checkout.paymentReference })).status, 200);
  assert.equal(f.state().payload.users[0].membershipType, 'OPEN_GYM');
  assert.equal(f.state().payload.users[0].membershipExpiry, '2099-12-31');
  assert.equal(f.state().payload.users[1].membershipStatus, 'ACTIVE');
  assert.equal(f.state().payload.payments[0].familyPartialPurchase, true);
  assert.equal(familyCreditQuote(f.state().payload, 'payer', 840).creditAmount, 0);
});

test('empty purchases and fake freeze declarations are rejected', async () => {
  const f = fixture();
  for (const plan of f.request.familyMemberPlans) plan.participation = 'SKIP';
  assert.equal((await f.post('create', { ...f.request, quoteOnly: true })).status, 400);
  f.request.familyMemberPlans[0].participation = 'INCLUDED';
  f.request.familyMemberPlans[1].participation = 'FROZEN';
  assert.equal((await f.post('create', { ...f.request, quoteOnly: true })).status, 400);
  assert.equal(f.calls(), 0);
});

test('frozen dependent cannot be charged or reactivated; excluded frozen data is preserved', async () => {
  const f = fixture();
  Object.assign(f.state().payload.users[1], { isMembershipFrozen: true, membershipFrozenUntil: '2099-12-31', membershipStatus: 'ACTIVE' });
  assert.equal((await f.post('create', { ...f.request, quoteOnly: true })).status, 400);
  f.request.familyMemberPlans[1].participation = 'FROZEN';
  const before = structuredClone(f.state().payload.users[1]);
  const quote = await (await f.post('create', { ...f.request, quoteOnly: true })).json();
  const checkout = await (await f.post('create', { ...f.request, quoteKey: quote.quoteKey })).json();
  assert.equal((await f.post('verify', { paymentReference: checkout.paymentReference })).status, 200);
  assert.deepEqual(f.state().payload.users[1], before);
});
