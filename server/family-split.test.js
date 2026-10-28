import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.js';
import { familySplitLines } from './family-split.js';

const catalog = [
  { id: 'GROUP_ANNUAL', label: 'שנתי', price: 500, active: true, category: 'PRIMARY', billingPeriod: 'MONTHLY_ANNUAL_COMMITMENT', paymentMode: 'RECURRING' },
  { id: 'OPEN_GYM', label: 'פתוח', price: 280, active: true, category: 'PRIMARY', billingPeriod: 'MONTHLY', paymentMode: 'ONE_TIME' },
  { id: 'NUTRITION_PLAN', label: 'תזונה', price: 300, active: true, category: 'ADD_ON', billingPeriod: 'ONE_TIME', paymentMode: 'ONE_TIME' }
];
const members = [
  { memberId: 'payer', memberName: 'Payer Example', membershipType: 'OPEN_GYM', participation: 'INCLUDED' },
  { memberId: 'child', memberName: 'Child Example', membershipType: 'GROUP_ANNUAL', participation: 'INCLUDED' }
];

test('percentage and fixed family discounts are frozen per line without multiplying the fixed coupon', () => {
  const percent = familySplitLines(members, catalog, [], { discountPercent: 10 }, true);
  assert.deepEqual(percent.map(item => item.amount), [252, 450]);
  const fixed = familySplitLines(members, catalog, [], { discountAmount: 100 }, true);
  assert.equal(fixed.reduce((sum, item) => sum + Math.round(item.discountAmount * 100), 0), 10000);
  assert.equal(fixed.reduce((sum, item) => sum + Math.round(item.amount * 100), 0), 68000);
  assert.equal(fixed[1].recurring, true);
  assert.throws(() => familySplitLines(members, catalog, [], { discountPercent: 100 }, true), /SPLIT_ZERO_AMOUNT/);
});

