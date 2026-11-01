import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecurringMembershipNotice } from './RecurringMembershipNotice';
import { AdminRecurringSync } from './AdminRecurringSync';
import { MembershipType, type User } from '../types';

const user = { id: 'u', recurringMemberships: { [MembershipType.OPEN_GYM]: {
  seriesId: 'series', orderId: 'order', status: 'PENDING_FIRST_CHARGE', endsAt: '2099-01-01', amount: 450, discountCode: 'TEN'
} } } as User;
test('pending setup is explicitly not paid and shows fixed discounted series amount', () => {
  const html = renderToStaticMarkup(<RecurringMembershipNotice user={user} />);
  assert.match(html, /ממתין לאישור רווחית לחיוב הראשון/); assert.match(html, /טרם נרשם תשלום שהושלם/);
  assert.match(html, /450/); assert.match(html, /TEN/); assert.match(html, /ההנחה כלולה בסכום לכל תקופת הסדרה/);
  assert.match(html, /ללא חידוש אוטומטי/);
});
test('failure is a suspension, not a paid or active label', () => {
  const failed = structuredClone(user); failed.recurringMemberships!.OPEN_GYM!.status = 'PAYMENT_FAILED';
  const html = renderToStaticMarkup(<RecurringMembershipNotice user={failed} />);
  assert.match(html, /המסלול הושהה/); assert.doesNotMatch(html, /המנוי פעיל/);
});

test('shared instruction distinguishes the individual allocation from the total and warns about freezes', () => {
  const shared = structuredClone(user);
  Object.assign(shared.recurringMemberships!.OPEN_GYM!, { amount: 252, groupAmount: 702, groupSize: 2 });
  const html = renderToStaticMarkup(<RecurringMembershipNotice user={shared} />);
  assert.match(html, /החלק המשויך למסלול זה/); assert.match(html, /702/);
  assert.match(html, /הקפאה באפליקציה אינה מפחיתה את החיוב/);
  assert.match(html, /ביטול ההוראה מבטל אותה לכל המשתתפים/);
});
test('old contract and sync control explain expiration and no new charge respectively', () => {
  const expired = structuredClone(user); expired.recurringMemberships!.OPEN_GYM!.endsAt = '2020-01-01';
  assert.match(renderToStaticMarkup(<RecurringMembershipNotice user={expired} />), /הסתיימה/);
  const html = renderToStaticMarkup(<AdminRecurringSync userId="u" />);
  assert.match(html, /SaleId/); assert.match(html, /ללא חיוב או הקמת הוראה חדשה/);
  assert.match(html, /מזהה הוראת קבע מהלוג — מומלץ/);
  assert.match(html, /בדיקת ההוראה — ללא שינוי או חיוב/);
  assert.doesNotMatch(html, /אישור שיוך ועדכון המנוי/); // No confirmation before a server preview.
});
