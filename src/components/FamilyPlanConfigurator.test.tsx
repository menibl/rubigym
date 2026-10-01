import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { FamilyPlanConfigurator } from './FamilyPlanConfigurator';
import { MembershipType, MembershipPlanConfig } from '../types';
import { familyPlanCatalog } from '../data/familyMembership';

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

test('family checkout offers only custom pricing and linked member selectors', () => {
  const html = renderToStaticMarkup(<FamilyPlanConfigurator mode="CUSTOM_COMBINED" onModeChange={() => {}} count={2} onCountChange={() => {}} payerName="Parent" payerId="p" plans={[{ memberId: 'p', memberName: 'Parent', membershipType: MembershipType.OPEN_GYM }, { memberId: 'c', memberName: 'Child', membershipType: MembershipType.OPEN_GYM }]} onPlansChange={() => {}} familyMembers={[{ id: 'p', name: 'Parent' }, { id: 'c', name: 'Child' }]} />);
  assert.match(html, /משפחתי מותאם/);
  assert.doesNotMatch(html, /משפחתי חודשי|משפחתי שנתי/);
  assert.match(html, /value="c"/);
  assert.doesNotMatch(html, /<input/);
  assert.match(html, /560/);
});