function fixture() {
  let state = { revision: 1, payload: { users: [
    { id: 'payer', name: 'Payer Example', role: 'TRAINEE', familyId: 'fam', isFamilyPayer: true, membershipType: 'OPEN_GYM', membershipStatus: 'DEBT' },
    { id: 'child', name: 'Child Example', role: 'TRAINEE', familyId: 'fam', familyPayerId: 'payer', membershipType: 'GROUP_ANNUAL', membershipStatus: 'DEBT' }
  ], settings: { membershipPlans: catalog }, payments: [], discountCodes: [{ id: 'coupon', code: 'SAVE10', discountPercent: 10, isSingleUse: true }], messages: [] } };
  let journal = { revision: 0, payload: null }, signed = new Map(), calls = [], count = 0;
  let authenticatedUser = 'payer';
  const clone = obj => structuredClone(obj);
  const store = {
    async getSession() { return { club_id: 'test', user_id: authenticatedUser }; },
    async getAccount() { return { user_id: authenticatedUser, role: 'TRAINEE' }; },
    async getClubState() { return clone(state); },
    async putClubState(_club, payload, revision) {
      if (state.revision !== revision) return { conflict: true };
      state = { payload: clone(payload), revision: revision + 1 }; return { conflict: false };
    },
    async getFamilySplitCheckout(_club, user) { return user === 'payer' ? clone(journal) : { revision: 0, payload: null }; },
    async putFamilySplitCheckout(_club, user, payload, revision) {
      assert.equal(user, 'payer'); if (journal.revision !== revision) return false;
      journal = { payload: clone(payload), revision: revision + 1 }; return true;
    }
  };
  const env = { STATE_STORE: store, CLUB_ID: 'test', RIVHIT_ENVIRONMENT: 'production',
    RIVHIT_GROUP_PRIVATE_TOKEN: 'fixture-manual', RIVHIT_RECURRING_GROUP_PRIVATE_TOKEN: 'fixture-recurring',
    RIVHIT_ENABLE_RECURRING: 'true', RIVHIT_RECURRING_CALENDAR_VERIFIED: 'true',
    RIVHIT_ENABLE_FAMILY_SPLIT_RECURRING: 'true',
    PAYMENT_SIGNING_SECRET: 'fixture-not-a-secret', PUBLIC_APP_URL: 'https://club.test/',
    RIVHIT_FETCH: async (url, init) => {
      const body = JSON.parse(init.body); calls.push({ url, body });
      if (url.endsWith('/GetUrl')) {
        const id = `sale-${++count}`;
        signed.set(id, { SaleId: id, Custom1: body.Custom1, Amount: body.Items[0].UnitPrice, TransactionAmount: body.Items[0].UnitPrice,
          CustomerTransactionId: `tx-${count}`, ...(body.CreateRecurringSale ? { RecurringId: `series-${count}`, RecurringSaleChargeNumber: 0, TransactionStatus: 0, TransactionParamJ: 5 } : {}) });
        return Response.json({ Status: 0, URL: `https://icredit.rivhit.co.il/payment/${id}`, PrivateSaleToken: id });
      }
      if (url.endsWith('/SaleDetails')) return Response.json({ Status: 0, data: [signed.get(body.SalePrivateToken || body.SaleId)] });
      if (url.endsWith('/Verify')) return Response.json({ Status: 'VERIFIED' });
      throw new Error('Unexpected operation');
    }
  };
  const post = (path, body) => worker.fetch(new Request(`https://club.test/api/payments/rivhit/${path}`, {
    method: 'POST', headers: { Cookie: 'baly_session=fixture', 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }), env);
  const quote = () => post('create', { userId: 'payer', membershipType: 'FAMILY_MEMBERSHIP', mode: 'PRIMARY', familyBillingMode: 'CUSTOM_COMBINED',
    familyMembersCount: 2, familyMemberPlans: members, discountCode: 'SAVE10', quoteOnly: true });
  return { env, quote, post, state: () => state, journal: () => journal, calls, signed,
    authenticate: user => { authenticatedUser = user; } };
}

test('mixed family checkout uses different pages, grants the beneficiary once, and resumes without duplicate dispatch', async () => {
  const f = fixture();
  const quote = await (await f.quote()).json();
  assert.equal(quote.split, true); assert.equal(quote.items.length, 2);
  assert.deepEqual(quote.items.map(item => item.amount), [252, 450]);
  assert.equal(f.calls.length, 0);
  const batchId = quote.batchId;
  const first = { batchId, itemId: quote.items[0].id, acknowledged: true };
  const race = await Promise.all([f.post('family-split/create', first), f.post('family-split/create', first)]);
  assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
  assert.ok(race.some(response => response.status === 200));
  const retry = await f.post('family-split/create', first); assert.equal(retry.status, 200);
  assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
  assert.equal(f.calls.find(call => call.url.endsWith('/GetUrl')).body.GroupPrivateToken, 'fixture-manual');
  assert.equal((await f.post('family-split/verify', first)).status, 200);
  assert.equal(f.state().payload.payments.length, 1);
  assert.equal(f.state().payload.payments[0].amount, 252);
  assert.equal((await f.post('family-split/create', first)).status, 409);
  const resumed = await (await f.quote()).json(); assert.equal(resumed.batchId, batchId);
  const second = { batchId, itemId: quote.items[1].id, acknowledged: true };
  assert.equal((await f.post('family-split/create', second)).status, 200);
  const recurringRequest = f.calls.filter(call => call.url.endsWith('/GetUrl'))[1].body;
  assert.equal(recurringRequest.GroupPrivateToken, 'fixture-recurring');
  assert.equal(recurringRequest.Items[0].UnitPrice, 450);
  assert.equal(recurringRequest.RecurringSaleCount, 12);
  assert.equal((await f.post('family-split/verify', second)).status, 200);
  assert.equal(f.state().payload.users[1].membershipStatus, 'ACTIVE'); // Verified J5 grants provisional access, never a receipt.
  assert.equal(f.state().payload.payments.length, 1);
  assert.equal(f.state().payload.users[1].recurringMemberships.GROUP_ANNUAL.status, 'PENDING_FIRST_CHARGE');
  const sale = f.signed.get('sale-2');
  Object.assign(sale, { RecurringSaleChargeNumber: 1, TransactionParamJ: 0 });
  assert.equal((await f.post('webhook', sale)).status, 200);
  assert.equal((await f.post('webhook', sale)).status, 200);
  assert.equal(f.state().payload.payments.length, 2);
  const receipt = f.state().payload.payments.find(payment => payment.traineeId === 'child');
  assert.equal(receipt.amount, 450); assert.equal(receipt.familyPayerId, 'payer'); assert.equal(receipt.discountCode, 'SAVE10');
  assert.equal(f.state().payload.users[1].membershipStatus, 'ACTIVE');
  Object.assign(sale, { SaleId: 'charge-2', CustomerTransactionId: 'tx-next', RecurringSaleChargeNumber: 2 });
  f.signed.set('charge-2', sale);
  assert.equal((await f.post('webhook', sale)).status, 200);
  assert.equal(f.state().payload.payments[0].amount, 450); // coupon already used, contract price unchanged.
  assert.equal(f.state().payload.discountCodes[0].isUsed, true);
});

test('split checkout cannot create a payment for an unlinked family member or accept client prices', async () => {
  const f = fixture();
  const quote = await (await f.quote()).json();
  f.state().payload.users[1].familyPayerId = 'other';
  assert.equal((await f.post('family-split/create', { batchId: quote.batchId, itemId: quote.items[1].id, acknowledged: true, amount: 1 })).status, 403);
  assert.equal(f.calls.length, 0);
});

test('another family member cannot dispatch or inspect the payer batch', async () => {
  const f = fixture(); const quote = await (await f.quote()).json();
  f.authenticate('child');
  assert.equal((await f.quote()).status, 403);
  assert.equal((await f.post('family-split/status', { batchId: quote.batchId })).status, 404);
  assert.equal(f.calls.length, 0);
});

test('unknown provider failure never retries GetUrl or silently moves to another billing type', async () => {
  const f = fixture(); const quote = await (await f.quote()).json();
  let attempts = 0;
  f.env.RIVHIT_FETCH = async () => { attempts++; throw new Error('fixture-timeout'); };
  const input = { batchId: quote.batchId, itemId: quote.items[0].id, acknowledged: true };
  assert.equal((await f.post('family-split/create', input)).status, 502);
  assert.equal((await f.post('family-split/create', input)).status, 409);
  assert.equal(attempts, 1);
});

test('existing recurring, current-month manual receipts and excluded members are not charged again', () => {
  const receipts = [
    { traineeId: 'child', membershipTypePurchased: 'GROUP_ANNUAL', status: 'PAID', timestamp: new Date().toISOString(), providerRecurringSaleId: 'existing' },
    { traineeId: 'payer', membershipTypePurchased: 'OPEN_GYM', status: 'PAID', timestamp: new Date().toISOString(), amount: 280 }
  ];
  const lines = familySplitLines(members, catalog, receipts, { discountPercent: 10 }, true);
  assert.deepEqual(lines.map(line => line.status), ['ALREADY_PAID', 'EXISTING_RECURRING']);
  assert.equal(familySplitLines([{ ...members[0], participation: 'SKIP' }, members[1]], catalog, [], null, true).length, 1);
  const familyReceipt = [{ membershipTypePurchased: 'FAMILY_MEMBERSHIP', status: 'PAID', timestamp: new Date().toISOString(), familyMemberPlans: members }];
  assert.deepEqual(familySplitLines(members, catalog, familyReceipt, null, true).map(line => line.status), ['ALREADY_PAID', 'ALREADY_PAID']);
});

test('a manual payment arriving after the quote is caught again before dispatch', async () => {
  const f = fixture(); const quote = await (await f.quote()).json();
  f.state().payload.payments.push({ traineeId: 'payer', membershipTypePurchased: 'OPEN_GYM', status: 'PAID', timestamp: new Date().toISOString(), amount: 280 });
  assert.equal((await f.post('family-split/create', { batchId: quote.batchId, itemId: quote.items[0].id, acknowledged: true })).status, 409);
  assert.equal(f.calls.length, 0);
  assert.equal(f.journal().payload.items[0].status, 'ALREADY_PAID');
});

test('operator switches still prevent all provider calls for a new mixed batch', async () => {
  const f = fixture(); f.env.RIVHIT_ENABLE_RECURRING = 'false';
  const response = await f.quote(); assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'RECURRING_DISABLED');
  assert.equal(f.calls.length, 0); assert.equal(f.journal().payload, null);
});

