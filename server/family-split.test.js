import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.js';
import { familySplitLines, groupFamilyRecurringLines } from './family-split.js';

const catalog = [
  { id: 'GROUP_ANNUAL', label: 'שנתי', price: 500, active: true, category: 'PRIMARY', billingPeriod: 'MONTHLY_ANNUAL_COMMITMENT', paymentMode: 'RECURRING' },
  { id: 'OPEN_GYM', label: 'פתוח', price: 280, active: true, category: 'PRIMARY', billingPeriod: 'MONTHLY', paymentMode: 'ONE_TIME' },
  { id: 'NUTRITION_PLAN', label: 'תזונה', price: 300, active: true, category: 'ADD_ON', billingPeriod: 'ONE_TIME', paymentMode: 'ONE_TIME' }
];
const members = [
  { memberId: 'payer', memberName: 'Payer Example', membershipType: 'OPEN_GYM', participation: 'INCLUDED' },
  { memberId: 'child', memberName: 'Child Example', membershipType: 'GROUP_ANNUAL', participation: 'INCLUDED' }
];

test('two family members and two additions use exactly one recurring page and one manual page', async () => {
  const f = fixture(true);
  f.state().payload.nutritionPlans = [{ id: 'n1', traineeId: 'payer', isPaid: false }, { id: 'n2', traineeId: 'child', isPaid: false }];
  const quote = await (await f.quote({ unifiedCheckout: true, familyMemberPlans: members.map(member => ({ ...member, additionalPlans: [{ membershipType: 'NUTRITION_PLAN' }] })) })).json();
  assert.equal(quote.items.length, 2);
  assert.deepEqual(quote.items.map(item => [item.recurring, item.amount, item.groupLines.length]), [[true, 702, 2], [false, 540, 2]]);
  for (const item of quote.items) {
    const request = { batchId: quote.batchId, itemId: item.id, acknowledged: true };
    assert.equal((await f.post('family-split/create', request)).status, 200);
    assert.equal((await f.post('family-split/verify', request)).status, 200);
    assert.equal((await f.post('family-split/verify', request)).status, 200);
  }
  assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 2);
  assert.equal(f.state().payload.payments.length, 1, 'setup approval is not an extra paid receipt');
  assert.equal(f.state().payload.payments[0].amount, 540);
  assert.ok(f.state().payload.nutritionPlans.every(plan => plan.isPaid && plan.price === 270));
  for (const user of f.state().payload.users) {
    assert.equal(user.nutritionPlanPaid, true);
    assert.ok(user.membershipPlanExpiries.NUTRITION_PLAN);
    assert.equal(user.membershipStatus, 'ACTIVE');
  }
});

test('an individual selects a primary plan and additions together without creating a family account', async () => {
  const f = fixture(true);
  const payer = f.state().payload.users[0];
  delete payer.familyId; delete payer.isFamilyPayer;
  const response = await f.post('create', { userId: 'payer', membershipType: 'OPEN_GYM', mode: 'PRIMARY', quoteOnly: true,
    individualSelections: [{ membershipType: 'OPEN_GYM' }, { membershipType: 'NUTRITION_PLAN' }] });
  assert.equal(response.status, 200, await response.clone().text());
  const quote = await response.json();
  assert.equal(quote.items.length, 2); assert.equal(quote.items[0].recurring, true);
  for (const item of quote.items) {
    const request = { batchId: quote.batchId, itemId: item.id, acknowledged: true };
    assert.equal((await f.post('family-split/create', request)).status, 200);
    assert.equal((await f.post('family-split/verify', request)).status, 200);
  }
  assert.equal(f.state().payload.users[0].nutritionPlanPaid, true);
  assert.equal(f.state().payload.users[0].isFamilyPayer, undefined);
  assert.equal(f.state().payload.users[1].nutritionPlanPaid, undefined);
  assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 2);
});

