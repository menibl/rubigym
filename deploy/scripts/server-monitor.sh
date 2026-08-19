#!/usr/bin/env bash
set -Eeuo pipefail

ENV_FILE=${GYMFLOW_MONITOR_ENV:-/etc/gymflow/monitor.env}
STATE_DIR=/var/lib/gymflow-monitor
STATUS_FILE=${STATE_DIR}/status.json
COUNTER_FILE=${STATE_DIR}/failure-count
ALERT_STATE_FILE=${STATE_DIR}/alert-state
SEND=/usr/local/lib/gymflow-monitor/telegram-send.sh

[[ -r ${ENV_FILE} ]] || { echo "Missing ${ENV_FILE}" >&2; exit 1; }
# shellcheck disable=SC1090
source "${ENV_FILE}"

mkdir -p "${STATE_DIR}"
issues=()

if ! curl --fail --silent --show-error --connect-timeout 5 --max-time 15 "${APP_HEALTH_URL}" >/dev/null; then
  issues+=("Application health endpoint is unavailable: ${APP_HEALTH_URL}")
fi

if ! systemctl is-active --quiet openclaw.service; then
  issues+=("OpenClaw systemd service is not active")
fi

if ! systemctl is-active --quiet docker.service; then
  issues+=("Docker service is not active")
else
  app_container=$(docker ps \
    --filter label=com.docker.compose.project=gymflow \
    --filter label=com.docker.compose.service=app \
    --format '{{.ID}}' | head -n 1)
  if [[ -z ${app_container} ]] || ! docker inspect --format '{{.State.Health.Status}}' "${app_container}" 2>/dev/null | grep -qx healthy; then
    issues+=("GymFlow application container is not healthy")
  fi
fi

disk_percent=$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
memory_percent=$(free | awk '/Mem:/ {printf "%d", ($2-$7)*100/$2}')
cpu_count=$(nproc)
load_1m=$(awk '{print $1}' /proc/loadavg)
load_limit=$(awk -v cpus="${cpu_count}" -v factor="${LOAD_WARN_PER_CPU:-2}" 'BEGIN {print cpus*factor}')

if (( disk_percent >= DISK_WARN_PERCENT )); then issues+=("Root disk usage is ${disk_percent}%"); fi
if (( memory_percent >= MEMORY_WARN_PERCENT )); then issues+=("Memory usage is ${memory_percent}%"); fi
if awk -v load="${load_1m}" -v limit="${load_limit}" 'BEGIN {exit !(load >= limit)}'; then
  issues+=("1-minute load ${load_1m} exceeds threshold ${load_limit}")
fi

fail2ban_status=$(systemctl is-active fail2ban 2>/dev/null || true)
if [[ ${fail2ban_status} != active ]]; then issues+=("fail2ban is not active"); fi

now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
issues_json=$(printf '%s\n' "${issues[@]:-}" | jq -Rsc 'split("\n") | map(select(length > 0))')
jq -n \
  --arg timestamp "${now}" \
  --arg hostname "$(hostname -f 2>/dev/null || hostname)" \
  --argjson healthy "$([[ ${#issues[@]} -eq 0 ]] && echo true || echo false)" \
  --argjson issues "${issues_json}" \
  --argjson diskPercent "${disk_percent}" \
  --argjson memoryPercent "${memory_percent}" \
  --arg load1m "${load_1m}" \
  '{timestamp:$timestamp,hostname:$hostname,healthy:$healthy,issues:$issues,diskPercent:$diskPercent,memoryPercent:$memoryPercent,load1m:($load1m|tonumber)}' \
  >"${STATUS_FILE}.tmp"
mv "${STATUS_FILE}.tmp" "${STATUS_FILE}"
chmod 0644 "${STATUS_FILE}"

previous_state=unknown
if [[ -r ${ALERT_STATE_FILE} ]]; then previous_state=$(<"${ALERT_STATE_FILE}"); fi
if [[ ${#issues[@]} -eq 0 ]]; then
  echo 0 >"${COUNTER_FILE}"
  echo healthy >"${ALERT_STATE_FILE}"
  if [[ ${previous_state} == alert ]]; then
    "${SEND}" "✅ GymFlow recovered" "All automated health checks are passing on $(hostname)."
  fi
  exit 0
fi

count=0
if [[ -r ${COUNTER_FILE} ]]; then count=$(<"${COUNTER_FILE}"); fi
count=$((count + 1))
echo "${count}" >"${COUNTER_FILE}"

if (( count >= ${ALERT_AFTER_FAILURES:-2} )) && [[ ${previous_state} != alert ]]; then
  details=$(printf '• %s\n' "${issues[@]}")
  "${SEND}" "🚨 GymFlow server alert" "Host: $(hostname)"$'\n'"${details}"
  echo alert >"${ALERT_STATE_FILE}"
fi

exit 1
