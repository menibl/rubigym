import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { FinanceSummary } from './FinanceSummary';
import { type Payment, type User } from '../types';

test('finance cards clearly distinguish current month, lifetime, paid/manual/pending and exclude test money', () => {
  const payments = [{ id: 'r', amount: 500, date: '2026-11-01', status: 'PAID', provider: 'RIVHIT' },
    { id: 'm', amount: 200, date: '2026-11-01', status: 'PAID', provider: 'MANUAL' },
    { id: 'old', amount: 100, date: '2026-10-01', status: 'PAID', provider: 'RIVHIT' },
    { id: 'p', amount: 999, date: '2026-11-01', status: 'PENDING', provider: 'RIVHIT' },
    { id: 'test', amount: 9999, date: '2026-11-01', status: 'PAID', provider: 'RIVHIT', isMock: true }] as Payment[];
  const html = renderToStaticMarkup(<FinanceSummary payments={payments} users={[]} now={new Date('2026-11-17T12:00:00Z')} />);
  for (const text of ['החודש הנוכחי — 11/2026', 'מצטבר — כל התקופה המתועדת', '₪700.00', '₪800.00', 'שולם ואושר ברווחית',
    'שולם ותועד ידנית — לא אישור רווחית', 'עסקאות רווחית מתועדות שממתינות לאישור', 'השרת סורק בכל דקה', 'בדיקה יומית', 'ללא מחיקת היסטוריה']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('₪9,999')); assert.ok(html.includes('₪999.00'));
  assert.ok(html.includes('לפי הרשומות שסונכרנו לאפליקציה'));
});

test('outstanding family instruction has a separate monthly amount and beneficiary detail, never paid money', () => {
  const contract = { seriesId: 'shared', status: 'PENDING_FIRST_CHARGE', endsAt: '2027-11-01', approvedAt: '2026-11-01T10:00:00Z', amount: 280, groupAmount: 560, groupSize: 2 };
  const users = [{ id: 'a', name: 'First member', recurringMemberships: { OPEN_GYM: contract } },
    { id: 'b', name: 'Second member', recurringMemberships: { OPEN_GYM: contract } }] as User[];
  const html = renderToStaticMarkup(<FinanceSummary payments={[]} users={users} now={new Date('2026-11-17T12:00:00Z')} />);
  for (const text of ['₪560.00', 'משויכות לחודש 11/2026', '1 הוראות', 'First member, Second member', 'טרם תועד אישור חיוב ראשון',
    'אינו נכלל בסכום ששולם', 'חיוב שקיים ברווחית אך טרם סונכרן']) assert.ok(html.includes(text), text);
  assert.ok(html.includes('0 עסקאות ששולמו'));
});

test('summary counts instructions, not beneficiaries, and shows failure separately from provider silence', () => {
  const users = [{ id: 'a', recurringMemberships: { OPEN_GYM: { seriesId: 'shared', status: 'PENDING_FIRST_CHARGE', endsAt: '2099-01-01' } } },
    { id: 'b', recurringMemberships: { OPEN_GYM: { seriesId: 'shared', status: 'PENDING_FIRST_CHARGE', endsAt: '2099-01-01' } } }] as User[];
  const html = renderToStaticMarkup(<FinanceSummary payments={[]} users={users} />);
  assert.ok(html.includes('1 הוראות ממתינות לאישור חיוב'));
  assert.ok(html.includes('אינם דחיית תשלום'));
  assert.ok(html.includes('אין לחבר את המספר'));
});

test('open summary refreshes on minute and visible return; dashboard no longer shows the ambiguous all-time total', () => {
  const source = readFileSync(new URL('./FinanceSummary.tsx', import.meta.url), 'utf8');
  const dashboard = readFileSync(new URL('./AdminDashboard.tsx', import.meta.url), 'utf8');
  assert.match(source, /setInterval\(update, 60_000\)/);
  assert.match(source, /visibilitychange/); assert.match(source, /clearInterval/);
  assert.match(dashboard, /<FinanceSummary payments=\{payments\} users=\{users\}/);
  assert.ok(!dashboard.includes('סה"כ עסקאות ששולמו'));
});
