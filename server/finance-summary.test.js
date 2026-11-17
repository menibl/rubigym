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
  assert.equal(result.monthly.rivhitPendingAmount, 999); assert.equal(result.monthly.otherPendingAmount, 10);
  assert.deepEqual(result.monthly.oneTimePaid, { amount: 500, count: 1 });
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
  assert.equal(result.pendingRecurring.current.amount, 2000);
});

test('pending journal amounts stay separate, use integer cents and do not include tests or duplicates', () => {
  const result = financeSummary([paid('p', 0.1, { status: 'PENDING', providerSaleId: 'pending-sale' }),
    paid('copy', 0.1, { status: 'PENDING', providerSaleId: 'pending-sale' }), paid('p2', 0.2, { status: 'PENDING' }),
    paid('manual', 50, { status: 'PENDING', provider: 'MANUAL' }), paid('bad', '500', { status: 'PENDING' }),
    paid('mock', 900, { status: 'PENDING', isMock: true }), paid('old', 100, { status: 'PENDING', date: '2026-10-01' })], [], now);
  assert.equal(result.monthly.rivhitPendingAmount, 0.3);
  assert.equal(result.monthly.otherPendingAmount, 50);
  assert.equal(result.monthly.invalidPendingAmountCount, 1);
  assert.equal(result.monthly.pendingCount, 4);
  assert.equal(result.monthly.totalAmount, 0);
  assert.equal(result.lifetime.rivhitPendingAmount, 100.3);
});

const pendingContract = patch => ({ seriesId: 'series', orderId: 'order', status: 'PENDING_FIRST_CHARGE',
  approvedAt: '2026-11-01T10:00:00Z', endsAt: '2027-11-01', amount: 280, ...patch });
const member = (id, contract) => ({ id, name: `Member ${id}`, recurringMemberships: { OPEN_GYM: contract } });

test('monthly outstanding family amount is the single signed group amount even with incomplete beneficiaries', () => {
  const group = pendingContract({ groupAmount: 1152, groupSize: 3, amount: 450 });
  const users = [member('a', group), member('b', { ...group, seriesId: 'SERIES', amount: 252 })];
  const before = structuredClone(users);
  const result = financeSummary([], users, now);
  assert.equal(result.pendingRecurring.monthly.count, 1);
  assert.equal(result.pendingRecurring.monthly.amount, 1152);
  assert.equal(result.pendingRecurring.current.amount, 1152);
  assert.deepEqual(result.pendingRecurring.monthly.rows[0].names, ['Member a', 'Member b']);
  assert.deepEqual(users, before);
  assert.equal(result.monthly.totalAmount, 0);
});

test('current pending instructions are not all assigned to this month or multiplied by overdue months', () => {
  const users = [member('a', pendingContract({ seriesId: 'new' })),
    member('b', pendingContract({ seriesId: 'oct', approvedAt: '2026-10-01T10:00:00Z' })),
    member('c', pendingContract({ seriesId: 'due', status: 'ACTIVE', paidUntil: '2026-11-01' })),
    member('d', pendingContract({ seriesId: 'missing', approvedAt: undefined })),
    member('e', pendingContract({ seriesId: 'future', approvedAt: '2026-12-01T10:00:00Z' }))];
  const result = financeSummary([], users, now);
  assert.equal(result.pendingRecurring.monthly.amount, 560);
  assert.equal(result.pendingRecurring.monthly.count, 2);
  assert.equal(result.pendingRecurring.otherPeriodCount, 3);
  assert.equal(result.pendingRecurring.current.amount, 1400);
  assert.equal(result.pendingRecurring.monthly.rows.find(row => row.key === 'series:due').kind, 'DUE_CHARGE');
});

test('conflicting family amounts or missing group totals are explicit unknowns, never guessed', () => {
  for (const contracts of [
    [pendingContract({ groupAmount: 1000, groupSize: 2 }), pendingContract({ groupAmount: 900, groupSize: 2 })],
    [pendingContract({ groupSize: 2 })], [pendingContract({ amount: NaN })],
    [pendingContract(), pendingContract()]
  ]) {
    const result = financeSummary([], contracts.map((contract, i) => member(String(i), contract)), now);
    assert.equal(result.pendingRecurring.monthly.count, 1);
    assert.equal(result.pendingRecurring.monthly.amount, 0);
    assert.equal(result.pendingRecurring.monthly.unknownAmountCount, 1);
    assert.equal(result.pendingRecurring.monthly.rows[0].amount, null);
  }
});

test('verified current-month receipt prevents counting a stale instruction as still awaiting money', () => {
  const users = [member('a', pendingContract())];
  const result = financeSummary([paid('receipt', 280, { providerRecurringSaleId: 'SERIES', recurringChargeNumber: 1 })], users, now);
  assert.equal(result.pendingRecurringCount, 0);
  assert.deepEqual(result.monthly.recurringPaid, { amount: 280, count: 1 });
  assert.equal(result.monthly.oneTimePaid.count, 0);
  assert.equal(result.monthly.totalAmount, 280);
  assert.equal(financeSummary([paid('test', 280, { providerRecurringSaleId: 'series', isMock: true })], users, now).pendingRecurringCount, 1);
});

test('failed, cancelled and sandbox instructions do not become outstanding money', () => {
  const users = [member('a', pendingContract()), member('b', pendingContract({ status: 'PAYMENT_FAILED' })),
    member('c', pendingContract({ seriesId: 'cancelled', cancelledAt: now.toISOString() })),
    member('d', pendingContract({ seriesId: 'mock', isMock: true }))];
  const result = financeSummary([], users, now);
  assert.equal(result.pendingRecurringCount, 0);
  assert.equal(result.pendingRecurring.current.amount, 0);
  assert.equal(result.failedRecurringCount, 1);
});
