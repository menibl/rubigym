import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverFamilyCredit } from './family-credit-recovery.js';
import worker from './index.js';

function fixture(patch = {}) {
  const claim = { claim_id: 'claim', recovery_stage: null, created_at: '2020-01-01', ...patch };
  let releases = 0;
  const options = {
    store: { getFamilyCreditClaim: async () => claim, releaseUndispatchedFamilyCredit: async () => { releases++; return true; } },
    clubId: 'club', payment: { id: 'paid', traineeId: 'payer' }, payments: [], action: 'check', managerId: 'manager', reason: 'recovery',
    readOrder: async () => ({ u: 'payer', cs: 'paid', m: 'FAMILY_MEMBERSHIP', d: 'PRIMARY', t: Date.now() }),
    verifyAndPersist: async () => {},
  };
  return { options, releases: () => releases };
}
test('legacy missing checkout and dispatched failures never release credit', async () => {
  for (const recovery_stage of [null, 'DISPATCHED']) {
    const f = fixture({ recovery_stage });
    assert.equal((await recoverFamilyCredit(f.options)).state, 'REVIEW_REQUIRED');
    assert.equal((await recoverFamilyCredit({ ...f.options, action: 'release' })).state, 'BLOCKED');
    assert.equal(f.releases(), 0);
  }
});
test('only stale undispatched claims are releasable; CAS failure stays blocked', async () => {
  const f = fixture({ recovery_stage: 'RESERVED' });
  assert.equal((await recoverFamilyCredit(f.options)).state, 'RELEASABLE');
  assert.equal((await recoverFamilyCredit({ ...f.options, action: 'release' })).state, 'RELEASED');
  f.options.store.releaseUndispatchedFamilyCredit = async () => false;
  assert.equal((await recoverFamilyCredit({ ...f.options, action: 'release' })).state, 'BLOCKED');
  const recent = fixture({ recovery_stage: 'RESERVED', created_at: new Date().toISOString() });
  assert.equal((await recoverFamilyCredit({ ...recent.options, action: 'release' })).state, 'BLOCKED');
});
test('completed or locally applied credit cannot be released', async () => {
  const f = fixture({ recovery_stage: 'RESERVED' });
  f.options.payments = [{ familyCreditSourcePaymentId: 'paid' }];
  assert.equal((await recoverFamilyCredit({ ...f.options, action: 'release' })).state, 'USED');
  assert.equal(f.releases(), 0);
});
test('saved signed request must match source payment and payer before provider lookup', async () => {
  const f = fixture({ checkout: { paymentReference: 'stored' } });
  f.options.readOrder = async () => ({ u: 'other', cs: 'paid', m: 'FAMILY_MEMBERSHIP', d: 'PRIMARY' });
  f.options.verifyAndPersist = async () => assert.fail('must not call provider');
  assert.equal((await recoverFamilyCredit(f.options)).state, 'BLOCKED');
});
test('verified stored payment is reconciled; unknown upstream error never releases or resumes', async () => {
  const f = fixture({ checkout: { paymentReference: 'stored', url: 'https://icredit.rivhit.co.il/payment/test' } });
  assert.equal((await recoverFamilyCredit(f.options)).state, 'SYNCED');
  f.options.verifyAndPersist = async () => { throw new Error('RIVHIT_UNAVAILABLE'); };
  assert.equal((await recoverFamilyCredit(f.options)).state, 'REVIEW_REQUIRED');
  assert.equal(f.releases(), 0);
});
test('only a recent explicitly unverified payment exposes existing provider URL, never a new checkout', async () => {
  const f = fixture({ checkout: { paymentReference: 'stored', url: 'https://icredit.rivhit.co.il/payment/test' } });
  f.options.verifyAndPersist = async () => { throw new Error('RIVHIT_PAYMENT_NOT_VERIFIED'); };
  assert.equal((await recoverFamilyCredit(f.options)).state, 'EXISTING_PAGE');
  f.options.readOrder = async () => ({ u: 'payer', cs: 'paid', m: 'FAMILY_MEMBERSHIP', d: 'PRIMARY', t: 1 });
  assert.equal((await recoverFamilyCredit(f.options)).state, 'REVIEW_REQUIRED');
});
test('recovery endpoint rejects trainee, coach and unauthenticated access', async () => {
  for (const role of [null, 'TRAINEE', 'COACH']) {
    const response = await worker.fetch(new Request('https://test.local/api/payments/rivhit/admin/family-credit-recovery', {
      method: 'POST', headers: { Cookie: 'baly_session=test', 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId: 'paid', action: 'release', reason: 'test' }),
    }), { STATE_STORE: { getSession: async () => role ? { club_id: 'club', user_id: 'user' } : null, getAccount: async () => ({ role, user_id: 'user' }) } });
    assert.equal(response.status, 403);
  }
});
