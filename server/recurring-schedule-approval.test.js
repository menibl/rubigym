import test from 'node:test';
import assert from 'node:assert/strict';
import { proposeRecurringSchedule } from './recurring-schedule-approval.js';
import { recurringServicePeriod } from '../shared/recurring-service-period.js';
import { prepareRecurringIdSync } from './recurring-id-sync.js';
import { applyRecurringMembershipEvent } from '../shared/recurring-membership-events.js';
import { syncFixture } from './fixtures/recurring-sync.js';
import { mergePayloadForUser } from './auth.js';
import { reconcileRecurringDaily } from './recurring-reconciliation.js';
import { openRecurringCheckout } from './recurring-checkout.js';

const policyFor = f => proposeRecurringSchedule({ payload: f.payload, userId: f.userId, seriesId: f.seriesId, details: f.details,
  anchorCharge: 2, serviceMonth: '2026-12', reason: 'Advance payment for the next service month', managerId: 'manager', checkedAt: Date.parse('2026-11-21T12:00:00Z') }).policy;
const fixture = () => { const f = syncFixture(); f.payload.recurringCheckouts[0].recurringSaleId = f.seriesId;
  f.details.RecurringDay = 22; f.details.EndDate = '2027-10-22T00:00:00+03:00'; f.now = new Date('2026-11-23T12:00:00Z'); return f; };

test('Peleg: approved charge 1 October28 covers November, charge 2 November22 covers December until January1, no future charge is paid', () => {
  const f = fixture(), policy = policyFor(f);
  assert.deepEqual(recurringServicePeriod(policy, 1), { month: '2026-11', expiresAt: '2026-12-01', endsAt: '2027-11-01' });
  assert.deepEqual(recurringServicePeriod(policy, 2), { month: '2026-12', expiresAt: '2027-01-01', endsAt: '2027-11-01' });
  assert.equal(recurringServicePeriod(policy, 12).expiresAt, '2027-11-01');
  assert.throws(() => prepareRecurringIdSync(f));
  const readOnly = structuredClone(f.payload);
  assert.equal(prepareRecurringIdSync({ ...f, scheduleApproval: policy }).preview.serviceExpiry, '2027-01-01');
  assert.deepEqual(f.payload, readOnly);
  f.payload.recurringCheckouts[0].scheduleApproval = { ...policy, id: 'approval' };
  const prepared = prepareRecurringIdSync(f);
  let payload = applyRecurringMembershipEvent(f.payload, prepared.order, prepared.payments[0], f.now);
  assert.equal(payload.users[0].recurringMemberships.OPEN_GYM.paidUntil, '2026-12-01');
  assert.equal(payload.users[0].recurringMemberships.OPEN_GYM.endsAt, '2027-11-01');
  const second = { recurringSaleId: f.seriesId, recurringChargeNumber: 2, providerChargeDate: '2026-11-22', saleId: 'actual-charge-2' };
  payload = applyRecurringMembershipEvent(payload, prepared.order, second, f.now);
  assert.equal(payload.users[0].recurringMemberships.OPEN_GYM.paidUntil, '2027-01-01');
  assert.deepEqual(applyRecurringMembershipEvent(payload, prepared.order, second, f.now), payload);
  assert.equal(payload.payments.length, 0, 'projection never manufactures ledger entries');
});

