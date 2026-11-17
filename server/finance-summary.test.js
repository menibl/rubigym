import test from 'node:test';
import assert from 'node:assert/strict';
import { financeSummary, financePaymentDate, financePaymentSource } from '../shared/finance-summary.js';

const now = new Date('2026-11-17T12:00:00Z');
const paid = (id, amount, patch = {}) => ({ id, amount, provider: 'RIVHIT', status: 'PAID', date: '2026-11-10', isMock: false, ...patch });

test('monthly and lifetime totals split approved Rivhit, recorded manual and unknown sources without guessing', () => {
  const result = financeSummary([paid('r', 500), paid('cash', 200, { provider: 'MANUAL' }),
    paid('legacy', 30, { provider: undefined }), paid('past', 100, { date: '2026-10-31' }),
    paid('pending', 999, { status: 'PENDING' }), paid('refund', 600, { status: 'REFUNDED' }),
    paid('manual-pending', 10, { status: 'PENDING', provider: 'MANUAL' })], [], now);
  assert.equal(result.monthly.totalAmount, 730);
  assert.equal(result.lifetime.totalAmount, 830);
  assert.deepEqual(result.monthly.rivhit, { amount: 500, count: 1 });
  assert.deepEqual(result.monthly.manual, { amount: 200, count: 1 });
  assert.deepEqual(result.monthly.unclassified, { amount: 30, count: 1 });
  assert.equal(result.monthly.paidCount, 3); assert.equal(result.monthly.pendingCount, 2);
  assert.equal(result.monthly.rivhitPendingCount, 1); assert.equal(result.monthly.otherPendingCount, 1);
  assert.equal(result.monthly.refundedCount, 1); assert.equal(result.monthly.transactionCount, 6);
});

test('duplicate provider receipts, refunds and test payments never inflate paid amounts or counts', () => {
  const list = [paid('a', 280, { providerSaleId: 'sale' }), paid('b', 280, { providerSaleId: 'sale' }),
    paid('cash', 100, { provider: 'MANUAL' }), paid('test', 5000, { isMock: true }),
    paid('demo', 8000, { paymentMethod: 'עסקת בדיקה' }), paid('back', 50, { providerTransactionId: 'refund-tx' }),
    paid('refunded-copy', 50, { providerTransactionId: 'refund-tx', status: 'REFUNDED' })];
  const before = structuredClone(list);
  const result = financeSummary(list, [], now);
  assert.equal(result.monthly.totalAmount, 380); assert.equal(result.monthly.paidCount, 2);
  assert.equal(result.monthly.refundedCount, 1); assert.equal(result.monthly.transactionCount, 3);
  assert.equal(result.excludedTestCount, 2); assert.deepEqual(list, before);
  // A real production charge must not be guessed to be a test by its amount.
  assert.equal(financeSummary([paid('small-real', 5)], [], now).monthly.totalAmount, 5);
});

test('month boundary is Israel midnight, resets display without deleting lifetime history and clamps to today', () => {
  const list = [paid('oct', 10, { timestamp: '2026-10-31T21:59:00Z' }), paid('nov', 20, { timestamp: '2026-10-31T22:01:00Z' }),
    paid('next-month', 30, { date: '2026-12-01' })];
  const october = financeSummary(list, [], new Date('2026-10-31T21:59:30Z'));
  const november = financeSummary(list, [], new Date('2026-10-31T22:02:00Z'));
  assert.equal(october.month, '2026-10'); assert.equal(october.monthly.totalAmount, 10);
  assert.equal(november.month, '2026-11'); assert.equal(november.monthly.totalAmount, 20);
  assert.equal(november.lifetime.totalAmount, 60);
  assert.equal(financePaymentDate(paid('summer', 5, { timestamp: '2026-07-31T21:30:00Z' })), '2026-08-01');
  assert.equal(financeSummary([paid('future-day', 9, { date: '2026-11-30' })], [], now).monthly.totalAmount, 0);
});

test('legacy sources, invalid dates and invalid amounts remain explicit rather than falsely provider-approved', () => {
  assert.equal(financePaymentSource(paid('payment-rivhit-old', 5, { provider: undefined })), 'rivhit');
  assert.equal(financePaymentSource(paid('old-cash', 5, { provider: undefined, paymentMethod: 'מזומן/העברה' })), 'manual');
  assert.equal(financePaymentSource(paid('payment-rivhit-name', 5, { provider: 'MANUAL' })), 'manual');
  assert.equal(financePaymentSource(paid('unknown', 5, { provider: 'OTHER', paymentMethod: 'credit' })), 'unclassified');
  const result = financeSummary([paid('bad-date', 12, { date: '2026-02-31' }), paid('unknown-date', 13, { date: undefined }),
    paid('bad-amount', NaN), paid('negative', -20), paid('string', '100'), paid('decimal', 0.1), paid('decimal-2', 0.2)], [], now);
  assert.equal(result.unassignedDateCount, 2); assert.equal(result.monthly.invalidAmountCount, 3);
  assert.equal(result.monthly.totalAmount, 0.3); assert.equal(result.lifetime.totalAmount, 25.3);
});

test('family pending instructions count once, never as payments or all future charges', () => {
  const contract = { seriesId: 'shared', orderId: 'order', status: 'PENDING_FIRST_CHARGE', endsAt: '2027-11-01', amount: 500, groupAmount: 1000 };
  const users = [{ id: 'a', recurringMemberships: { OPEN_GYM: contract } }, { id: 'b', recurringMemberships: { GROUP_ANNUAL: { ...contract, seriesId: 'SHARED' } } },
    { id: 'c', recurringMemberships: { OPEN_GYM: { ...contract, seriesId: 'cancelled', cancelledAt: '2026-11-01' } } },
    { id: 'd', recurringMemberships: { OPEN_GYM: { ...contract, seriesId: 'expired', endsAt: '2026-11-01' } } },
    { id: 'e', recurringMemberships: { OPEN_GYM: { ...contract, seriesId: 'failed', status: 'PAYMENT_FAILED' } } },
    { id: 'f', recurringMemberships: { OPEN_GYM: { ...contract, seriesId: 'approved', status: 'ACTIVE', paidUntil: '2026-12-01' } } },
    { id: 'g', recurringMemberships: { OPEN_GYM: { ...contract, seriesId: 'due', status: 'ACTIVE', paidUntil: '2026-11-01' } } }];
  const result = financeSummary([], users, now);
  assert.equal(result.pendingRecurringCount, 2); assert.equal(result.failedRecurringCount, 1);
  assert.equal(result.monthly.totalAmount, 0); assert.equal(result.monthly.transactionCount, 0);
});
