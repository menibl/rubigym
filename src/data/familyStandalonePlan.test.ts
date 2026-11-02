import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { familyMemberPlanPrice, selectFamilyAdditionalPlan } from './familyMembership';
import { DEFAULT_MEMBERSHIP_PLAN_CONFIGS, MembershipType, type FamilyMemberPlanSelection } from '../types';

const empty = (): FamilyMemberPlanSelection => ({ memberId: 'child', memberName: 'Test Child',
  participation: 'INCLUDED', membershipType: '' as MembershipType, additionalPlans: [] });

test('personal and duo can each be the only family purchase, with the selected quantity and price', () => {
  for (const type of [MembershipType.PERSONAL_TRAINING, MembershipType.DUO_TRAINING]) {
    const draft = empty();
    const next = selectFamilyAdditionalPlan(draft, { membershipType: type, trainingSessionsCount: 6 }, true);
    assert.equal(next.membershipType, type);
    assert.equal(next.trainingSessionsCount, 6);
    assert.deepEqual(next.additionalPlans, []);
    assert.equal(next.participation, 'INCLUDED');
    assert.equal(next.memberId, 'child');
    assert.equal(familyMemberPlanPrice(next, DEFAULT_MEMBERSHIP_PLAN_CONFIGS),
      DEFAULT_MEMBERSHIP_PLAN_CONFIGS.find(plan => plan.id === type)!.price * 6);
    assert.equal(draft.membershipType, '');
    assert.ok(!JSON.stringify(next).includes(MembershipType.OPEN_GYM));
  }
});

test('additional choices preserve the first purchase, counts and deselection semantics', () => {
  let next = selectFamilyAdditionalPlan(empty(), { membershipType: MembershipType.PERSONAL_TRAINING, trainingSessionsCount: 5 }, true);
  next = selectFamilyAdditionalPlan(next, { membershipType: MembershipType.DUO_TRAINING, trainingSessionsCount: 3 }, true);
  assert.equal(next.membershipType, MembershipType.PERSONAL_TRAINING);
  assert.equal(next.trainingSessionsCount, 5);
  assert.deepEqual(next.additionalPlans, [{ membershipType: MembershipType.DUO_TRAINING, trainingSessionsCount: 3 }]);
  next = selectFamilyAdditionalPlan(next, { membershipType: MembershipType.DUO_TRAINING }, false);
  assert.deepEqual(next.additionalPlans, []);
  const existing = { ...empty(), membershipType: MembershipType.OPEN_GYM };
  assert.equal(selectFamilyAdditionalPlan(existing, { membershipType: MembershipType.PERSONAL_TRAINING, trainingSessionsCount: 2 }, true).membershipType, MembershipType.OPEN_GYM);
});

test('family form uses the standalone selection helper and explains that a gym subscription is optional', () => {
  const source = readFileSync(new URL('../components/FamilyPlanConfigurator.tsx', import.meta.url), 'utf8');
  assert.match(source, /updatePlan\(index, selectFamilyAdditionalPlan\(plan,/);
  assert.match(source, /אימונים אישיים או זוגיים בלבד, ללא מנוי Open Gym או קבוצתי/);
});