test('return verification recovers an approved series when SaleDetails has incomplete recurring receipt fields', async () => {
  for (const approved of [true, false]) {
    const f = fixture(true);
    f.state().payload.users[0].phone = '0541234567';
    const quote = await (await f.quote()).json();
    const input = { batchId: quote.batchId, itemId: quote.items[0].id, acknowledged: true };
    assert.equal((await f.post('family-split/create', input)).status, 200);
    const seriesId = '11111111-1111-4111-8111-111111111111';
    Object.assign(f.signed.get('sale-1'), { RecurringId: seriesId });
    delete f.signed.get('sale-1').RecurringSaleChargeNumber;
    const checkout = f.state().payload.recurringCheckouts[0];
    const provider = f.env.RIVHIT_FETCH;
    const paths = [];
    f.env.RIVHIT_FETCH = async (url, options) => {
      const operation = url.split('/').at(-1); paths.push(operation);
      if (operation === 'RecurringSaleList') return Response.json({ RecurringSales: approved ? [{ RecurringSaleId: seriesId, IsActive: true }] : [] });
      if (operation === 'RecurringSaleDetails') return Response.json({ Amount: checkout.orderSnapshot.a, PhoneNumber: '0541234567',
        Token: 'fixture-only-card-proof', AutoCharge: true, IsActive: true, Currency: 1, ProRata: false, RecurringCycle: 3, RecurringDay: 1, RecurringStep: 1,
        RecurringSaleCount: 12, ChargeCount: 0, CreationDate: checkout.dispatchedAt,
        EndDate: new Date(Date.UTC(Number(checkout.endsAt.slice(0, 4)), Number(checkout.endsAt.slice(5, 7)) - 2, 1)).toISOString(),
        IpnUrl: 'https://club.test/api/payments/rivhit/webhook' });
      if (operation === 'RecurringSaleHistory') return Response.json({ RecurringSaleHistoryList: [] });
      return provider(url, options);
    };
    const response = await f.post('family-split/verify', input);
    assert.equal(response.status, approved ? 200 : 409, await response.clone().text());
    assert.equal(f.state().payload.payments.length, 0);
    assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
    assert.ok(!paths.includes('GetUrl'));
    for (const user of f.state().payload.users) assert.equal(user.membershipStatus, approved ? 'ACTIVE' : 'DEBT');
  }
});

test('percentage and fixed family discounts are frozen per line without multiplying the fixed coupon', () => {
  const percent = familySplitLines(members, catalog, [], { discountPercent: 10 }, true);
  assert.deepEqual(percent.map(item => item.amount), [252, 450]);
  const fixed = familySplitLines(members, catalog, [], { discountAmount: 100 }, true);
  assert.equal(fixed.reduce((sum, item) => sum + Math.round(item.discountAmount * 100), 0), 10000);
  assert.equal(fixed.reduce((sum, item) => sum + Math.round(item.amount * 100), 0), 68000);
  assert.equal(fixed[1].recurring, true);
  assert.throws(() => familySplitLines(members, catalog, [], { discountPercent: 100 }, true), /SPLIT_ZERO_AMOUNT/);
});

test('only new matching recurring periods group; one-off, different terms and existing series stay separate', () => {
  const lines = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, memberId: id, memberName: id, membershipType: 'OPEN_GYM', amount: 100,
    baseAmount: 100, discountAmount: 0, recurring: true, status: 'READY', startsAt: '01-11-2026', endsAt: '2027-11-01', recurringMonths: 12 }));
  lines[2].endsAt = '2027-12-01'; lines[3].recurring = false; lines[4].status = 'EXISTING_RECURRING';
  const grouped = groupFamilyRecurringLines(lines);
  assert.equal(grouped.length, 4); assert.equal(grouped[0].amount, 200); assert.equal(grouped[0].groupLines.length, 2);
  assert.equal(groupFamilyRecurringLines(lines, 'SEPARATE').length, 5);
});

