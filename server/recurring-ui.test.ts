import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecurringPlanNotice } from '../src/components/RecurringPlanNotice';
import { RecurringPlanSettings } from '../src/components/RecurringPlanSettings';
import { billingPeriodLabel } from '../src/data/membershipBilling';
import { MembershipPlanConfig } from '../src/types';

const plan: MembershipPlanConfig = { id: 'GROUP_MONTHLY', label: 'קבוצתי', description: '', price: 500, category: 'PRIMARY', active: true, paymentMode: 'RECURRING', recurringTermMonths: 12, renewalMode: 'AUTO' };
test('recurring notice displays monthly charge, period and unavailable service, no prechecked consent', () => {
  const html = renderToStaticMarkup(createElement(RecurringPlanNotice, { plan }));
  assert.match(html, /חיוב חודשי מתחדש בהוראת קבע/);
  assert.match(html, /השירות בהכנה/);
  assert.match(html, /חידוש אוטומטי/);
  assert.match(html, /type="checkbox"/);
  assert.doesNotMatch(html, /checked=""/);
  assert.match(html, /אינו מפעיל הוראת קבע/);
  assert.equal(renderToStaticMarkup(createElement(RecurringPlanNotice, { plan: { ...plan, paymentMode: undefined } })), '');
});
test('plan settings separate payment method from period and preserve legacy one-off labels', () => {
  const html = renderToStaticMarkup(createElement(RecurringPlanSettings, { plan, onChange: () => {} }));
  assert.match(html, /תקופת המסלול בחודשים/);
  assert.match(html, /חידוש רק לאחר אישור המתאמן/);
  assert.match(html, /התשלום במסלול זה חסום/);
  assert.match(billingPeriodLabel(plan), /הוראת קבע/);
  assert.match(billingPeriodLabel({ ...plan, paymentMode: undefined, billingPeriod: 'MONTHLY_ANNUAL_COMMITMENT' }), /חד־פעמי/);
});
