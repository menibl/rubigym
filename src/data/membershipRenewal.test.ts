import test from 'node:test';
import assert from 'node:assert/strict';
import { activePlanExpiry, primaryMembershipExpired, emptyFamilyPurchase } from './membershipRenewal';
import { User, MembershipType } from '../types';
import { resizeFamilyPlans, familyPurchaseAmount } from './familyMembership';
const user = { id: 'u', name: 'Parent', membershipType: MembershipType.OPEN_GYM, membershipStatus: 'ACTIVE', membershipExpiry: '2026-11-01', membershipExpiryExclusive: true } as User;
test('calendar expiry is exclusive and renewal warning is hidden for genuinely current access', () => {
  assert.equal(primaryMembershipExpired(user, '2026-11-01'), true);
  assert.equal(activePlanExpiry(user, MembershipType.OPEN_GYM, '2026-10-31'), '2026-11-01');
  assert.equal(primaryMembershipExpired(user, '2026-10-31'), false);
  assert.equal(primaryMembershipExpired({ ...user, membershipExpiryExclusive: false }, '2026-11-01'), false);
  assert.equal(primaryMembershipExpired({ ...user, membershipExpiry: undefined }, '2026-11-01'), false);
  assert.equal(primaryMembershipExpired({ ...user, membershipExpiry: '2027-11-01', membershipPlanExpiries: { OPEN_GYM: '2026-11-01' } }, '2026-11-01'), false);
});
test('approved recurring setup overrides expired old receipt; a declined/cancelled series does not', () => {
  const recurring = { ...user, recurringMemberships: { OPEN_GYM: { status: 'PENDING_FIRST_CHARGE', endsAt: '2027-11-01' } } } as User;
  assert.equal(primaryMembershipExpired(recurring, '2026-11-01'), false);
  assert.equal(activePlanExpiry(recurring, MembershipType.OPEN_GYM, '2026-11-01'), '2027-11-01');
  recurring.recurringMemberships!.OPEN_GYM.status = 'PAYMENT_FAILED';
  assert.equal(activePlanExpiry(recurring, MembershipType.OPEN_GYM, '2026-11-01'), null);
});
test('family checkout drafts start at zero without importing paid plan selections or mutating users', () => {
  const members = [user, { ...user, id: 'child', name: 'Child' }]; const before = JSON.stringify(members);
  const draft = emptyFamilyPurchase(members);
  assert.ok(draft.every(plan => plan.participation === 'NOT_STARTED' && !plan.membershipType));
  assert.equal(familyPurchaseAmount('CUSTOM_COMBINED', 2, draft), 0);
  assert.equal(familyPurchaseAmount('CUSTOM_COMBINED', 3, resizeFamilyPlans(draft, 3, 'Parent', 'u')), 0);
  assert.equal(JSON.stringify(members), before);
});
