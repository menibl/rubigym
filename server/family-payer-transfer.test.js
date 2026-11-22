import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { recurringCustomerPost } from './index.js';
import { prepareFamilyPayerTransfer, applyFamilyPayerTransfer, hydrateFamilyTransferAudit } from '../shared/family-payer-transfer.js';
import { transferFingerprint, persistFamilyPayerTransfer } from './family-payer-transfer.js';
import { syncRecurringCustomerName } from './recurring-customer-sync.js';
import { mergePayloadForUser, payloadForUser } from './auth.js';
import { clubDate } from '../shared/membership-calendar.js';

const sid = '11111111-1111-4111-8111-111111111111';
function fixture() {
  const contract = { seriesId: sid, orderId: 'original', status: 'ACTIVE', endsAt: '2099-01-01', amount: 280, groupAmount: 840, groupSize: 3 };
  let state = { revision: 1, payload: { users: [
    { id: 'adi', name: 'עדי פנצ׳ר', username: 'adi-login', role: 'TRAINEE', familyId: 'family', familyName: 'פנצ׳ר', isFamilyPayer: true,
      phone: '0500000001', familyMembersCount: 4, familyBillingMode: 'CUSTOM_COMBINED', familyMemberPlans: [{ memberId: 'adi', membershipType: 'OPEN_GYM' }],
      membershipType: 'OPEN_GYM', membershipStatus: 'ACTIVE', membershipExpiry: '2026-12-01', personalTrainingRemaining: 4,
      healthDeclarationSignatureName: 'חתימה מקורית', recurringMemberships: { OPEN_GYM: structuredClone(contract) } },
    { id: 'oren', name: 'אורן פנצ׳ר', username: 'oren-login', role: 'TRAINEE', familyId: 'family', familyName: 'פנצ׳ר', familyPayerId: 'adi',
      phone: '0500000002', membershipType: 'OPEN_GYM', membershipStatus: 'ACTIVE', membershipExpiry: '2026-12-01',
      recurringMemberships: { OPEN_GYM: structuredClone(contract) } },
    { id: 'child', name: 'נדב פנצ׳ר', username: 'child-login', role: 'TRAINEE', familyId: 'family', familyName: 'פנצ׳ר', familyPayerId: 'adi',
      phone: '0500000003', membershipType: 'OPEN_GYM', membershipStatus: 'ACTIVE', membershipExpiry: '2026-12-01',
      recurringMemberships: { OPEN_GYM: structuredClone(contract) } },
    { id: 'outside', name: 'מתאמן אחר', role: 'TRAINEE', phone: '0500000004' },
    { id: 'manager', name: 'מנהל לדוגמה', role: 'MANAGER' }
  ], recurringCheckouts: [{ orderId: 'original', userId: 'adi', recurringSaleId: sid, endsAt: '2099-01-01', stage: 'PAGE_AVAILABLE',
    orderSnapshot: { o: 'original', u: 'adi', a: 840, gp: ['adi', 'oren', 'child'].map(memberId => ({ memberId, membershipType: 'OPEN_GYM', amount: 280 })) } }],
  payments: [{ id: 'historical', traineeId: 'adi', providerRecurringSaleId: sid, amount: 840, status: 'PAID' }], sessions: [{ id: 'existing-booking', registeredUsers: ['child'] }] } };
  const details = { CustomerFirstName: 'עדי', CustomerLastName: 'BALY', PhoneNumber: '0500000001', Amount: 840, Currency: 1,
    IsActive: true, AutoCharge: true, Token: 'fixture-card-token-must-remain-private', RecurringSaleCount: 12,
    RecurringCycle: 3, RecurringDay: 22, RecurringStep: 1, EndDate: '/Date(4102444800000)/' };
  const calls = []; let writes = 0, actor = 'manager', role = 'MANAGER';
  const store = {
    getSession: async () => ({ user_id: actor, club_id: 'baly-wellness' }),
    getAccount: async () => ({ user_id: actor, role }), getClubState: async () => state,
    withRecurringSeriesLocks: async (_club, _ids, run) => ({ locked: true, result: await run() }),
    putClubState: async (_club, payload, revision) => { if (revision !== state.revision) return { conflict: true }; state = { payload, revision: revision + 1 }; return { conflict: false }; },
    transferFamilyPayer: async (_club, command) => {
      const old = state.payload.familyPayerTransfers?.find(record => record.id === command.id);
      if (old) return { record: old, repeated: true };
      const plan = prepareFamilyPayerTransfer(state.payload, command.fromId, command.toId, clubDate());
      assert.equal(transferFingerprint(plan), command.planHash);
      const record = { id: command.id, familyId: plan.familyId, fromId: plan.fromId, toId: plan.toId, fromName: plan.fromName, toName: plan.toName,
        approvedBy: command.managerId, approvedAt: new Date().toISOString(), memberIds: plan.memberIds,
        seriesIds: plan.instructions.map(item => item.seriesId), providerNames: command.providerNames, providerProofs: command.providerProofs };
      state = { payload: applyFamilyPayerTransfer(state.payload, plan, record), revision: state.revision + 1 }; writes++;
      return { record, repeated: false };
    }
  };
  const env = { STATE_STORE: store, RIVHIT_ENVIRONMENT: 'test', RIVHIT_GROUP_PRIVATE_TOKEN: 'fixture',
    RIVHIT_RECURRING_GROUP_PRIVATE_TOKEN: 'fixture-recurring', PAYMENT_SIGNING_SECRET: 'fixture-preview-signing-secret', PUBLIC_APP_URL: 'https://club.test/',
    RIVHIT_FETCH: async (url, init) => {
      const path = new URL(url).pathname.split('/').at(-1), body = JSON.parse(init.body); calls.push({ path, body });
      if (path === 'RecurringSaleDetails') return Response.json({ Status: 0, data: structuredClone(details) });
      assert.equal(path, 'RecurringSaleUpdateCustomer');
      assert.deepEqual(Object.keys(body).sort(), ['CustomerFirstName', 'CustomerLastName', 'RecurringSaleId']);
      Object.assign(details, { CustomerFirstName: body.CustomerFirstName, CustomerLastName: body.CustomerLastName });
      return Response.json({ Status: 0 });
    }
  };
  const post = (body, origin = 'https://club.test') => worker.fetch(new Request('https://club.test/api/admin/family-payer-transfer', {
    method: 'POST', headers: { Cookie: 'baly_session=fixture', Origin: origin }, body: JSON.stringify(body)
  }), env);
  return { state: () => state, store, env, post, calls, details, writes: () => writes, as: (id, nextRole) => { actor = id; role = nextRole; } };
}

