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
grep -Fq 'refresh-monitor)' "${OPS}"
grep -Fq 'systemctl start gymflow-monitor.service || true' "${OPS}"

echo "server monitor hardening regression test passed."
