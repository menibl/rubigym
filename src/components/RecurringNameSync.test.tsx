import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecurringFinanceStatus } from './RecurringFinanceStatus';
import type { User } from '../types';

test('recurring finance shows provider-verified payer name independently from payment status', () => {
  const user = { id: 'payer', name: 'עדי פנצר', recurringMemberships: { OPEN_GYM: { seriesId: 'series', orderId: 'order', status: 'ACTIVE',
    endsAt: '2099-01-01', amount: 280, customerNameSync: { status: 'SYNCED', name: 'עדי פנצר', checkedAt: '2026-11-22', nextAttemptAt: '2026-11-23' } } } } as User;
  const html = renderToStaticMarkup(<RecurringFinanceStatus users={[user]} />);
  assert.match(html, /שם בחשבוניות הוראת הקבע/);
  assert.match(html, /שם המשלם אומת ברווחית: עדי פנצר/);
  user.recurringMemberships!.OPEN_GYM!.customerNameSync!.status = 'REVIEW_REQUIRED';
  const review = renderToStaticMarkup(<RecurringFinanceStatus users={[user]} />);
  assert.match(review, /נדרשת בדיקת מנהל — השם לא סונכרן/);
  assert.doesNotMatch(review, /שם המשלם אומת ברווחית/);
});
