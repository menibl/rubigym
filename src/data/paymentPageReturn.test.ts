import test from 'node:test';
import assert from 'node:assert/strict';
import { onPaymentPageReturn } from './paymentPageReturn';

test('Back from BFCache resets busy UI, ordinary pageshow does not cancel an active operation', () => {
  const surface = new EventTarget(); let resets = 0;
  const stop = onPaymentPageReturn(() => { resets++; }, surface as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>);
  surface.dispatchEvent(new Event('pageshow')); assert.equal(resets, 0);
  surface.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true })); assert.equal(resets, 1);
  stop(); surface.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true })); assert.equal(resets, 1);
});
