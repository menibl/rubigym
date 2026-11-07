import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('individual checkout offers additions before payment and uses the existing resumable split flow', () => {
  const dashboard = readFileSync(new URL('../components/TraineeDashboard.tsx', import.meta.url), 'utf8');
  const payments = readFileSync(new URL('./rivhitPayments.ts', import.meta.url), 'utf8');
  assert.match(dashboard, /תוספות לאותה רכישה/);
  assert.match(dashboard, /individualSelections: checkoutAdditions.length/);
  assert.match(dashboard, /mode: membershipPurchaseMode/);
  assert.match(dashboard, /\.\.\.checkoutAdditions/);
  assert.match(payments, /request.individualSelections\?\.length/);
  assert.match(payments, /unifiedCheckout: true/);
  assert.match(payments, /continueFamilySplitPayment\(quote.batchId, request.userId\)/);
});

test('background state refresh skips hidden/overlapping work and resumes on visibility changes', () => {
  const source = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(source, /if \(cancelled \|\| refreshing \|\| document.visibilityState === 'hidden'\) return;/);
  assert.match(source, /finally \{ refreshing = false; \}/);
  assert.match(source, /document.addEventListener\('visibilitychange', refreshBilling\)/);
  assert.match(source, /document.removeEventListener\('visibilitychange', refreshBilling\)/);
});
