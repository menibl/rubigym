import test from 'node:test';
import assert from 'node:assert/strict';
import { createMembershipTerm } from '../src/data/membershipPolicy';
import { MembershipType } from '../src/types';

test('annual group paid access is monthly but its annual commitment remains separate', () => {
  const term = createMembershipTerm(MembershipType.GROUP_ANNUAL, new Date('2026-10-15T12:00:00Z'));
  assert.equal(term.membershipExpiry, '2026-11-01');
  assert.equal(term.membershipCommitmentEndsAt, '2027-10-15');
  assert.equal(term.recurringBillingMonths, 12);
  assert.equal(term.monthlyBillingDay, 1);
});
test('non-calendar plans preserve configured durations and new purchases clear manual override', () => {
  const term = createMembershipTerm(MembershipType.PERSONAL_TRAINING, new Date('2026-10-15T12:00:00Z'), {
    id: 'PERSONAL_TRAINING', label: '', description: '', price: 350, active: true, category: 'PRIMARY', billingPeriod: 'THREE_MONTHS'
  });
  assert.equal(term.membershipExpiry, '2027-01-15');
  assert.equal(term.membershipExpiryExclusive, false);
  assert.equal(term.membershipExpiryManualOverride, false);
  assert.equal(createMembershipTerm(MembershipType.DEDICATED_GROUP_HALF_YEAR, new Date('2026-10-15T12:00:00Z')).membershipExpiry, '2027-04-15');
});
