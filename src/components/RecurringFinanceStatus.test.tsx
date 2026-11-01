import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecurringFinanceStatus } from './RecurringFinanceStatus';
import { type User } from '../types';

test('finance shows pending/approved/declined contracts independently from paid receipts', () => {
  const users = ['PENDING_FIRST_CHARGE', 'ACTIVE', 'PAYMENT_FAILED'].map((status, index) => ({ id: `${index}`, name: `Member ${index}`,
    recurringMemberships: { OPEN_GYM: { status, amount: 280, endsAt: '2099-01-01', paidUntil: status === 'ACTIVE' ? '2099-01-01' : undefined } } })) as User[];
  const html = renderToStaticMarkup(<RecurringFinanceStatus users={users} />);
  for (const text of ['ממתין לאישור רווחית — המנוי פעיל', 'אושר ברווחית', 'תשלום נדחה — המסלול הושהה', 'אינה קבלה על תשלום']) assert.ok(html.includes(text));
  assert.ok(!html.includes('שולם'));
  users[0].recurringMemberships!.OPEN_GYM!.cancelledAt = '2026-11-01';
  assert.ok(!renderToStaticMarkup(<RecurringFinanceStatus users={users} />).includes('Member 0'));
});
