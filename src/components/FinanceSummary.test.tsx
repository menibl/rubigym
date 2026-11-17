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

test('paid, lifetime and outstanding cards start collapsed and reveal all details using native disclosure', () => {
  const html = renderToStaticMarkup(<FinanceSummary payments={[{ id: 'paid', provider: 'RIVHIT', status: 'PAID', amount: 500, date: '2026-11-01' }] as Payment[]} users={[]} now={new Date('2026-11-17T12:00:00Z')} />);
  for (const label of ['החודש הנוכחי — 11/2026', 'מצטבר — כל התקופה המתועדת', 'הוראות קבע בהמתנה']) {
    assert.ok(html.includes(`<details aria-label="${label}"`), label);
  }
  assert.ok(!/<details[^>]*\sopen(?:=|\s|>)/.test(html), 'no summary or nested disclosure starts expanded');
  assert.equal((html.match(/לחיצה לפירוט/g) || []).length, 3);
  assert.ok(html.includes('שולם ואושר ברווחית'));
  assert.ok(html.includes('פירוט ההוראות שאינן כלולות בסכום ששולם'));
  assert.ok(html.includes('focus-visible:outline'));
});

test('collapsed cards keep missing-amount and verified-failure warnings visible in their summaries', () => {
  const html = renderToStaticMarkup(<FinanceSummary payments={[{ id: 'bad', provider: 'RIVHIT', status: 'PAID', amount: NaN, date: '2026-11-01' }] as Payment[]} users={[
    { id: 'failed', recurringMemberships: { OPEN_GYM: { seriesId: 'failed', status: 'PAYMENT_FAILED', endsAt: '2027-11-01' } } }
  ] as User[]} now={new Date('2026-11-17T12:00:00Z')} />);
  assert.match(html, /<summary[^>]*>(?:(?!<\/summary>).)*קיימות רשומות עם סכום חסר/s);
  assert.match(html, /<summary[^>]*>(?:(?!<\/summary>).)*1 הוראות עם כשל חיוב מאומת/s);
});
