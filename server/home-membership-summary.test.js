import test from 'node:test';
import assert from 'node:assert/strict';
import { homeMembershipSummary } from '../shared/home-membership-summary.js';

const now = new Date('2026-10-06T09:00:00Z');
const user = { id: 'u', membershipType: 'GROUP_MONTHLY', membershipStatus: 'ACTIVE', membershipExpiry: '2026-11-01', membershipExpiryExclusive: true };
const paid = (type, extra = {}) => ({ id: type, traineeId: 'u', membershipTypePurchased: type, status: 'PAID', date: '2026-10-01', ...extra });

test('home displays current paid monthly expiry including manager override', () => {
  const rows = homeMembershipSummary(user, [paid('GROUP_MONTHLY')], now);
  assert.equal(rows[0].status, 'שולם'); assert.equal(rows[0].expiry, '2026-11-01');
  assert.equal(homeMembershipSummary({ ...user, membershipExpiry: '2026-12-01', membershipExpiryManualOverride: true }, [paid('GROUP_MONTHLY')], now)[0].expiry, '2026-12-01');
});

test('combined personal and duo show separate balances and do not borrow primary expiry', () => {
  const rows = homeMembershipSummary({ ...user, secondaryMemberships: ['PERSONAL_TRAINING', 'DUO_TRAINING'], personalTrainingRemaining: 5, personalTrainingCardSize: 10, duoTrainingRemaining: 2, duoTrainingCardSize: 3 }, [paid('GROUP_MONTHLY')], now);
  assert.equal(rows[1].remaining, 5); assert.equal(rows[1].size, 10);
  assert.equal(rows[2].remaining, 2); assert.equal(rows[2].size, 3);
  assert.equal(rows[1].expiry, null); assert.equal(rows[1].status, 'לא תועד תשלום');
});

test('program term is derived only from its receipt snapshot, not the current price list', () => {
  const rows = homeMembershipSummary({ ...user, membershipType: 'OPEN_GYM', secondaryMemberships: ['WORKOUT_PLAN'] }, [paid('OPEN_GYM'), paid('WORKOUT_PLAN', { billingTermMonths: 3 })], now);
  assert.equal(rows[1].expiry, '2027-01-01'); assert.equal(rows[1].status, 'שולם');
  assert.equal(rows[0].expiry, '2026-11-01');
});

test('family member sees payment only when that member and selected plan were included', () => {
  const family = paid('FAMILY_MEMBERSHIP', { traineeId: 'payer', familyMemberPlans: [{ memberId: 'u', membershipType: 'GROUP_MONTHLY', participation: 'INCLUDED' }, { memberId: 'other', membershipType: 'PERSONAL_TRAINING' }] });
  assert.equal(homeMembershipSummary(user, [family], now)[0].status, 'שולם');
  family.familyMemberPlans[0].participation = 'SKIP';
  assert.equal(homeMembershipSummary(user, [family], now)[0].status, 'פעיל');
});

test('expired, frozen, pending, refunded and manually approved states remain distinguishable', () => {
  assert.equal(homeMembershipSummary(user, [paid('GROUP_MONTHLY')], new Date('2026-11-01T09:00:00Z'))[0].status, 'שולם · פג תוקף');
  assert.match(homeMembershipSummary({ ...user, isMembershipFrozen: true }, [paid('GROUP_MONTHLY')], now)[0].status, /מוקפא/);
  assert.equal(homeMembershipSummary({ ...user, registrationPaymentPending: true }, [], now)[0].status, 'ממתין לתשלום');
  assert.equal(homeMembershipSummary(user, [paid('GROUP_MONTHLY', { status: 'REFUNDED' })], now)[0].status, 'הוחזר');
  assert.equal(homeMembershipSummary({ ...user, offlinePaymentApproved: true }, [], now)[0].status, 'מאושר ידנית');
});

test('unknown expiry and card size are not fabricated; program flags appear once', () => {
  const rows = homeMembershipSummary({ ...user, requestedWorkoutPlan: true, nutritionPlanPaid: true, secondaryMemberships: ['WORKOUT_PLAN', 'OPEN_PUNCH_CARD'], punchCardRemaining: 4 }, [], now);
  assert.deepEqual(rows.map(r => r.type), ['GROUP_MONTHLY', 'WORKOUT_PLAN', 'OPEN_PUNCH_CARD', 'NUTRITION_PLAN']);
  assert.equal(rows[1].expiry, null); assert.equal(rows[2].remaining, 4); assert.equal(rows[2].size, null);
  assert.deepEqual(homeMembershipSummary({ id: 'u' }, [], now), []);
});