test('preview is read-only; confirm transfers family roles, queues verified names, preserves card and all entitlements/history', async () => {
  const f = fixture(), before = structuredClone(f.state().payload);
  const response = await f.post({ action: 'preview', fromId: 'adi', toId: 'oren' });
  assert.equal(response.status, 200); const preview = await response.json();
  assert.equal(preview.preview.toName, 'אורן פנצ׳ר'); assert.equal(preview.preview.instructions.length, 1);
  assert.equal(JSON.stringify(preview).includes(f.details.Token), false);
  assert.equal(f.writes(), 0); assert.deepEqual(f.state().payload, before);
  const confirmed = await f.post({ action: 'confirm', token: preview.token, confirmed: true });
  assert.equal(confirmed.status, 200); assert.equal((await confirmed.json()).transfer.status, 'PENDING');
  assert.equal(f.writes(), 1); assert.equal(f.calls.some(call => call.path !== 'RecurringSaleDetails'), false);
  const after = f.state().payload;
  assert.equal(JSON.stringify(after).includes(f.details.Token), false);
  assert.equal(after.users.find(user => user.id === 'oren').isFamilyPayer, true);
  assert.equal(after.users.find(user => user.id === 'oren').familyMembersCount, 4); // Preserve purchased capacity, not just the 3 current profiles.
  assert.equal(after.users.find(user => user.id === 'adi').familyPayerId, 'oren');
  assert.equal(after.users.find(user => user.id === 'child').familyPayerId, 'oren');
  for (const original of before.users) {
    const user = after.users.find(member => member.id === original.id);
    for (const field of ['name', 'username', 'role', 'phone', 'membershipType', 'membershipStatus', 'membershipExpiry', 'personalTrainingRemaining', 'healthDeclarationSignatureName']) assert.deepEqual(user[field], original[field], field);
  }
  assert.deepEqual(after.payments, before.payments); assert.deepEqual(after.sessions, before.sessions);
  assert.deepEqual(after.recurringCheckouts[0].orderSnapshot, before.recurringCheckouts[0].orderSnapshot);
  const cardBefore = f.details.Token;
  assert.equal(await syncRecurringCustomerName(f.store, 'baly-wellness', sid, (path, body) => recurringCustomerPost(path, body, f.env)), 'SYNCED');
  assert.equal(f.details.CustomerFirstName, 'אורן'); assert.equal(f.details.Token, cardBefore); assert.equal(f.details.Amount, 840);
  const status = await f.post({ action: 'status', userId: 'adi' }); assert.equal((await status.json()).transfer.status, 'COMPLETE');
  await f.post({ action: 'confirm', token: preview.token, confirmed: true });
  assert.equal(f.writes(), 1); assert.equal(f.calls.filter(call => call.path === 'RecurringSaleUpdateCustomer').length, 1);
});

