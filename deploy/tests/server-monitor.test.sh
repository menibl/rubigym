#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(realpath "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)")
MONITOR=${ROOT_DIR}/deploy/scripts/server-monitor.sh
SERVICE=${ROOT_DIR}/deploy/systemd/gymflow-monitor.service
OPS=${ROOT_DIR}/deploy/scripts/gymflow-ops
EXAMPLE_ENV=${ROOT_DIR}/deploy/monitor.env.example

grep -Fq ': "${DOCKER_COMMAND_TIMEOUT_SECONDS:=10}"' "${MONITOR}"
grep -Fq 'timeout --foreground "${DOCKER_COMMAND_TIMEOUT_SECONDS}" docker ps' "${MONITOR}"
grep -Fq 'timeout --foreground "${DOCKER_COMMAND_TIMEOUT_SECONDS}" \' "${MONITOR}"
grep -Fq 'docker inspect --format' "${MONITOR}"
grep -Fq 'awk -v current_load="${load_1m}" -v limit="${load_limit}"' "${MONITOR}"
if grep -Fq 'awk -v load=' "${MONITOR}"; then
  echo "The monitor still uses gawk's reserved load identifier." >&2
  exit 1
fi
grep -Fq 'TimeoutStartSec=45s' "${SERVICE}"
grep -Fq 'DOCKER_COMMAND_TIMEOUT_SECONDS=10' "${EXAMPLE_ENV}"
grep -Fq 'refresh-monitor|refresh-runtime)' "${OPS}"
grep -Fq 'CPU load check failed' "${MONITOR}"
grep -Fq 'refresh-server-runtime.sh' "${OPS}"

load_source=$(awk '
  /^load_high=0$/ {capture=1}
  capture {print}
  capture && /issues\+=\("1-minute load/ {last_if=1}
  last_if && /^fi$/ {exit}
' "${MONITOR}")
[[ -n ${load_source} ]]
issues=()
load_1m=11
load_limit=4
eval "${load_source}"
[[ ${#issues[@]} -eq 1 && ${issues[0]} == *'exceeds threshold'* ]]
issues=()
load_1m=1
eval "${load_source}"
[[ ${#issues[@]} -eq 0 ]]
# A broken awk invocation (the production incident) must produce an issue.
awk() { return 2; }
issues=()
eval "${load_source}"
[[ ${#issues[@]} -eq 1 && ${issues[0]} == 'CPU load check failed' ]]
awk() { printf 'invalid\n'; }
issues=()
eval "${load_source}"
[[ ${#issues[@]} -eq 1 && ${issues[0]} == 'CPU load check returned an invalid result' ]]
unset -f awk

echo "server monitor hardening regression test passed."
