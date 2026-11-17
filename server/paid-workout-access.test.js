import test from 'node:test';
import assert from 'node:assert/strict';
import { paidWorkoutPlanUntil, hasPaidWorkoutPlanAccess } from '../shared/paid-workout-access.js';
import { hasActiveWorkoutGymMembership } from '../shared/workout-gym-access.js';
import { payloadForUser, mergePayloadForUser } from './auth.js';
import { clubDate } from '../shared/membership-calendar.js';

const now = new Date('2026-11-17T12:00:00Z');
const user = { id: 'u', role: 'TRAINEE', membershipType: 'OPEN_GYM', membershipStatus: 'ACTIVE', membershipExpiry: '2026-12-01' };
const receipt = { id: 'paid', traineeId: 'u', membershipTypePurchased: 'WORKOUT_COACHING', amount: 300,
  status: 'PAID', date: '2026-10-06', billingTermMonths: 3, isMock: false, provider: 'RIVHIT' };

test('Erez regression: a current paid program unlocks without adding a secondary membership', () => {
  const before = structuredClone(user);
  assert.equal(paidWorkoutPlanUntil(user, [receipt], now), '2027-01-06');
  assert.equal(hasPaidWorkoutPlanAccess(user, [receipt], now), true);
  assert.equal(hasActiveWorkoutGymMembership(user, now), true);
  assert.deepEqual(user, before);
  assert.equal(user.secondaryMemberships, undefined);
});

test('pending, refunded, mock, future, unknown-term or wrong-beneficiary receipts never grant receipt access', () => {
  for (const patch of [{ status: 'PENDING' }, { status: 'REFUNDED' }, { isMock: true }, { paymentMethod: 'בדיקה' },
    { date: '2026-12-01' }, { date: '2026-02-31' }, { billingTermMonths: undefined }, { billingTermMonths: 0 },
    { billingTermMonths: 1.5 }, { billingTermMonths: 121 }, { traineeId: 'another' }, { recurringChargeNumber: 0 },
    { membershipTypePurchased: 'PERSONAL_TRAINING' }, { membershipTypePurchased: 'DUO_TRAINING' }, { membershipTypePurchased: 'NUTRITION_PLAN' }]) {
    assert.equal(paidWorkoutPlanUntil(user, [{ ...receipt, ...patch }], now), undefined, JSON.stringify(patch));
  }
  assert.equal(paidWorkoutPlanUntil(user, [{ ...receipt, date: '2026-01-01' }], now), undefined);
  // A later gym expiry cannot extend an expired program receipt.
  assert.equal(paidWorkoutPlanUntil({ ...user, membershipExpiry: '2099-01-01' }, [{ ...receipt, date: '2026-01-01' }], now), undefined);
});

test('refund replays, later refunds and credited-away purchases do not revive paid entitlement', () => {
  for (const reversal of [{ ...receipt, status: 'REFUNDED' },
    { ...receipt, id: 'refund', status: 'REFUNDED', date: '2026-11-01' },
    { id: 'credit', status: 'PAID', familyCreditSourcePaymentId: receipt.id },
    { id: 'upgrade', traineeId: 'u', status: 'PAID', upgradeFrom: 'WORKOUT_COACHING', date: '2026-11-01' }]) {
    assert.equal(paidWorkoutPlanUntil(user, [receipt, reversal], now), undefined);
  }
  assert.equal(paidWorkoutPlanUntil(user, [receipt, { ...receipt, id: 'renew', date: '2026-11-10' }], now), '2027-02-10');
});

test('program terms use club dates and calendar-month clamping, including the last valid day', () => {
  const january = { ...receipt, date: '2026-01-31', billingTermMonths: 1 };
  assert.equal(paidWorkoutPlanUntil(user, [january], new Date('2026-02-28T12:00:00Z')), '2026-02-28');
  assert.equal(paidWorkoutPlanUntil(user, [january], new Date('2026-03-01T12:00:00Z')), undefined);
  assert.equal(paidWorkoutPlanUntil(user, [receipt], new Date('2027-01-06T21:59:00Z')), '2027-01-06');
  assert.equal(paidWorkoutPlanUntil(user, [receipt], new Date('2027-01-06T22:01:00Z')), undefined);
});

