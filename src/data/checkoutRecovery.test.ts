import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isApprovalRetryable, retryPaymentApproval } from './paymentApprovalRetry';

test('temporary checkout verification is retried with a finite budget without changing financial state', async () => {
  let reads = 0;
  const waits: number[] = [];
  const error = Object.assign(new Error('provider temporarily unavailable'), { code: 'CHECKOUT_VERIFICATION_PENDING' });
  assert.equal(isApprovalRetryable(error), true);
  await assert.rejects(retryPaymentApproval(async () => { reads++; throw error; }, {
    delays: [3, 5, 10], wait: async value => { waits.push(value); }
  }), (value: Error & { code?: string }) => value.code === 'APPROVAL_CHECK_DEFERRED');
  assert.equal(reads, 4);
  assert.deepEqual(waits, [3, 5, 10]);
  reads = 0;
  const conflict = Object.assign(new Error('unsafe order mismatch'), { code: 'RECURRING_CHECKOUT_REVIEW' });
  await assert.rejects(retryPaymentApproval(async () => { reads++; throw conflict; }), /unsafe order mismatch/);
  assert.equal(reads, 1);
});

test('customer recovery UI uses server-owned orders, original references, explicit reset and no demo API access', () => {
  const client = readFileSync(new URL('./rivhitPayments.ts', import.meta.url), 'utf8');
  const component = readFileSync(new URL('../components/PendingCheckoutRecovery.tsx', import.meta.url), 'utf8');
  const dashboard = readFileSync(new URL('../components/TraineeDashboard.tsx', import.meta.url), 'utf8');
  const gateway = readFileSync(new URL('../components/AuthGateway.tsx', import.meta.url), 'utf8');
  const resume = client.slice(client.indexOf('export const resumeSavedCheckout'), client.indexOf('export const verifyPendingRivhitPayment'));
  assert.match(resume, /retryPaymentApproval\(\(\) => checkoutRecovery\('resume'/);
  assert.doesNotMatch(resume, /startRivhitPayment\(|familySplitAction\('create'|rivhitPost\(/);
  assert.match(resume, /sessionStorage.setItem\(PENDING_PAYMENT_KEY/);
  assert.match(resume, /resumedAuthenticatedRegistration: summary.mode === 'REGISTRATION'/);
  assert.match(resume, /window.location.assign\(result.url\)/);
  assert.match(resume, /if \(result.completed \|\| result.released\)/);
  assert.match(component, /if \(isPagesDemoMode\(\)\) return;/);
  assert.match(component, /continueFamilySplitPayment\(item.id, userId/);
  assert.match(component, /item.canRestart &&/);
  assert.match(component, /window.confirm/);
  const membershipTab = dashboard.slice(dashboard.indexOf("{activeTab === 'membership' &&"));
  assert.match(membershipTab, /<PendingCheckoutRecovery key=\{`\$\{activeUser.id\}-\$\{checkoutReturn\}`\} userId=\{activeUser.id\}/);
  assert.equal((dashboard.match(/<PendingCheckoutRecovery /g) || []).length, 1);
  assert.match(dashboard, /pending.mode === 'REGISTRATION' && !pending.resumedAuthenticatedRegistration/);
  assert.match(gateway, /if \(pending.resumedAuthenticatedRegistration\) \{\s*setScreen\('login'\)/);
});
