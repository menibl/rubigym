import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentReport, samePayment } from '../shared/payment-ledger.js';

const row = (sale, tx, extra = {}) => ({ id: `payment-rivhit-${tx}`, traineeId: 'user', amount: 280, status: 'PAID', provider: 'RIVHIT', providerSaleId: sale, providerTransactionId: tx, paymentMethod: 'RIVHIT iCredit', ...extra });

test('IPN fallback and verified transaction are one report row without mutating audit', () => {
  const rows = [row('sale1', 'sale1'), row('sale1', 'tx1', { paymentMethod: 'RIVHIT iCredit •••• 1234' })];
  const original = structuredClone(rows);
  const report = paymentReport(rows);
  assert.equal(report.length, 1);
  assert.equal(report[0].providerTransactionId, 'tx1');
  assert.match(report[0].paymentMethod, /1234$/);
  assert.deepEqual(rows, original);
  assert.equal(paymentReport([...rows].reverse()).length, 1);
});

test('separate Karmi purchases remain four payments, not two', () => {
  const rows = [row('s1', 't1'), row('s2', 't2', { amount: 300 }), row('s3', 't3'), row('s4', 't4', { amount: 300 }), row('s3', 's3'), row('s4', 's4', { amount: 300 })];
  const report = paymentReport(rows);
  assert.equal(report.length, 4);
  assert.equal(report.reduce((total, item) => total + item.amount, 0), 1160);
});

test('legacy browser IDs correlate only through explicit provider evidence', () => {
  const legacy = { id: 'payment-rivhit-t1', traineeId: 'user', amount: 280, status: 'PAID' };
  assert.equal(paymentReport([legacy, row('s1', 't1')]).length, 1);
  assert.equal(paymentReport([legacy, row('s2', 't2')]).length, 2);
});

test('distinct real transactions, users, environments and conflicting amounts stay separate', () => {
  assert.equal(samePayment(row('s1', 't1'), row('s1', 't2')), false);
  assert.equal(paymentReport([row('s1', 't1'), row('s1', 's1'), row('s1', 't2')]).length, 2);
  assert.equal(samePayment(row('s1', 't1'), row('s1', 't1', { traineeId: 'other' })), false);
  assert.equal(samePayment(row('s1', 't1'), row('s1', 't1', { isMock: true })), false);
  assert.equal(paymentReport([row('s1', 't1'), row('s1', 't1', { amount: 500 })]).length, 2);
  assert.equal(paymentReport([{ id: 'manual1', amount: 280 }, { id: 'manual2', amount: 280 }]).length, 2);
});

test('refund status wins independent of duplicate order', () => {
  const rows = [row('s1', 's1', { status: 'REFUNDED' }), row('s1', 't1')];
  assert.equal(paymentReport(rows)[0].status, 'REFUNDED');
  assert.equal(paymentReport(rows.reverse())[0].status, 'REFUNDED');
});
