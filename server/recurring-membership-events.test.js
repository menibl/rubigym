import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRecurringMembershipEvent, rivhitChargeDate } from '../shared/recurring-membership-events.js';
import { recurringEvent } from '../shared/recurring-billing.js';
import { membershipTypesForAccess, recurringSessionBlocked } from '../shared/recurring-access.js';
import { membershipExpired } from '../shared/membership-calendar.js';
import { paymentReminderEligible } from '../shared/payment-reminder-policy.js';
import { mergePayloadForUser } from './auth.js';

const now = new Date('2026-10-28T12:00:00Z');
const order = { o: 'order', u: 'u', rc: 1, re: '2027-10-01', t: now.getTime(), m: 'OPEN_GYM', a: 450, c: 'TEN' };
const setup = { saleId: 'setup', recurringSaleId: 'series', recurringChargeNumber: 0, recurringPending: true };
const paid = charge => ({ saleId: `paid-${charge}`, recurringSaleId: 'series', recurringChargeNumber: charge, providerChargeDate: `2026-${String(10 + charge).padStart(2, '0')}-01` });
const failed = charge => ({ saleId: `failed-${charge}`, recurringSaleId: 'series', recurringChargeNumber: charge, recurringFailed: true, recurringFailureCode: '5' });
const fixture = () => ({ settings: { membershipPlans: [{ id: 'OPEN_GYM', label: 'Open Gym' }] },
  users: [{ id: 'u', name: 'User', role: 'TRAINEE', membershipType: 'OPEN_GYM', membershipStatus: 'DEBT', registrationPaymentPending: true },
    { id: 'manager', name: 'Manager', role: 'MANAGER' }, { id: 'coach', name: 'Coach', role: 'COACH' }], payments: [], messages: [] });

test('setup activates without a paid receipt and alerts trainee and all staff exactly once', () => {
  const initial = fixture(); const payload = applyRecurringMembershipEvent(initial, order, setup, now);
  const user = payload.users[0];
  assert.equal(user.membershipStatus, 'ACTIVE'); assert.equal(user.registrationPaymentPending, false);
  assert.equal(user.recurringMemberships.OPEN_GYM.status, 'PENDING_FIRST_CHARGE');
  assert.equal(user.recurringMemberships.OPEN_GYM.amount, 450);
  assert.equal(payload.payments.length, 0);
  assert.deepEqual(payload.messages.map(message => message.receiverId).sort(), ['coach', 'manager', 'u']);
  assert.ok(payload.messages.every(message => message.systemGenerated && message.content.includes('ממתין לאישור החיוב הראשון')));
  assert.equal(applyRecurringMembershipEvent(payload, order, setup, now), payload);
  assert.equal(initial.users[0].membershipStatus, 'DEBT');
  assert.equal(membershipExpired(user, '2026-12-01'), false); // Delay is not a verified decline.
  assert.equal(paymentReminderEligible(user, '2026-11-01'), false);
  assert.equal(membershipExpired(user, '2027-10-01'), true);
});

test('a failed recurring addition preserves unrelated paid primary plan, expiry and balance', () => {
  const initial = fixture(); Object.assign(initial.users[0], { membershipType: 'PERSONAL_TRAINING', membershipStatus: 'ACTIVE', membershipExpiry: '2027-01-28', personalTrainingRemaining: 6 });
  let payload = applyRecurringMembershipEvent(initial, order, setup, now);
  payload = applyRecurringMembershipEvent(payload, order, failed(1), now);
  const user = payload.users[0];
  assert.equal(user.membershipType, 'PERSONAL_TRAINING'); assert.equal(user.membershipExpiry, '2027-01-28');
  assert.equal(user.personalTrainingRemaining, 6); assert.equal(user.membershipStatus, 'ACTIVE');
  assert.deepEqual(membershipTypesForAccess(user), ['PERSONAL_TRAINING']);
  assert.equal(recurringSessionBlocked(user, { timeSlot: '12:00-13:00' }), true);
  assert.equal(recurringSessionBlocked(user, { isPersonalTraining: true }), false);
  assert.equal(payload.payments.length, 0);
  assert.equal(payload.messages.filter(message => message.content.includes('נכשל')).length, 3);
  assert.equal(applyRecurringMembershipEvent(payload, order, failed(1), now), payload);
});

test('failed primary Open cannot hide valid secondary group access that includes Open', () => {
  const initial = fixture(); initial.users[0].secondaryMemberships = ['GROUP_MONTHLY'];
  const payload = applyRecurringMembershipEvent(applyRecurringMembershipEvent(initial, order, setup, now), order, failed(1), now);
  assert.equal(payload.users[0].membershipStatus, 'ACTIVE');
  assert.equal(recurringSessionBlocked(payload.users[0], { timeSlot: '12:00-13:00' }), false);
  assert.equal(recurringSessionBlocked(payload.users[0], { allowedMemberships: ['GROUP_MONTHLY'] }), false);
});

test('expired failed primary term does not expire an unrelated secondary plan with its own recorded term', () => {
  const initial = fixture(); initial.users[0].secondaryMemberships = ['PERSONAL_TRAINING'];
  initial.users[0].membershipPlanExpiries = { PERSONAL_TRAINING: '2027-01-28' };
  const payload = applyRecurringMembershipEvent(applyRecurringMembershipEvent(initial, order, setup, now), order, failed(1), now);
  assert.equal(membershipExpired(payload.users[0], '2026-12-01'), false);
  assert.equal(membershipExpired(payload.users[0], '2027-02-01'), true);
});

