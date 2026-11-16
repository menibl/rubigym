import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkCheckoutReturns } from './checkoutReturnChecks';

test('return checks have bounded concurrency, isolate errors and cap the request list', async () => {
  let active = 0, peak = 0;
  const results: string[] = [];
  const errors: string[] = [];
  await checkCheckoutReturns(Array.from({ length: 30 }, (_, id) => ({ id: String(id) })), new AbortController().signal, async id => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1)); active--;
    if (id === '1') throw new Error('temporary failure');
    return { phase: 'READY' };
  }, (item, value, error) => { if (error) errors.push(item.id); else { assert.deepEqual(value, { phase: 'READY' }); results.push(item.id); } });
  assert.equal(peak, 2); assert.equal(results.length, 19); assert.deepEqual(errors, ['1']);
  assert.ok(!results.includes('20'));
});

test('leaving checkout aborts queued checks and discards late responses', async () => {
  const controller = new AbortController();
  let calls = 0, callbacks = 0;
  await checkCheckoutReturns([{ id: 'a' }, { id: 'b' }, { id: 'c' }], controller.signal, async () => {
    calls++; controller.abort(); return { phase: 'READY' };
  }, () => { callbacks++; });
  assert.equal(calls, 1); assert.equal(callbacks, 0);
});

test('automatic checks run on entry, page return and visible return without redirect, create or release', () => {
  const client = readFileSync(new URL('./rivhitPayments.ts', import.meta.url), 'utf8');
  const component = readFileSync(new URL('../components/PendingCheckoutRecovery.tsx', import.meta.url), 'utf8');
  const check = client.slice(client.indexOf('export const checkSavedCheckout'), client.indexOf('export const restartUndispatchedCheckout'));
  assert.match(check, /retryPaymentApproval\(\(\) => checkoutRecovery\('check'/);
  assert.match(check, /delays: \[2000, 5000\]/);
  assert.match(check, /result.synced \|\| result.phase === 'COMPLETED'/);
  assert.doesNotMatch(check, /location|sessionStorage|startRivhitPayment|familySplitAction|checkoutRecovery\('(resume|restart)'/);
  const automatic = component.slice(0, component.indexOf('const act ='));
  assert.match(automatic, /onPaymentPageReturn/);
  assert.match(automatic, /visibilitychange/);
  assert.match(automatic, /20_000/);
  assert.match(automatic, /checkCheckoutReturns\(result, controller.signal, checkSavedCheckout/);
  assert.match(automatic, /return \(\) => controller.abort\(\)/);
  assert.match(automatic, /\[userId, refresh\]/);
  assert.doesNotMatch(automatic, /await (resumeSavedCheckout|continueFamilySplitPayment|restartUndispatchedCheckout)|setInterval|location.assign/);
  assert.match(component, /autoController.current\?\.abort\(\)/);
  assert.match(component, /checks\[item.id\]\?\.phase !== 'COMPLETED'/);
});