test('one family page creates one fixed discounted series, grants both members, and records one aggregate receipt', async () => {
  const f = fixture(true); const quote = await (await f.quote()).json();
  assert.equal(quote.items.length, 1); assert.equal(quote.items[0].amount, 702);
  assert.deepEqual(quote.items[0].groupLines.map(line => line.amount), [252, 450]);
  const request = { batchId: quote.batchId, itemId: quote.items[0].id, acknowledged: true };
  const responses = await Promise.all([f.post('family-split/create', request), f.post('family-split/create', request)]);
  assert.ok(responses.some(response => response.status === 200));
  assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
  assert.equal(f.calls.find(call => call.url.endsWith('/GetUrl')).body.Items[0].UnitPrice, 702);
  assert.equal((await f.post('family-split/verify', request)).status, 200);
  assert.equal(f.state().payload.payments.length, 0);
  const [payer, child] = f.state().payload.users;
  assert.equal(payer.recurringMemberships.OPEN_GYM.amount, 252);
  assert.equal(child.recurringMemberships.GROUP_ANNUAL.amount, 450);
  assert.equal(child.recurringMemberships.GROUP_ANNUAL.groupAmount, 702);
  assert.equal(child.recurringMemberships.GROUP_ANNUAL.status, 'PENDING_FIRST_CHARGE');
  const sale = f.signed.get('sale-1'); Object.assign(sale, { RecurringSaleChargeNumber: 1, TransactionParamJ: 0 });
  assert.equal((await f.post('webhook', sale)).status, 200);
  assert.equal((await f.post('webhook', sale)).status, 200);
  assert.equal(f.state().payload.payments.length, 1);
  assert.equal(f.state().payload.payments[0].amount, 702);
  assert.equal(f.state().payload.payments[0].traineeId, 'payer');
  assert.equal(f.state().payload.payments[0].familyMemberPlans.length, 2);
  assert.equal(f.state().payload.users[1].recurringMemberships.GROUP_ANNUAL.status, 'ACTIVE');
  // Failure affects this shared instruction, not an unrelated paid nutrition plan.
  f.state().payload.users[1].secondaryMemberships = ['NUTRITION_PLAN'];
  Object.assign(sale, { SaleId: 'decline', CustomerTransactionId: 'decline', RecurringSaleChargeNumber: 2, TransactionStatus: 4 });
  f.signed.set('decline', sale);
  assert.equal((await f.post('webhook', sale)).status, 200);
  for (const user of f.state().payload.users) assert.equal(Object.values(user.recurringMemberships)[0].status, 'PAYMENT_FAILED');
  assert.equal(f.state().payload.users[1].membershipStatus, 'ACTIVE');
  assert.equal(f.state().payload.payments.length, 1);
});

test('payer can select independent payments and cannot combine/change an already dispatched quote', async () => {
  const f = fixture(true); let quote = await (await f.quote({ familyPaymentGrouping: 'SEPARATE' })).json();
  assert.equal(quote.items.length, 2);
  quote = await (await f.quote({ familyPaymentGrouping: 'COMBINED' })).json(); assert.equal(quote.items.length, 1);
  const request = { batchId: quote.batchId, itemId: quote.items[0].id, acknowledged: true };
  await f.post('family-split/create', request);
  const retry = await (await f.quote({ familyPaymentGrouping: 'SEPARATE' })).json();
  assert.equal(retry.batchId, quote.batchId); assert.equal(retry.items.length, 1);
  assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 1);
});

test('separate one-off family payments do not require a recurring merchant page or recurring activation', async () => {
  const f = fixture(); f.state().payload.settings.membershipPlans[0].paymentMode = 'ONE_TIME';
  f.env.RIVHIT_ENABLE_RECURRING = 'false'; f.env.RIVHIT_ENABLE_FAMILY_SPLIT_RECURRING = 'false'; f.env.RIVHIT_RECURRING_GROUP_PRIVATE_TOKEN = '';
  const response = await f.quote({ familyPaymentGrouping: 'SEPARATE' }); assert.equal(response.status, 200);
  const quote = await response.json(); assert.equal(quote.items.length, 2); assert.ok(quote.items.every(item => !item.recurring));
  const input = { batchId: quote.batchId, itemId: quote.items[0].id, acknowledged: true };
  assert.equal((await f.post('family-split/create', input)).status, 200);
  assert.equal(f.calls[0].body.GroupPrivateToken, 'fixture-manual');
  assert.equal(f.calls[0].body.CreateRecurringSale, false);
});

test('a non-lead unlinked/frozen/already-paid member blocks the entire group before provider dispatch', async () => {
  for (const mutate of [f => { f.state().payload.users[1].familyPayerId = 'other'; },
    f => { f.state().payload.users[1].isMembershipFrozen = true; },
    f => { f.state().payload.payments.push({ traineeId: 'child', membershipTypePurchased: 'GROUP_ANNUAL', status: 'PAID', amount: 500, timestamp: new Date().toISOString() }); }]) {
    const f = fixture(true); const quote = await (await f.quote()).json(); mutate(f);
    const response = await f.post('family-split/create', { batchId: quote.batchId, itemId: quote.items[0].id, acknowledged: true, amount: 1 });
    assert.ok([403, 409].includes(response.status)); assert.equal(f.calls.length, 0);
  }
});

