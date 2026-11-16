import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutPreflightTarget, publicCheckoutPreflight } from './checkout-preflight.js';

test('family preflight requires exact payer, batch, item, beneficiary and plan bindings', () => {
  const reservation = { orderId: 'order', userId: 'child', membershipType: 'OPEN_GYM',
    orderSnapshot: { u: 'payer', bs: 'batch', bi: 'line' } };
  const batch = { id: 'batch', payerId: 'payer', items: [{ id: 'line', memberId: 'child', membershipType: 'OPEN_GYM', recurring: true, status: 'PAGE' }] };
  const payload = { users: [], recurringCheckouts: [reservation] };
  assert.equal(checkoutPreflightTarget(payload, 'payer', 'batch', batch).reservation, reservation);
  assert.equal(checkoutPreflightTarget(payload, 'child', 'batch', batch), null);
  for (const patch of [{ userId: 'other' }, { membershipType: 'OTHER' }, { cancelledAt: 'now' },
    { orderSnapshot: { ...reservation.orderSnapshot, bs: 'other' } }, { orderSnapshot: { ...reservation.orderSnapshot, bi: 'other' } },
    { orderSnapshot: { ...reservation.orderSnapshot, u: 'other' } }]) {
    assert.deepEqual(checkoutPreflightTarget({ ...payload, recurringCheckouts: [{ ...reservation, ...patch }] }, 'payer', 'batch', batch), { phase: 'REVIEW_REQUIRED' });
  }
  assert.equal(checkoutPreflightTarget(payload, 'payer', 'batch', { ...batch, cancelled: true }), null);
});

test('preflight response exposes status only, never a provider URL, signed reference or card fields', () => {
  const outcome = { resumed: true, url: 'https://private.invalid', paymentReference: 'private-reference', CardNum: 'private-card',
    resumeSummary: { card: 'private-card' }, message: 'safe', code: 'SAFE_CODE', reasonCode: 'SAFE_REASON' };
  const ready = publicCheckoutPreflight(outcome, true);
  assert.equal(ready.phase, 'READY');
  assert.ok(!JSON.stringify(ready).includes('private'));
  assert.deepEqual(publicCheckoutPreflight(outcome, false), { code: 'SAFE_CODE', reasonCode: 'SAFE_REASON', message: 'safe' });
  assert.equal(publicCheckoutPreflight({ completed: true }, true).phase, 'COMPLETED');
  assert.equal(publicCheckoutPreflight({ resumed: true }, true).phase, 'REVIEW_REQUIRED');
});