test('approval never bypasses ownership, amount, active/automatic/currency/12-count terms or subsequent schedule drift', () => {
  for (const mutate of [f => { f.details.Amount = 999; f.payload.recurringCheckouts[0].orderSnapshot = { o: 'o', u: 'u', m: 'OPEN_GYM', rc: 1, a: 280, re: '2027-10-01' }; },
    f => { f.details.IsActive = false; }, f => { f.details.AutoCharge = false; }, f => { f.details.Currency = 2; },
    f => { f.details.RecurringSaleCount = 11; }, f => { f.details.PhoneNumber = '0509999999'; }, f => { f.details.IpnUrl = 'https://other.test/'; }]) {
    const f = fixture(), policy = policyFor(f); mutate(f); assert.throws(() => prepareRecurringIdSync({ ...f, scheduleApproval: policy }));
  }
  for (const mutate of [f => { f.details.RecurringDay = 21; }, f => { f.details.EndDate = '2027-10-21'; },
    f => { f.details.CreationDate = '2026-10-27T12:00:00+03:00'; }]) {
    const f = fixture(); f.payload.recurringCheckouts[0].scheduleApproval = { ...policyFor(f), id: 'approval' }; mutate(f);
    assert.throws(() => prepareRecurringIdSync(f));
  }
  const f = fixture(); f.payload.recurringCheckouts[0].recurringSaleId = undefined; assert.throws(() => policyFor(f));
  f.payload.recurringCheckouts[0].recurringSaleId = f.seriesId;
  for (const [anchorCharge, serviceMonth] of [[0, '2026-12'], [13, '2026-12'], [2, '2027-12'], [2, '2026-13'], [2, '2026-02']]) {
    assert.throws(() => proposeRecurringSchedule({ payload: f.payload, userId: f.userId, seriesId: f.seriesId, details: f.details,
      anchorCharge, serviceMonth, reason: 'test reason', managerId: 'manager', checkedAt: Date.now() }));
  }
});

test('generic manager, coach and trainee saves cannot forge or erase a schedule approval', () => {
  const f = fixture(); f.payload.recurringCheckouts[0].scheduleApproval = { ...policyFor(f), id: 'approved' };
  for (const role of ['MANAGER', 'COACH', 'TRAINEE']) {
    const incoming = structuredClone(f.payload); incoming.recurringCheckouts[0].scheduleApproval.serviceMonth = '2099-12';
    assert.deepEqual(mergePayloadForUser(f.payload, incoming, 'u', role).recurringCheckouts, f.payload.recurringCheckouts);
  }
});

test('one approved family schedule projects only its signed beneficiaries and preserves unrelated memberships', () => {
  const f = fixture(); f.payload.users.push({ id: 'v', role: 'TRAINEE', name: 'Second', phone: '0541234567' }, { id: 'other', role: 'TRAINEE', membershipExpiry: '2028-01-01' });
  const checkout = f.payload.recurringCheckouts[0];
  checkout.orderSnapshot = { o: 'o', u: 'u', m: 'OPEN_GYM', rc: 1, a: 560, re: checkout.endsAt, t: Date.parse(f.details.CreationDate),
    gp: [{ memberId: 'u', membershipType: 'OPEN_GYM', amount: 280, mode: 'PRIMARY' }, { memberId: 'v', membershipType: 'OPEN_GYM', amount: 280, mode: 'PRIMARY' }] };
  f.details.Amount = 560; f.history.RecurringSaleHistoryList[0].Amount = 560;
  checkout.scheduleApproval = { ...policyFor(f), id: 'family-approval' };
  const prepared = prepareRecurringIdSync(f), result = applyRecurringMembershipEvent(f.payload, prepared.order, prepared.payments[0], f.now);
  for (const user of result.users.filter(user => ['u', 'v'].includes(user.id))) {
    assert.equal(user.recurringMemberships.OPEN_GYM.paidUntil, '2026-12-01');
    assert.equal(user.recurringMemberships.OPEN_GYM.scheduleApprovalId, 'family-approval');
  }
  assert.deepEqual(result.users.find(user => user.id === 'other'), f.payload.users.find(user => user.id === 'other'));
});

test('approved final service month remains in daily checks and duplicate checkout guard after original expiry', async () => {
  const f = fixture(), checkout = f.payload.recurringCheckouts[0]; checkout.scheduleApproval = { ...policyFor(f), id: 'approval' };
  let checked = 0;
  await reconcileRecurringDaily({ getAllClubStates: async () => [{ club_id: 'baly-wellness', payload: f.payload }], claimPushDelivery: async () => true },
    { PAYMENT_SIGNING_SECRET: 'fixture', PUBLIC_APP_URL: f.appUrl }, async () => { checked++; }, new Date('2027-10-15T12:00:00Z'));
  assert.equal(checked, 1);
  checkout.endsAt = '2026-11-01'; // The guard must use approved coverage, not the superseded term.
  assert.equal(openRecurringCheckout(f.payload, 'u', 'OPEN_GYM'), checkout);
  checkout.scheduleApproval = undefined;
  assert.equal(openRecurringCheckout(f.payload, 'u', 'OPEN_GYM'), undefined);
});
