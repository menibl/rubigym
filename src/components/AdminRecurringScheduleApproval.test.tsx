import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminRecurringScheduleApproval } from './AdminRecurringScheduleApproval';
import { PaymentPurchaseDetails } from './PaymentPurchaseDetails';
import { type Payment } from '../types';

test('manager schedule form requires explicit counter, service month, reason, verified preview and final acknowledgement', () => {
  const html = renderToStaticMarkup(<AdminRecurringScheduleApproval userId="u" seriesId="existing-series" />);
  for (const label of ['מספר החיוב לשיוך', 'חודש השירות עבור החיוב הזה', 'סיבת שינוי', '12 החיובים', 'ללא שינוי או חיוב', 'הוראה משפחתית']) assert.ok(html.includes(label));
  assert.ok(!html.includes('תצוגה מקדימה לאישור מועדי חיוב'));
  const source = readFileSync(new URL('./AdminRecurringScheduleApproval.tsx', import.meta.url), 'utf8');
  assert.match(source, /disabled=\{busy \|\| !ack\}/);
  assert.match(source, /previousPolicyId: preview\?\.previousPolicyId/);
  assert.match(source, /confirmationKey: preview\?\.confirmationKey/);
  assert.match(readFileSync(new URL('./AdminRecurringSync.tsx', import.meta.url), 'utf8'), /key=\{saleId\}/);
  assert.match(source, /22\/11/);
  assert.doesNotMatch(source, /\/Charge|\/GetUrl|\/RecurringSaleUpdate/);
});

test('receipt detail displays explicit approved service month separately from financial date and amount', () => {
  const html = renderToStaticMarkup(<PaymentPurchaseDetails payment={{ id: 'real', traineeName: 'Fixture', amount: 280, date: '2026-11-22', status: 'PAID',
    membershipTypePurchased: 'OPEN_GYM', recurringServiceMonth: '2026-12', recurringServiceExpiresAt: '2027-01-01' } as Payment} />);
  for (const text of ['2026-12', '2027-01-01', 'חודש השירות שאושר', 'מועד החיוב הכספי לא שונה']) assert.ok(html.includes(text));
});
