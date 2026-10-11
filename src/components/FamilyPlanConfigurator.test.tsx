import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { FamilyPlanConfigurator } from './FamilyPlanConfigurator';
import { MembershipType, MembershipPlanConfig } from '../types';
import { familyPlanCatalog, familyPurchaseAmount } from '../data/familyMembership';

test('family options use club labels, prices, periods and active custom plans', () => {
  const catalog: MembershipPlanConfig[] = [
    { id: 'CUSTOM_PLAN', label: 'מסלול המועדון החדש', description: '', price: 720, category: 'PRIMARY', active: true, billingPeriod: 'THREE_MONTHS' },
    { id: MembershipType.OPEN_GYM, label: 'מסלול מושבת', description: '', price: 280, category: 'PRIMARY', active: false },
    { id: MembershipType.FAMILY_MEMBERSHIP, label: 'משפחה', description: '', price: 900, category: 'PRIMARY', active: true }
  ];
  assert.deepEqual(familyPlanCatalog(catalog).map(plan => plan.id), ['CUSTOM_PLAN']);
  const html = renderToStaticMarkup(<FamilyPlanConfigurator mode="CUSTOM_COMBINED" onModeChange={() => {}} count={2} onCountChange={() => {}} payerName="Parent" plans={[]} onPlansChange={() => {}} membershipPlans={catalog} />);
  assert.match(html, /מסלול המועדון החדש/);
  assert.match(html, /720/);
  assert.match(html, /שלושה חודשים/);
  assert.doesNotMatch(html, /מסלול מושבת/);
});

test('partial purchase shows zero for excluded retired plan and a consistent total', () => {
  const plans = [{ memberId: 'p', memberName: 'Parent', membershipType: MembershipType.GROUP_ANNUAL, participation: 'SKIP' as const }, { memberId: 'c', memberName: 'Child', membershipType: MembershipType.OPEN_GYM }];
  assert.equal(familyPurchaseAmount('CUSTOM_COMBINED', 2, plans), 280);
  const html = renderToStaticMarkup(<FamilyPlanConfigurator mode="CUSTOM_COMBINED" onModeChange={() => {}} count={2} onCountChange={() => {}} payerName="Parent" payerId="p" plans={plans} onPlansChange={() => {}} familyMembers={[{ id: 'p', name: 'Parent' }, { id: 'c', name: 'Child' }]} />);
  assert.match(html, /₪0/);
  assert.match(html, /₪280/);
  assert.doesNotMatch(html, /המסלול אינו זמין/);
  assert.match(html, /טרם מתחיל/);
});

test('family checkout offers only custom pricing and linked member selectors', () => {
  const html = renderToStaticMarkup(<FamilyPlanConfigurator mode="CUSTOM_COMBINED" onModeChange={() => {}} count={2} onCountChange={() => {}} payerName="Parent" payerId="p" plans={[{ memberId: 'p', memberName: 'Parent', membershipType: MembershipType.OPEN_GYM }, { memberId: 'c', memberName: 'Child', membershipType: MembershipType.OPEN_GYM }]} onPlansChange={() => {}} familyMembers={[{ id: 'p', name: 'Parent' }, { id: 'c', name: 'Child' }]} />);
  assert.match(html, /משפחתי מותאם/);
  assert.doesNotMatch(html, /משפחתי חודשי|משפחתי שנתי/);
  assert.match(html, /value="c"/);
  assert.doesNotMatch(html, /<input[^>]*type="text"/);
  assert.match(html, /560/);
});

test('each family member can select multiple additions with catalog prices and separate quantities', () => {
  const catalog: MembershipPlanConfig[] = [
    { id: MembershipType.OPEN_GYM, label: 'כניסה למועדון', description: '', price: 280, category: 'PRIMARY', active: true },
    { id: MembershipType.WORKOUT_PLAN, label: 'תוכנית אימון', description: '', price: 310, category: 'ADD_ON', active: true },
    { id: MembershipType.NUTRITION_PLAN, label: 'תוכנית תזונה', description: '', price: 420, category: 'ADD_ON', active: true },
    { id: MembershipType.PERSONAL_TRAINING, label: 'אימון אישי', description: '', price: 190, category: 'ADD_ON', active: true }
  ];
  const plans = [
    { memberId: 'p', memberName: 'Parent', membershipType: MembershipType.OPEN_GYM, additionalPlans: [{ membershipType: MembershipType.WORKOUT_PLAN }, { membershipType: MembershipType.NUTRITION_PLAN }] },
    { memberId: 'c', memberName: 'Child', membershipType: MembershipType.OPEN_GYM, additionalPlans: [{ membershipType: MembershipType.PERSONAL_TRAINING, trainingSessionsCount: 3 }] }
  ];
  assert.equal(familyPurchaseAmount('CUSTOM_COMBINED', 2, plans, catalog), 1860);
  const html = renderToStaticMarkup(<FamilyPlanConfigurator mode="CUSTOM_COMBINED" onModeChange={() => {}} count={2} onCountChange={() => {}} payerName="Parent" payerId="p" plans={plans} onPlansChange={() => {}} membershipPlans={catalog} familyMembers={[{ id: 'p', name: 'Parent' }, { id: 'c', name: 'Child' }]} />);
  assert.equal((html.match(/type="checkbox"[^>]*checked=""/g) || []).length, 3);
  assert.match(html, /מסלולים נוספים — Parent/);
  assert.match(html, /מסלולים נוספים — Child/);
  assert.match(html, /1,010/);
  assert.match(html, /850/);
  assert.match(html, /1,860/);
  assert.match(html, /type="number"[^>]*value="3"/);
});

test('retired additions are visible and removable instead of silently disappearing', () => {
  const catalog: MembershipPlanConfig[] = [
    { id: MembershipType.OPEN_GYM, label: 'כניסה למועדון', description: '', price: 280, category: 'PRIMARY', active: true },
    { id: MembershipType.NUTRITION_PLAN, label: 'תזונה ישנה', description: '', price: 350, category: 'ADD_ON', active: false }
  ];
  const html = renderToStaticMarkup(<FamilyPlanConfigurator mode="CUSTOM_COMBINED" onModeChange={() => {}} count={2} onCountChange={() => {}} payerName="Parent" payerId="p" plans={[{ memberId: 'p', memberName: 'Parent', membershipType: MembershipType.OPEN_GYM, additionalPlans: [{ membershipType: MembershipType.NUTRITION_PLAN }] }, { memberId: 'c', memberName: 'Child', membershipType: MembershipType.OPEN_GYM }]} onPlansChange={() => {}} membershipPlans={catalog} familyMembers={[{ id: 'p', name: 'Parent' }, { id: 'c', name: 'Child' }]} />);
  assert.match(html, /תזונה ישנה/);
  assert.match(html, /אינו זמין לרכישה/);
  assert.match(html, /הסר תוספת/);
});
