import test from 'node:test';
import assert from 'node:assert/strict';
import { financeSyncTasks } from './finance-reconciliation.js';

test('full finance manifest includes all dates and deduplicates family series and receipts, excludes tests/manual/refunds', () => {
  const payload = { users: [{ id: 'u', name: 'User', recurringMemberships: { OPEN_GYM: { seriesId: 'shared' } } },
    { id: 'v', name: 'Child', recurringMemberships: { OPEN_GYM: { seriesId: 'shared' }, WORKOUT_PLAN: { seriesId: 'unlinked' } } }],
  recurringCheckouts: [{ userId: 'u', orderId: 'old', recurringSaleId: 'shared', dispatchedAt: '2026-01-01' },
    { userId: 'v', orderId: 'duplicate', recurringSaleId: 'shared' }, { orderId: 'abandoned' }, { orderId: 'cancelled', cancelledAt: '2026-01-01' }],
  payments: [{ id: 'payment-rivhit-one', providerSaleId: 'sale', traineeName: 'Paid', status: 'PAID' },
    { id: 'payment-rivhit-duplicate', providerSaleId: 'sale', status: 'PAID' },
    { id: 'pending', provider: 'RIVHIT', status: 'PENDING' }, { id: 'manual', provider: 'MANUAL', status: 'PAID' },
    { id: 'payment-rivhit-test', isMock: true }, { id: 'payment-rivhit-refund', status: 'REFUNDED' },
    { id: 'payment-rivhit-series', providerRecurringSaleId: 'shared' }] };
  const before = structuredClone(payload), tasks = financeSyncTasks(payload);
  assert.equal(tasks.length, 5);
  assert.equal(tasks.filter(task => task.kind === 'PAYMENT').length, 2);
  assert.equal(tasks.filter(task => task.kind === 'RECURRING').length, 2);
  assert.equal(tasks.filter(task => task.kind === 'UNLINKED').length, 1);
  assert.ok(tasks.some(task => task.id === 'order:old'));
  assert.deepEqual(payload, before);
});