test('cancellation keeps only the already-paid term and a late setup cannot revive the contract', () => {
  const payload = applyRecurringMembershipEvent(fixture(), order, setup, now);
  Object.assign(payload.users[0].recurringMemberships.OPEN_GYM, { cancelledAt: now.toISOString(), endsAt: '2026-10-28' });
  assert.equal(applyRecurringMembershipEvent(payload, order, paid(1), now), payload);
  assert.equal(membershipTypesForAccess(payload.users[0], '2026-10-28').includes('OPEN_GYM'), false);
});

test('late setup/failure do not undo payment; older paid event does not unblock newer failure', () => {
  let payload = applyRecurringMembershipEvent(fixture(), order, setup, now);
  payload = applyRecurringMembershipEvent(payload, order, paid(1), now);
  assert.equal(payload.users[0].recurringMemberships.OPEN_GYM.paidUntil, '2026-12-01');
  assert.equal(applyRecurringMembershipEvent(payload, order, failed(1), now), payload);
  assert.equal(applyRecurringMembershipEvent(payload, order, setup, now), payload);
  payload = applyRecurringMembershipEvent(payload, order, failed(2), now);
  assert.equal(payload.users[0].membershipStatus, 'DEBT');
  assert.equal(applyRecurringMembershipEvent(payload, order, { ...paid(1), saleId: 'late' }, now), payload);
  assert.equal(applyRecurringMembershipEvent(payload, order, setup, now), payload);
  payload = applyRecurringMembershipEvent(payload, order, paid(2), now);
  assert.equal(payload.users[0].membershipStatus, 'ACTIVE');
  assert.equal(payload.users[0].recurringMemberships.OPEN_GYM.amount, 450);
  assert.equal(payload.users[0].recurringMemberships.OPEN_GYM.discountCode, 'TEN');
});

test('a signed creation cannot replace a still-active different series or reopen an expired setup', () => {
  const payload = applyRecurringMembershipEvent(fixture(), order, setup, now);
  assert.throws(() => applyRecurringMembershipEvent(payload, order, { ...setup, recurringSaleId: 'other' }, now), /CONFLICT/);
  assert.equal(applyRecurringMembershipEvent(payload, order, setup, new Date('2027-10-01T12:00:00Z')), payload);
});

test('charge dates are strict provider dates; failures require explicit numeric status and series/counter', () => {
  assert.equal(rivhitChargeDate({ TransactionDateTime: '01.11.2026 00:02:00' }), '2026-11-01');
  assert.equal(rivhitChargeDate({ TransactionDateTime: '31.02.2026 00:02:00' }), undefined);
  assert.equal(recurringEvent({ TransactionStatus: 5, RecurringId: 'series', RecurringSaleChargeNumber: 1 }).failed, true);
  for (const patch of [{ TransactionStatus: 'error' }, { RecurringId: '' }, { RecurringSaleChargeNumber: 13 }, { RecurringSaleCount: 0 }]) {
    assert.throws(() => recurringEvent({ TransactionStatus: 5, RecurringId: 'series', RecurringSaleChargeNumber: 1, ...patch }));
  }
});

test('stale or forged generic state cannot change provider-owned approval or checkout audit', () => {
  const current = applyRecurringMembershipEvent(fixture(), order, setup, now);
  current.recurringCheckouts = [{ orderId: 'order' }];
  const incoming = structuredClone(current);
  incoming.users[0].recurringMemberships.OPEN_GYM.status = 'ACTIVE';
  incoming.recurringCheckouts = [];
  for (const role of ['TRAINEE', 'MANAGER', 'COACH']) {
    const merged = mergePayloadForUser(current, incoming, role === 'TRAINEE' ? 'u' : role === 'MANAGER' ? 'manager' : 'coach', role);
    assert.equal(merged.users[0].recurringMemberships.OPEN_GYM.status, 'PENDING_FIRST_CHARGE');
    assert.equal(merged.recurringCheckouts.length, 1);
  }
});

test('server rejects generic new group bookings on failed plan while preserving cancellation', () => {
  let current = fixture(); current.users[0].secondaryMemberships = ['PERSONAL_TRAINING'];
  current = applyRecurringMembershipEvent(applyRecurringMembershipEvent(current, order, setup, now), order, failed(1), now);
  current.sessions = [{ id: 'group', allowedMemberships: ['GROUP_MONTHLY'], registeredUsers: [] }, { id: 'old', registeredUsers: ['u'] }];
  current.openGymSessions = [{ id: 'open', timeSlot: '12:00-13:00', registeredUsers: [] }];
  const incoming = structuredClone(current);
  incoming.sessions[0].registeredUsers = ['u']; incoming.sessions[1].registeredUsers = []; incoming.openGymSessions[0].registeredUsers = ['u'];
  const merged = mergePayloadForUser(current, incoming, 'u', 'TRAINEE');
  assert.deepEqual(merged.openGymSessions[0].registeredUsers, []);
  assert.deepEqual(merged.sessions[0].registeredUsers, []);
  assert.deepEqual(merged.sessions[1].registeredUsers, []);
});
