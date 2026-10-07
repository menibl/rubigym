import test from 'node:test';
import assert from 'node:assert/strict';
import { sameProviderPayment, uniquePayments } from '../shared/payment-ledger.js';
const base = { provider: 'RIVHIT', traineeId: 'u', amount: 280, date: '2026-10-06', status: 'PAID', paymentMethod: 'RIVHIT iCredit' };
test('sale-id and transaction-id variants of one verified sale show once, retaining card metadata', () => {
  const a = { ...base, id: 'payment-rivhit-sale', providerSaleId: 'sale', providerTransactionId: 'sale' };
  const b = { ...base, id: 'payment-rivhit-txn', providerSaleId: 'sale', providerTransactionId: 'txn', paymentMethod: 'RIVHIT iCredit •••• 3624' };
  assert.equal(sameProviderPayment(a, b), true);
  assert.equal(uniquePayments([a, b]).length, 1);
  assert.match(uniquePayments([a, b])[0].paymentMethod, /3624/);
});
test('distinct genuine purchases, missing provider IDs, and test/live sales stay separate', () => {
  const a = { ...base, id: 'payment-rivhit-a', providerSaleId: 'a' };
  const b = { ...base, id: 'payment-rivhit-b', providerSaleId: 'b' };
  assert.equal(uniquePayments([a, b]).length, 2);
  assert.equal(uniquePayments([a, { ...a, id: 'test', isMock: true }]).length, 2);
  assert.equal(uniquePayments([{ ...base, id: 'one' }, { ...base, id: 'two' }]).length, 2);
});
test('transitive aliases and refund status remain one transaction without altering the raw ledger', () => {
  const payments = [{ ...base, id: 's', providerSaleId: 'sale' }, { ...base, id: 't', providerTransactionId: 'txn' }, { ...base, id: 'bridge', providerSaleId: 'sale', providerTransactionId: 'txn', status: 'REFUNDED' }];
  assert.equal(uniquePayments(payments).length, 1); assert.equal(uniquePayments(payments)[0].status, 'REFUNDED');
  assert.equal(payments.length, 3);
});
