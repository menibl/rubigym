#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR=$(realpath "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)")
RUNTIME=${ROOT_DIR}/deploy/scripts/refresh-server-runtime.sh
DEPLOY=${ROOT_DIR}/deploy/scripts/production-deploy.sh
LIMITS=${ROOT_DIR}/deploy/systemd/openclaw-resource-limits.conf
SERVICE=${ROOT_DIR}/deploy/systemd/gymflow-production-deploy.service

# No live root, Docker, systemd or /etc changes: only evaluate the installer
# function with mocked install/systemctl commands and fixture source paths.
function_source=$(awk '
  /^refresh_runtime\(\)/ {capture=1}
  capture {print}
  capture && /^}$/ {exit}
' "${RUNTIME}")
[[ -n ${function_source} ]]
eval "${function_source}"
DEPLOY_DIR=${ROOT_DIR}/deploy
calls=()
load_state=loaded
fail_limits=false
fail_monitor=false
install() { calls+=("install $*"); }
monitor_configured() { return 0; }
systemctl() {
  calls+=("systemctl $*")
  if [[ $1 == show && $* == *--property=LoadState* ]]; then printf '%s\n' "${load_state}"; fi
  if [[ $1 == set-property && ${fail_limits} == true ]]; then return 1; fi
  if [[ $1 == start && ${fail_monitor} == true ]]; then return 1; fi
  return 0
}
assert_call() {
  local expected=$1 item
  for item in "${calls[@]}"; do [[ ${item} == *"${expected}"* ]] && return 0; done
  echo "Missing mocked operation: ${expected}" >&2
  return 1
}
refresh_runtime
assert_call '40-gymflow-resources.conf'
assert_call 'server-monitor.sh'
assert_call 'gymflow-production-deploy.service'
assert_call 'systemctl daemon-reload'
assert_call 'systemctl set-property --runtime openclaw.service'
assert_call 'MemoryHigh=1536M MemoryMax=2G'
assert_call 'CPUQuota=100% CPUWeight=20'
assert_call 'TasksMax=128'
assert_call 'systemctl start gymflow-monitor.service'
for item in "${calls[@]}"; do
  [[ ${item} != *'restart openclaw'* && ${item} != *'docker.sock'* ]]
done
calls=()
refresh_runtime # Idempotent: same managed drop-in, not appended settings.
assert_call '40-gymflow-resources.conf'
calls=()
load_state=not-found
refresh_runtime
for item in "${calls[@]}"; do [[ ${item} != *'set-property'* ]]; done
load_state=loaded
fail_monitor=true
refresh_runtime # Unhealthy monitor doesn't cause unnecessary app rollback.
fail_monitor=false

# Capture failures explicitly: don't run a shell function in an `if`, which
# would disable Bash errexit for its entire body.
if (fail_limits=true; refresh_runtime || exit $?; exit 99); then
  echo 'Failed resource application was silently accepted.' >&2; exit 1
else
  result=$?
  [[ ${result} != 99 ]]
fi
if (DEPLOY_DIR=/nonexistent-gymflow-test-fixture; refresh_runtime || exit $?; exit 99); then
  echo 'Missing release files were accepted.' >&2; exit 1
else
  result=$?
  [[ ${result} != 99 ]]
fi

grep -Fxq 'CPUQuota=100%' "${LIMITS}"
grep -Fxq 'MemoryHigh=1536M' "${LIMITS}"
grep -Fxq 'MemoryMax=2G' "${LIMITS}"
grep -Fxq 'TasksMax=128' "${LIMITS}"
grep -Fq 'refresh-server-runtime.sh' "${DEPLOY}"
grep -Fq 'ReadWritePaths=/usr/local/lib/gymflow-deploy /usr/local/lib/gymflow-monitor /usr/local/sbin /etc/systemd/system /var/lib/gymflow-monitor' "${SERVICE}"
echo 'server runtime and OpenClaw limits regression tests passed.'
