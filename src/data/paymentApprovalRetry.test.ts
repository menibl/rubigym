import test from 'node:test';
import assert from 'node:assert/strict';
import { retryPaymentApproval, isApprovalRetryable, APPROVAL_RETRY_DELAYS } from './paymentApprovalRetry';

test('provider becomes ready after two minutes; retries read-only operation then stops immediately', async () => {
  let calls = 0, elapsed = 0, notices = 0;
  const result = await retryPaymentApproval(async () => {
    calls++;
    if (elapsed < 120_000) throw Object.assign(new Error('pending'), { code: 'RIVHIT_RECURRING_PENDING' });
    return { verified: true, beneficiary: 'child' };
  }, { wait: async delay => { elapsed += delay; }, onRetry: () => { notices++; } });
  assert.equal(result.beneficiary, 'child'); assert.equal(calls, 9); assert.equal(notices, 8);
});

test('transient errors exhaust a finite retry window, never claim failure is a declined card', async () => {
  let calls = 0;
  await assert.rejects(retryPaymentApproval(async () => { calls++; throw Object.assign(new Error('upstream'), { status: 502 }); },
    { wait: async () => {} }), { code: 'APPROVAL_CHECK_DEFERRED' });
  assert.equal(calls, 13); assert.equal(APPROVAL_RETRY_DELAYS.reduce((sum, value) => sum + value, 0), 180_000);
});

test('authentication, ownership mismatch and verified failures are terminal', async () => {
  for (const error of [Object.assign(new Error('login'), { status: 401 }), Object.assign(new Error('forbidden'), { status: 403 }),
    Object.assign(new Error('declined'), { status: 409, code: 'RECURRING_PAYMENT_FAILED' }),
    Object.assign(new Error('mismatch'), { status: 502, code: 'AMOUNT_MISMATCH' }), new Error('ownership mismatch')]) {
    let calls = 0;
    await assert.rejects(retryPaymentApproval(async () => { calls++; throw error; }, { wait: async () => {} }));
    assert.equal(calls, 1);
  }
  assert.equal(isApprovalRetryable(new TypeError('network')), true);
  assert.equal(isApprovalRetryable(Object.assign(new Error('throttled'), { status: 429 })), true);
});

test('unmount aborts retry delay and suppresses a late successful verification result', async () => {
  const controller = new AbortController(); let calls = 0;
  await assert.rejects(retryPaymentApproval(async () => { calls++; throw new TypeError('network'); }, {
    signal: controller.signal, wait: async () => { controller.abort(); }
  }), { name: 'AbortError' });
  assert.equal(calls, 1);
  const next = new AbortController();
  await assert.rejects(retryPaymentApproval(async () => { next.abort(); return 'late'; }, { signal: next.signal }), { name: 'AbortError' });
});