test('an old image can omit new JSON fields without losing the durable audit or changing membership data on recovery', () => {
  const original = { users: [{ id: 'a', membershipExpiry: '2026-12-01' }], payments: [{ id: 'historical' }] };
  const record = { id: 'approval', familyId: 'family', toId: 'new-head', approvedAt: '2026-11-22T10:00:00Z',
    instructions: [{ seriesId: sid, sourcePayerId: 'old-head' }], providerNames: { [sid]: 'Old Payer' } };
  const recovered = hydrateFamilyTransferAudit(original, [record]);
  assert.equal(recovered.recurringInvoicePayers[0].invoicePayerId, 'new-head');
  assert.equal(recovered.familyPayerTransfers[0].id, 'approval');
  assert.deepEqual(recovered.users, original.users); assert.deepEqual(recovered.payments, original.payments);
});

test('provider changing a financial/card field during a name update does not claim completion', async () => {
  const f = fixture(); const preview = await (await f.post({ action: 'preview', fromId: 'adi', toId: 'oren' })).json();
  await f.post({ action: 'confirm', token: preview.token, confirmed: true });
  const post = async (path, body) => {
    const result = await recurringCustomerPost(path, body, f.env);
    if (path === '/RecurringSaleUpdateCustomer') f.details.Amount = 999;
    return result;
  };
  assert.equal(await syncRecurringCustomerName(f.store, 'baly-wellness', sid, post), 'NAME_SYNC_BILLING_CHANGED_REVIEW');
  assert.equal((await (await f.post({ action: 'status', userId: 'adi' })).json()).transfer.status, 'REVIEW_REQUIRED');
  assert.equal(f.calls.filter(call => call.path === 'RecurringSaleUpdateCustomer').length, 1);
});

test('a historical recurring receipt without a verified current series cannot be mistaken for no instructions', () => {
  const f = fixture(); f.state().payload.recurringCheckouts = [];
  f.state().payload.users.forEach(user => { delete user.recurringMemberships; });
  assert.throws(() => prepareFamilyPayerTransfer(f.state().payload, 'adi', 'oren', clubDate()), /שאינה משויכת/);
});

test('a lost confirmation response is recovered by status or replay, without another database transfer or provider mutation', async () => {
  const f = fixture(); const preview = await (await f.post({ action: 'preview', fromId: 'adi', toId: 'oren' })).json();
  const original = f.store.transferFamilyPayer;
  f.store.transferFamilyPayer = async (...args) => { await original(...args); throw new Error('fixture lost response after commit'); };
  assert.equal((await f.post({ action: 'confirm', token: preview.token, confirmed: true })).status, 409);
  assert.equal((await (await f.post({ action: 'status', userId: 'adi' })).json()).transfer.managementStatus, 'APPLIED');
  assert.equal((await f.post({ action: 'confirm', token: preview.token, confirmed: true })).status, 200);
  assert.equal(f.writes(), 1);
  assert.equal(f.calls.some(call => call.path !== 'RecurringSaleDetails'), false);
});

test('an overlapping name worker blocks confirmation rather than racing the invoice payer assignment', async () => {
  const f = fixture(); const preview = await (await f.post({ action: 'preview', fromId: 'adi', toId: 'oren' })).json();
  f.store.withRecurringSeriesLocks = async () => ({ locked: false });
  assert.equal((await f.post({ action: 'confirm', token: preview.token, confirmed: true })).status, 409);
  assert.equal(f.writes(), 0);
  assert.equal(f.calls.some(call => call.path !== 'RecurringSaleDetails'), false);
});

for (const role of ['COACH', 'TRAINEE']) test(`only a manager can preview or transfer, not ${role}`, async () => {
  const f = fixture(); f.as('adi', role);
  assert.equal((await f.post({ action: 'preview', fromId: 'adi', toId: 'oren' })).status, 403);
  assert.equal(f.calls.length, 0); assert.equal(f.writes(), 0);
});

for (const variant of ['outside', 'self', 'missing-name', 'open-page', 'cross-family-series', 'wrong-phone']) test(`unsafe transfer is blocked: ${variant}`, async () => {
  const f = fixture(); let toId = 'oren';
  if (variant === 'outside') toId = 'outside';
  if (variant === 'self') toId = 'adi';
  if (variant === 'missing-name') f.state().payload.users.find(user => user.id === 'oren').name = 'אורן';
  if (variant === 'open-page') f.state().payload.recurringCheckouts.push({ userId: 'adi', orderId: 'not-completed', stage: 'PAGE_AVAILABLE' });
  if (variant === 'cross-family-series') f.state().payload.users.find(user => user.id === 'outside').recurringMemberships = { OPEN_GYM: { seriesId: sid, orderId: 'original' } };
  if (variant === 'wrong-phone') f.details.PhoneNumber = '0500000009';
  assert.equal((await f.post({ action: 'preview', fromId: 'adi', toId })).status, 409);
  assert.equal(f.writes(), 0); assert.equal(f.calls.some(call => call.path !== 'RecurringSaleDetails'), false);
});