test('adding a family member never replaces or recharges an existing shared instruction', async () => {
  const f = fixture(true); const quote = await (await f.quote()).json();
  const request = { batchId: quote.batchId, itemId: quote.items[0].id, acknowledged: true };
  await f.post('family-split/create', request); await f.post('family-split/verify', request);
  f.state().payload.users.push({ id: 'new', name: 'New', role: 'TRAINEE', familyId: 'fam', familyPayerId: 'payer' });
  const added = { memberId: 'new', memberName: 'New', membershipType: 'GROUP_ANNUAL', participation: 'INCLUDED' };
  const next = await (await f.quote({ familyMembersCount: 3, familyMemberPlans: [...members, added], discountCode: undefined })).json();
  assert.equal(next.items.filter(item => item.status === 'EXISTING_RECURRING').length, 2);
  const due = next.items.find(item => item.status === 'READY'); assert.equal(due.memberId, 'new'); assert.equal(due.amount, 500); assert.equal(due.groupLines, undefined);
  assert.equal((await f.post('family-split/create', { batchId: next.batchId, itemId: due.id, acknowledged: true })).status, 200);
  assert.equal(f.calls.filter(call => call.url.endsWith('/GetUrl')).length, 2);
});

test('manager must explicitly confirm shared cancellation; all linked entitlements end together', async () => {
  const f = fixture(true); const quote = await (await f.quote()).json();
  const input = { batchId: quote.batchId, itemId: quote.items[0].id, acknowledged: true };
  await f.post('family-split/create', input);
  const sale = f.signed.get('sale-1'); Object.assign(sale, { RecurringSaleChargeNumber: 1, TransactionParamJ: 0 });
  await f.post('webhook', sale); f.asManager();
  const paymentId = f.state().payload.payments[0].id;
  let cancellations = 0; const providerFetch = f.env.RIVHIT_FETCH;
  f.env.RIVHIT_FETCH = async (url, options) => {
    if (url.endsWith('/RecurringSaleCancel')) { cancellations++; return Response.json({ Status: 0 }); }
    return providerFetch(url, options);
  };
  assert.equal((await f.post('admin/cancel-recurring', { paymentId, reason: 'fixture cancellation' })).status, 409);
  assert.equal(cancellations, 0);
  assert.equal((await f.post('admin/cancel-recurring', { paymentId, reason: 'fixture cancellation', confirmFamilySeries: true })).status, 200);
  assert.equal(cancellations, 1);
  for (const user of f.state().payload.users) assert.ok(Object.values(user.recurringMemberships)[0].cancelledAt);
  assert.ok(f.state().payload.recurringCheckouts[0].cancelledAt);
});

function fixture(bothRecurring = false) {
  const configuredCatalog = structuredClone(catalog);
  if (bothRecurring) configuredCatalog[1].paymentMode = 'RECURRING';
  let state = { revision: 1, payload: { users: [
    { id: 'payer', name: 'Payer Example', role: 'TRAINEE', familyId: 'fam', isFamilyPayer: true, membershipType: 'OPEN_GYM', membershipStatus: 'DEBT' },
    { id: 'child', name: 'Child Example', role: 'TRAINEE', familyId: 'fam', familyPayerId: 'payer', membershipType: 'GROUP_ANNUAL', membershipStatus: 'DEBT' }
  ], settings: { membershipPlans: configuredCatalog }, payments: [], discountCodes: [{ id: 'coupon', code: 'SAVE10', discountPercent: 10, isSingleUse: true }], messages: [] } };
  let journal = { revision: 0, payload: null }, signed = new Map(), calls = [], count = 0;
  let authenticatedUser = 'payer', authenticatedRole = 'TRAINEE';
  const continuations = new Map();
  const clone = obj => structuredClone(obj);
  const store = {
    async getRecurringContinuation(_club, order) { return continuations.get(order) || null; },
    async saveRecurringContinuation(_club, order, user, encrypted) { continuations.set(order, { user_id: user, encrypted_checkout: encrypted }); },
    async getSession() { return { club_id: 'test', user_id: authenticatedUser }; },
    async getAccount() { return { user_id: authenticatedUser, role: authenticatedRole }; },
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
  const quote = (patch = {}) => post('create', { userId: 'payer', membershipType: 'FAMILY_MEMBERSHIP', mode: 'PRIMARY', familyBillingMode: 'CUSTOM_COMBINED',
    familyMembersCount: 2, familyMemberPlans: members, discountCode: 'SAVE10', quoteOnly: true, ...patch });
  return { env, quote, post, state: () => state, journal: () => journal, calls, signed,
    authenticate: user => { authenticatedUser = user; }, asManager: () => { authenticatedRole = 'MANAGER'; } };
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