test('family program receipts are scoped to included beneficiaries and never borrow the aggregate gym term', () => {
  const family = { ...receipt, traineeId: 'payer', membershipTypePurchased: 'FAMILY_MEMBERSHIP', billingTermMonths: 12,
    familyMemberPlans: [{ memberId: 'u', participation: 'INCLUDED', membershipType: 'OPEN_GYM', additionalPlans: [{ membershipType: 'WORKOUT_COACHING' }] }] };
  assert.equal(paidWorkoutPlanUntil(user, [family], now), undefined);
  const scoped = { ...user, membershipPlanExpiries: { WORKOUT_COACHING: '2027-01-06' } };
  assert.equal(paidWorkoutPlanUntil(scoped, [family], now), '2027-01-06');
  assert.equal(paidWorkoutPlanUntil({ ...scoped, id: 'other-child' }, [family], now), undefined);
  assert.equal(paidWorkoutPlanUntil(scoped, [{ ...family, familyMemberPlans: [{ ...family.familyMemberPlans[0], participation: 'SKIP' }] }], now), undefined);
});

test('server supplies only beneficiary entitlement, not payer financial details, and never trusts client projections', () => {
  const today = clubDate();
  const trainee = { ...user, familyId: 'family', familyPayerId: 'payer', membershipPlanExpiries: { WORKOUT_COACHING: '2099-01-01' } };
  const family = { ...receipt, date: today, traineeId: 'payer', amount: 777, membershipTypePurchased: 'FAMILY_MEMBERSHIP',
    familyMemberPlans: [{ memberId: 'u', participation: 'INCLUDED', membershipType: 'WORKOUT_COACHING' }] };
  const payload = { users: [trainee, { id: 'payer', role: 'TRAINEE', familyId: 'family' }], payments: [family],
    workoutPlans: [{ id: 'program', traineeId: 'u', exercises: [{ name: 'exercise' }] }] };
  const visible = payloadForUser(payload, 'u', 'TRAINEE');
  assert.equal(visible.users[0].workoutPlanPurchaseAccessUntil, '2099-01-01');
  assert.deepEqual(visible.payments, []);
  assert.ok(!JSON.stringify(visible).includes('777'));
  assert.equal(visible.workoutPlans.length, 1);
  const refunded = payloadForUser({ ...payload, users: visible.users, payments: [{ ...family, status: 'REFUNDED' }] }, 'u', 'TRAINEE');
  assert.equal(refunded.users[0].workoutPlanPurchaseAccessUntil, undefined);
  for (const role of ['MANAGER', 'TRAINEE']) {
    const incoming = structuredClone(payload);
    incoming.users[0].workoutPlanPurchaseAccessUntil = '2099-01-01';
    const merged = mergePayloadForUser({ ...payload, payments: [] }, incoming, role === 'MANAGER' ? 'manager' : 'u', role);
    assert.equal(merged.users[0].workoutPlanPurchaseAccessUntil, undefined);
  }
  const forged = payloadForUser({ ...payload, payments: [], users: [{ ...trainee, workoutPlanPurchaseAccessUntil: '2099-01-01' }] }, 'u', 'TRAINEE');
  assert.equal(forged.users[0].workoutPlanPurchaseAccessUntil, undefined);
});

test('a paid program does not grant gym access or expose program content when gym entitlement is absent', () => {
  for (const patch of [{ membershipExpiry: '2026-11-01' }, { membershipType: 'WORKOUT_COACHING' }, { isMembershipFrozen: true },
    { membershipStatus: 'DEBT' }, { recurringMemberships: { OPEN_GYM: { status: 'PAYMENT_FAILED', endsAt: '2099-01-01' } } }]) {
    assert.equal(hasActiveWorkoutGymMembership({ ...user, ...patch }, now), false);
  }
  const blocked = { ...user, membershipExpiry: '2000-01-01' };
  assert.deepEqual(payloadForUser({ users: [blocked], payments: [receipt], workoutPlans: [{ id: 'program', traineeId: 'u' }] }, 'u', 'TRAINEE').workoutPlans, []);
  for (const membershipType of ['OPEN_GYM', 'GROUP_ANNUAL']) {
    assert.equal(hasActiveWorkoutGymMembership({ ...user, membershipType, recurringMemberships: { [membershipType]: { status: 'PENDING_FIRST_CHARGE', endsAt: '2027-11-01' } } }, now), true);
  }
});