test('family split activation is a separate default-off switch, including existing checkout creation', async () => {
  const f = fixture(); const quote = await (await f.quote()).json();
  f.env.RIVHIT_ENABLE_FAMILY_SPLIT_RECURRING = 'false';
  assert.equal((await f.post('family-split/create', { batchId: quote.batchId, itemId: quote.items[0].id, acknowledged: true })).status, 503);
  assert.equal(f.calls.length, 0);
  const fresh = fixture(); delete fresh.env.RIVHIT_ENABLE_FAMILY_SPLIT_RECURRING;
  const response = await fresh.quote(); assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'FAMILY_SPLIT_DISABLED');
});

test('an undispatched quote can be cancelled, but not after creating a hosted payment page', async () => {
  const f = fixture(); const quote = await (await f.quote()).json();
  assert.equal((await (await f.post('family-split/cancel', { batchId: quote.batchId })).json()).cancelled, true);
  assert.equal((await f.post('family-split/create', { batchId: quote.batchId, itemId: quote.items[0].id, acknowledged: true })).status, 409);
  const next = await (await f.quote()).json(); assert.notEqual(next.batchId, quote.batchId);
  assert.equal((await f.post('family-split/create', { batchId: next.batchId, itemId: next.items[0].id, acknowledged: true })).status, 200);
  assert.equal((await (await f.post('family-split/cancel', { batchId: next.batchId })).json()).cancelled, false);
  assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
});
