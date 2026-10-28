import test from 'node:test';
import assert from 'node:assert/strict';
import { adminMembershipSummary } from '../shared/admin-membership-summary.js';

const now = new Date('2026-10-28T12:00:00Z');
const user = { id: 'u', membershipType: 'WORKOUT_PLAN', membershipStatus: 'ACTIVE', membershipExpiry: '2027-01-28' };
const receipt = (type, patch = {}) => ({ id: `pay-${type}`, traineeId: 'u', membershipTypePurchased: type, status: 'PAID', amount: type === 'OPEN_GYM' ? 280 : 300, date: '2026-10-28', isMock: false, ...patch });

test('program purchase as primary cannot hide a paid, still-current Open Gym purchase', () => {
  const rows = adminMembershipSummary(user, [receipt('WORKOUT_PLAN', { billingTermMonths: 3 }), receipt('OPEN_GYM')], now);
  assert.deepEqual(rows.map(row => row.type), ['WORKOUT_PLAN', 'OPEN_GYM']);
  assert.equal(rows[0].primary, true); assert.equal(rows[0].expiry, '2027-01-28');
  assert.equal(rows[1].primary, false); assert.equal(rows[1].assigned, false);
  assert.equal(rows[1].expiry, '2026-11-01'); assert.equal(rows[1].exclusive, true); assert.equal(rows[1].active, true);
});
test('reverse purchase order discovers program term from original receipt, not current catalog', () => {
  const rows = adminMembershipSummary({ ...user, membershipType: 'OPEN_GYM', membershipExpiry: '2026-11-01', membershipExpiryExclusive: true }, [receipt('OPEN_GYM'), receipt('WORKOUT_PLAN', { billingTermMonths: 3 })], now);
  assert.equal(rows.find(row => row.type === 'WORKOUT_PLAN').expiry, '2027-01-28');
  assert.equal(rows.find(row => row.type === 'OPEN_GYM').expiry, '2026-11-01');
});
test('expired purchases, simulations, pending/refunded transactions and unknown terms do not become additions', () => {
  for (const patch of [{ date: '2026-09-28' }, { isMock: true }, { paymentMethod: 'סליקה מדומה' }, { status: 'PENDING' }, { status: 'REFUNDED' }, { date: '2026-11-01' }]) {
    assert.deepEqual(adminMembershipSummary(user, [receipt('OPEN_GYM', patch)], now).map(row => row.type), ['WORKOUT_PLAN']);
  }
  assert.equal(adminMembershipSummary(user, [receipt('NUTRITION_PLAN')], now).length, 1);
});
test('refund deduplication and newer refund prevent resurrection of a previous paid record', () => {
  const paid = receipt('OPEN_GYM');
  const refunded = { ...paid, status: 'REFUNDED' };
  assert.equal(adminMembershipSummary(user, [paid, refunded], now).length, 1);
  assert.equal(adminMembershipSummary(user, [paid, { ...refunded, id: 'another', date: '2026-10-29' }], now).length, 1);
  const assigned = adminMembershipSummary({ ...user, secondaryMemberships: ['OPEN_GYM'], membershipPlanExpiries: { OPEN_GYM: '2026-11-01' } }, [paid, refunded], now);
  assert.equal(assigned[1].active, false); assert.match(assigned[1].status, /החזר/);
});
test('Open credit already consumed by upgrade or family checkout is not a fresh active addition', () => {
  const open = receipt('OPEN_GYM');
  for (const extra of [{ upgradeFrom: 'OPEN_GYM' }, { familyCreditSourcePaymentId: open.id }]) {
    assert.equal(adminMembershipSummary(user, [open, receipt('GROUP_MONTHLY', extra)], now).some(row => row.type === 'OPEN_GYM'), false);
  }
});
test('family additional plans are discovered only for the included member', () => {
  const family = receipt('FAMILY_MEMBERSHIP', { traineeId: 'payer', familyMemberPlans: [{ memberId: 'u', membershipType: 'WORKOUT_PLAN', additionalPlans: [{ membershipType: 'OPEN_GYM' }], participation: 'INCLUDED' }, { memberId: 'other', membershipType: 'GROUP_MONTHLY' }] });
  const rows = adminMembershipSummary(user, [family], now);
  assert.deepEqual(rows.map(row => row.type), ['WORKOUT_PLAN', 'OPEN_GYM']);
  assert.equal(rows[1].expiry, '2026-11-01');
  family.familyMemberPlans[0].participation = 'SKIP';
  assert.equal(adminMembershipSummary(user, [family], now).length, 1);
});
test('each recorded plan expiry wins independently; an unpaid assigned addon is not labelled paid', () => {
  const rows = adminMembershipSummary({ ...user, secondaryMemberships: ['OPEN_GYM', 'DUO_TRAINING'], membershipPlanExpiries: { OPEN_GYM: '2026-12-01' } }, [receipt('OPEN_GYM')], now);
  assert.equal(rows[1].expiry, '2026-12-01'); assert.equal(rows[2].expiry, null);
  assert.equal(rows[2].status, 'תוקף לא תועד');
});
test('delayed recurring notifications do not grant access based on their arrival date', () => {
  const recurring = receipt('OPEN_GYM', { recurringChargeNumber: 2 });
  assert.equal(adminMembershipSummary(user, [recurring], now).length, 1);
  assert.equal(adminMembershipSummary({ ...user, membershipPlanExpiries: { OPEN_GYM: '2026-11-01' } }, [recurring], now)[1].expiry, '2026-11-01');
});
test('month-end program terms clamp to valid dates; freeze/cancellation are explicit and no source data changes', () => {
  const source = { ...user, secondaryMemberships: [], isMembershipFrozen: true };
  const payments = [receipt('OPEN_GYM')]; const snapshot = JSON.stringify({ source, payments });
  assert.equal(adminMembershipSummary(source, payments, now)[1].status, 'מוקפא');
  assert.equal(adminMembershipSummary({ ...source, cancellationEffectiveDate: '2026-10-28' }, payments, now)[1].status, 'מבוטל');
  assert.equal(JSON.stringify({ source, payments }), snapshot);
  const rows = adminMembershipSummary({ id: 'u' }, [receipt('WORKOUT_PLAN', { date: '2026-01-31', billingTermMonths: 1 })], new Date('2026-02-01T10:00:00Z'));
  assert.equal(rows[0].expiry, '2026-02-28');
});
