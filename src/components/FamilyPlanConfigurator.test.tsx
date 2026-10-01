import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { FamilyPlanConfigurator } from './FamilyPlanConfigurator';
import { MembershipType } from '../types';

test('family checkout offers only custom pricing and linked member selectors', () => {
  const html = renderToStaticMarkup(<FamilyPlanConfigurator mode="CUSTOM_COMBINED" onModeChange={() => {}} count={2} onCountChange={() => {}} payerName="Parent" payerId="p" plans={[{ memberId: 'p', memberName: 'Parent', membershipType: MembershipType.OPEN_GYM }, { memberId: 'c', memberName: 'Child', membershipType: MembershipType.OPEN_GYM }]} onPlansChange={() => {}} familyMembers={[{ id: 'p', name: 'Parent' }, { id: 'c', name: 'Child' }]} />);
  assert.match(html, /משפחתי מותאם/);
  assert.doesNotMatch(html, /משפחתי חודשי|משפחתי שנתי/);
  assert.match(html, /value="c"/);
  assert.doesNotMatch(html, /<input/);
  assert.match(html, /560/);
});
