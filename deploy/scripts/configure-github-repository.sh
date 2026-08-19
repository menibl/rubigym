#!/usr/bin/env bash
set -Eeuo pipefail

command -v gh >/dev/null || { echo "GitHub CLI (gh) is required." >&2; exit 1; }
gh auth status >/dev/null

repo=${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}
[[ ${repo} =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { echo "Invalid owner/repository." >&2; exit 2; }

default_branch=$(gh api "repos/${repo}" --jq .default_branch)
[[ ${default_branch} == main ]] || {
  echo "This workflow expects main as the default branch; found ${default_branch}." >&2
  exit 1
}

if ! gh api "repos/${repo}/branches/staging" >/dev/null 2>&1; then
  main_sha=$(gh api "repos/${repo}/git/ref/heads/main" --jq .object.sha)
  gh api --method POST "repos/${repo}/git/refs" \
    -f ref='refs/heads/staging' -f sha="${main_sha}" >/dev/null
fi

protection_staging=$(mktemp)
protection_main=$(mktemp)
trap 'rm -f "${protection_staging}" "${protection_main}"' EXIT
cat >"${protection_staging}" <<'JSON'
{
  "required_status_checks": {"strict": true, "contexts": ["validate"]},
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON

jq '.required_status_checks.contexts += ["promotion-gate"]' \
  "${protection_staging}" >"${protection_main}"

gh api --method PUT "repos/${repo}/branches/staging/protection" \
  --input "${protection_staging}" >/dev/null
gh api --method PUT "repos/${repo}/branches/main/protection" \
  --input "${protection_main}" >/dev/null

gh api --method POST "repos/${repo}/pages" -f build_type=workflow >/dev/null 2>&1 || true

echo "GitHub workflow configured for ${repo}:"
echo "  feature/* -> PR -> staging -> GitHub Pages -> PR -> main -> GCP"
echo "Set repository variable PAYMENT_API_URL to the public GCP URL before testing payments on staging."
