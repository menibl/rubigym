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
  promote)
    [[ $# -eq 0 ]] || { echo "Usage: gymflow-dev promote" >&2; exit 2; }
    require_clean
    git fetch origin --prune
    staging_sha=$(git rev-parse origin/staging)
    run=$(gh run list --workflow deploy-pages.yml --branch staging --limit 1 \
      --json conclusion,headSha --jq '.[0] | [.conclusion,.headSha] | @tsv')
    conclusion=${run%%$'\t'*}
    deployed_sha=${run#*$'\t'}
    [[ ${conclusion} == success && ${deployed_sha} == "${staging_sha}" ]] || {
      echo "The current staging commit has not completed a successful public deployment." >&2
      exit 1
    }
    gh pr create --base main --head staging \
      --title "Promote staging to production" \
      --body "Staging commit ${staging_sha} passed CI and the GitHub Pages deployment. Merge requires human approval; GCP deploys only after the merge reaches main."
    ;;
  *)
    echo "Commands: status, start <slug>, test, publish <message>, promote" >&2
    exit 2
    ;;
esac
