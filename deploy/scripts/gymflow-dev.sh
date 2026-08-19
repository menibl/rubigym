#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $(id -un) != openclaw ]]; then
  echo "Run this command as the openclaw service user." >&2
  exit 1
fi

REPO=${GYMFLOW_DEV_REPO:-/home/openclaw/.openclaw/workspace/gymflow-management}
[[ -d ${REPO}/.git ]] || { echo "Missing Git worktree: ${REPO}" >&2; exit 1; }
cd "${REPO}"

require_clean() {
  [[ -z $(git status --porcelain) ]] || { echo "Worktree must be clean for this operation." >&2; exit 1; }
}

require_pr_number() {
  [[ $# -eq 1 && $1 =~ ^[1-9][0-9]*$ ]] || {
    echo "A numeric pull request number is required." >&2
    exit 2
  }
}

pr_field() {
  local pr=$1 field=$2
  gh pr view "${pr}" --json "${field}" --jq ".${field}"
}

pr_merge_sha() {
  local pr=$1
  gh pr view "${pr}" --json mergeCommit --jq '.mergeCommit.oid'
}

wait_for_workflow() {
  local workflow=$1 sha=$2 label=$3 attempt run_id
  for ((attempt=1; attempt<=60; attempt++)); do
    run_id=$(gh run list --workflow "${workflow}" --branch staging --limit 20 \
      --json databaseId,headSha \
      --jq "[.[] | select(.headSha == \"${sha}\")][0].databaseId // empty")
    if [[ -n ${run_id} ]]; then
      echo "Waiting for ${label} run ${run_id} on ${sha}."
      timeout 25m gh run watch "${run_id}" --exit-status
      return 0
    fi
    sleep 10
  done
  echo "Timed out waiting for ${label} to start for ${sha}." >&2
  return 1
}

require_staging_ready() {
  local staging_sha=$1 workflow result conclusion deployed_sha
  for workflow in ci.yml deploy-pages.yml; do
    result=$(gh run list --workflow "${workflow}" --branch staging --limit 20 \
      --json conclusion,headSha \
      --jq "[.[] | select(.headSha == \"${staging_sha}\")][0] | [.conclusion,.headSha] | @tsv")
    conclusion=${result%%$'\t'*}
    deployed_sha=${result#*$'\t'}
    [[ ${conclusion} == success && ${deployed_sha} == "${staging_sha}" ]] || {
      echo "Staging ${staging_sha} is not ready: ${workflow} has not succeeded for the exact commit." >&2
      return 1
    }
  done
}

validate_pr_target() {
  local pr=$1 expected_base=$2 expected_head_pattern=$3 state draft base head
  state=$(pr_field "${pr}" state)
  draft=$(pr_field "${pr}" isDraft)
  base=$(pr_field "${pr}" baseRefName)
  head=$(pr_field "${pr}" headRefName)
  [[ ${state} == OPEN && ${draft} == false ]] || {
    echo "PR #${pr} must be open and ready for review." >&2
    exit 1
  }
  [[ ${base} == "${expected_base}" && ${head} == ${expected_head_pattern} ]] || {
    echo "PR #${pr} has unexpected branches: ${head} -> ${base}." >&2
    exit 1
  }
}

validate_feature_branch() {
  local branch
  branch=$(git branch --show-current)
  [[ ${branch} == feature/* ]] || { echo "Current branch must start with feature/." >&2; exit 1; }
  printf '%s' "${branch}"
}

command=${1:-status}
shift || true
case "${command}" in
  status)
    git status --short --branch
    gh pr status || true
    ;;
  start)
    [[ $# -eq 1 && $1 =~ ^[a-z0-9][a-z0-9-]{1,38}$ ]] || {
      echo "Usage: gymflow-dev start short-lowercase-name" >&2; exit 2;
    }
    require_clean
    git fetch origin --prune
    branch="feature/$(date -u +%Y%m%d-%H%M)-$1"
    git switch --create "${branch}" --track origin/staging
    echo "Created ${branch}."
    ;;
  test)
    corepack pnpm install --frozen-lockfile
    corepack pnpm run lint
    corepack pnpm run build
    ;;
  publish)
    [[ $# -ge 1 ]] || { echo "Usage: gymflow-dev publish commit message" >&2; exit 2; }
    branch=$(validate_feature_branch)
    message="$*"
    [[ ${#message} -ge 5 && ${#message} -le 120 ]] || { echo "Commit message must be 5-120 characters." >&2; exit 2; }
    if git status --porcelain | grep -E '(^|/)(\.env($|\.)|auth\.json$|.*\.pem$|.*\.key$)' >/dev/null; then
      echo "Refusing to publish possible secret files." >&2
      exit 1
    fi
    corepack pnpm run lint
    corepack pnpm run build
  # Never let local package caches, deployment bundles, or rendered review
  # artifacts hitch a ride in an automated Telegram-triggered commit.
  git add -A -- . \
    ':(exclude).pnpm-store/**' \
    ':(exclude)*.tar.gz' \
    ':(exclude)docs/rendered-rules/**'
    git diff --cached --quiet && { echo "There are no changes to publish." >&2; exit 1; }
    git commit -m "${message}"
    git push --set-upstream origin "${branch}"
    gh pr create --base staging --head "${branch}" --title "${message}" \
      --body "Created from the allowlisted OpenClaw Telegram workflow. CI and human review are required before staging."
    ;;
  stage)
    require_pr_number "$@"
    pr=$1
    require_clean
    git fetch origin --prune
    validate_pr_target "${pr}" staging 'feature/*'
    head_sha=$(pr_field "${pr}" headRefOid)
    echo "Validating PR #${pr} at ${head_sha} before merging to staging."
    gh pr checks "${pr}" --watch --fail-fast
    [[ $(pr_field "${pr}" headRefOid) == "${head_sha}" ]] || {
      echo "PR #${pr} changed while checks were running; request a new approval." >&2
      exit 1
    }
    gh pr merge "${pr}" --merge --match-head-commit "${head_sha}"
    merged_sha=$(pr_merge_sha "${pr}")
    git fetch origin --prune staging
    staging_sha=$(git rev-parse origin/staging)
    [[ ${staging_sha} == "${merged_sha}" ]] || {
      echo "Staging advanced after PR #${pr} merged. Refusing to certify a different commit." >&2
      exit 1
    }
    wait_for_workflow ci.yml "${staging_sha}" "staging CI"
    wait_for_workflow deploy-pages.yml "${staging_sha}" "GitHub Pages"
    require_staging_ready "${staging_sha}"
    printf 'staging_sha=%s\nstaging_url=https://menibl.github.io/rubigym/\n' "${staging_sha}"
    ;;
  staging-status)
    [[ $# -eq 0 ]] || { echo "Usage: gymflow-dev staging-status" >&2; exit 2; }
    git fetch origin --prune staging
    staging_sha=$(git rev-parse origin/staging)
    printf 'staging_sha=%s\n' "${staging_sha}"
    gh run list --branch staging --limit 10 \
      --json workflowName,status,conclusion,headSha,url \
      --jq ".[] | select(.headSha == \"${staging_sha}\")"
    ;;
  promote)
    [[ $# -eq 0 ]] || { echo "Usage: gymflow-dev promote" >&2; exit 2; }
    require_clean
    git fetch origin --prune
    staging_sha=$(git rev-parse origin/staging)
    require_staging_ready "${staging_sha}"
    existing=$(gh pr list --base main --head staging --state open --limit 1 \
      --json number,url --jq '.[0] | [.number,.url] | @tsv')
    if [[ -n ${existing} ]]; then
      printf 'promotion_pr=%s\n' "${existing}"
    else
      gh pr create --base main --head staging \
        --title "Promote staging to production" \
        --body "Staging commit ${staging_sha} passed CI and the GitHub Pages deployment. Merge requires explicit operator approval; GCP deploys only after the merge reaches main."
    fi
    ;;
  release)
    require_pr_number "$@"
    pr=$1
    require_clean
    git fetch origin --prune staging main
    validate_pr_target "${pr}" main staging
    staging_sha=$(git rev-parse origin/staging)
    [[ $(pr_field "${pr}" headRefOid) == "${staging_sha}" ]] || {
      echo "PR #${pr} does not point to the current staging commit." >&2
      exit 1
    }
    require_staging_ready "${staging_sha}"
    echo "Validating production PR #${pr} for staging commit ${staging_sha}."
    gh pr checks "${pr}" --watch --fail-fast
    [[ $(pr_field "${pr}" headRefOid) == "${staging_sha}" ]] || {
      echo "PR #${pr} changed while checks were running; request a new approval." >&2
      exit 1
    }
    gh pr merge "${pr}" --merge --match-head-commit "${staging_sha}"
    merged_sha=$(pr_merge_sha "${pr}")
    git fetch origin --prune main
    production_sha=$(git rev-parse origin/main)
    [[ ${production_sha} == "${merged_sha}" ]] || {
      echo "Main advanced after PR #${pr} merged. Refusing to certify a different production commit." >&2
      exit 1
    }
    printf 'production_sha=%s\n' "${production_sha}"
    echo "The production timer will deploy this main commit within five minutes."
    ;;
  *)
    echo "Commands: status, start <slug>, test, publish <message>, stage <pr>, staging-status, promote, release <pr>" >&2
    exit 2
    ;;
esac
