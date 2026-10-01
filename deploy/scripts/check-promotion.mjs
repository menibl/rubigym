import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function verifyRun(data, sha, workflow) {
  const runs = (data.workflow_runs || []).filter(run => run.head_sha === sha
    && run.head_branch === 'staging' && run.event === 'push');
  const latest = runs.sort((a, b) => Number(b.id) - Number(a.id))[0];
  if (!latest) throw new Error(`${workflow}: no staging push run found for ${sha}`);
  const description = `${workflow}: run ${latest.id}, commit ${latest.head_sha}, status ${latest.status}, conclusion ${latest.conclusion || 'pending'}`;
  if (latest.status !== 'completed' || latest.conclusion !== 'success') throw new Error(description);
  return description;
}

export function checkPromotion(env = process.env, query = args => execFileSync('gh', args, { encoding: 'utf8' })) {
  if (env.GITHUB_HEAD_REF !== 'staging') throw new Error('Production promotions must originate from staging');
  if (!/^[a-f0-9]{40}$/.test(env.EXPECTED_SHA || '')) throw new Error('Missing or invalid expected staging commit');
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY || '')) throw new Error('Missing or invalid repository');
  for (const workflow of ['ci.yml', 'deploy-pages.yml']) {
    const result = query(['api', `repos/${env.GITHUB_REPOSITORY}/actions/workflows/${workflow}/runs`,
      '--method', 'GET', '-f', 'branch=staging', '-f', 'event=push',
      '-f', `head_sha=${env.EXPECTED_SHA}`, '-f', 'per_page=100']);
    console.log(verifyRun(JSON.parse(result), env.EXPECTED_SHA, workflow));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { checkPromotion(); }
  catch (error) { console.error(`Promotion blocked: ${error.message}`); process.exitCode = 1; }
}