for (const variant of ['tampered', 'other-manager', 'changed-family', 'changed-card', 'cross-origin', 'not-confirmed']) test(`preview cannot be replayed with changed authority/conditions: ${variant}`, async () => {
  const f = fixture(); const preview = await (await f.post({ action: 'preview', fromId: 'adi', toId: 'oren' })).json();
  if (variant === 'tampered') preview.token = `x${preview.token}`;
  if (variant === 'other-manager') f.as('other-manager', 'MANAGER');
  if (variant === 'changed-family') f.state().payload.users.find(user => user.id === 'oren').name = 'שם אחר';
  if (variant === 'changed-card') f.details.Token = 'different-card-token';
  const response = await f.post({ action: 'confirm', token: preview.token, confirmed: variant !== 'not-confirmed' }, variant === 'cross-origin' ? 'https://foreign.test' : undefined);
  assert.notEqual(response.status, 200); assert.equal(f.writes(), 0);
  assert.equal(f.calls.some(call => call.path !== 'RecurringSaleDetails'), false);
});

test('a stale manager save cannot erase the payer transfer or forge its approval, while old payer loses family management rights', async () => {
  const f = fixture(), stale = structuredClone(f.state().payload);
  const preview = await (await f.post({ action: 'preview', fromId: 'adi', toId: 'oren' })).json();
  await f.post({ action: 'confirm', token: preview.token, confirmed: true });
  const current = f.state().payload;
  const merged = mergePayloadForUser(current, { ...stale, familyPayerTransfers: [], recurringInvoicePayers: [] }, 'manager', 'MANAGER');
  assert.equal(merged.users.find(user => user.id === 'oren').isFamilyPayer, true);
  assert.equal(merged.users.find(user => user.id === 'adi').isFamilyPayer, false);
  assert.equal(merged.users.find(user => user.id === 'child').familyPayerId, 'oren');
  assert.deepEqual(merged.familyPayerTransfers, current.familyPayerTransfers);
  assert.deepEqual(merged.recurringInvoicePayers, current.recurringInvoicePayers);
  const incoming = structuredClone(current); incoming.users.find(user => user.id === 'child').personalTrainingCardSize = 100;
  assert.notEqual(mergePayloadForUser(current, incoming, 'adi', 'TRAINEE').users.find(user => user.id === 'child').personalTrainingCardSize, 100);
  incoming.users.push({ id: 'forged-new-child', role: 'TRAINEE', familyId: 'family', familyPayerId: 'adi' });
  assert.equal(mergePayloadForUser(current, incoming, 'adi', 'TRAINEE').users.some(user => user.id === 'forged-new-child'), false);
  assert.deepEqual(payloadForUser(current, 'adi', 'TRAINEE').familyPayerTransfers, []);
});

for (const failAt of ['', 'auth-update', 'missing-account']) test(`database transfer is atomic and never changes login credentials (${failAt || 'success'})`, async () => {
  const f = fixture(); const before = structuredClone(f.state().payload);
  const plan = prepareFamilyPayerTransfer(before, 'adi', 'oren', clubDate());
  const command = { id: 'test-command', managerId: 'manager', fromId: 'adi', toId: 'oren', planHash: transferFingerprint(plan), providerNames: { [sid]: 'עדי BALY' }, providerProofs: { [sid]: 'proof' } };
  const calls = []; let released = false;
  const client = { release() { released = true; }, async query(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith('SELECT payload')) return { rows: [{ payload: before }] };
    if (sql.startsWith('SELECT user_id')) return { rowCount: failAt === 'missing-account' ? 2 : 3 };
    if (sql.startsWith('UPDATE auth_accounts') && failAt === 'auth-update') throw new Error('fixture auth write failed');
    return { rowCount: 1 };
  } };
  const run = persistFamilyPayerTransfer({ connect: async () => client }, 'club', command);
  if (failAt) await assert.rejects(run); else assert.equal((await run).record.toId, 'oren');
  assert.equal(calls.at(-1).sql, failAt ? 'ROLLBACK' : 'COMMIT');
  assert.equal(calls.some(call => /password_hash|username_normalized|auth_sessions|DELETE/i.test(call.sql)), false);
  assert.equal(released, true);
});
