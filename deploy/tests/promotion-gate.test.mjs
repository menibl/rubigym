import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPromotion, verifyRun } from '../scripts/check-promotion.mjs';

const sha = 'a'.repeat(40);
const run = { id: 10, head_sha: sha, head_branch: 'staging', event: 'push', status: 'completed', conclusion: 'success' };
test('accepts only successful exact staging push commit despite unrelated newer runs', () => {
  assert.match(verifyRun({ workflow_runs: [{ ...run, id: 20, head_sha: 'b'.repeat(40) }, run] }, sha, 'Pages'), /run 10/);
});
test('rejects missing, wrong commit, wrong branch and pull request runs', () => {
  for (const runs of [[], [{ ...run, head_sha: 'b'.repeat(40) }], [{ ...run, head_branch: 'main' }], [{ ...run, event: 'pull_request' }]]) {
    assert.throws(() => verifyRun({ workflow_runs: runs }, sha, 'Pages'), /no staging push run/);
  }
});
test('does not accept an older success when a newer matching run failed or is pending', () => {
  for (const conclusion of ['failure', 'cancelled', null]) {
    assert.throws(() => verifyRun({ workflow_runs: [run, { ...run, id: 11, conclusion }] }, sha, 'Pages'), /run 11/);
  }
  assert.throws(() => verifyRun({ workflow_runs: [{ ...run, status: 'in_progress' }] }, sha, 'Pages'), /in_progress/);
});
test('queries CI and Pages by exact SHA and rejects incorrect promotion source', () => {
  const calls = [];
  const env = { GITHUB_HEAD_REF: 'staging', EXPECTED_SHA: sha, GITHUB_REPOSITORY: 'owner/repo' };
  checkPromotion(env, args => { calls.push(args); return JSON.stringify({ workflow_runs: [run] }); });
  assert.equal(calls.length, 2);
  assert.ok(calls.every(args => args.includes(`head_sha=${sha}`) && args.includes('event=push')));
  assert.throws(() => checkPromotion({ ...env, GITHUB_HEAD_REF: 'feature/test' }), /originate from staging/);
});
