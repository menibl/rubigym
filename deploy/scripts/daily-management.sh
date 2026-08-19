#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "This command must run as root." >&2
  exit 1
fi

CONFIG_FILE=${GYMFLOW_PRODUCTION_CONFIG:-/etc/gymflow/production.conf}
MONITOR_ENV=${GYMFLOW_MONITOR_ENV:-/etc/gymflow/monitor.env}
[[ -r ${CONFIG_FILE} ]] || { echo "Missing ${CONFIG_FILE}" >&2; exit 1; }
# shellcheck disable=SC1090
source "${CONFIG_FILE}"

SEND=/usr/local/lib/gymflow-monitor/telegram-send.sh
DEPLOY=/usr/local/lib/gymflow-deploy/production-deploy.sh
REPORT_DIR=/var/log/gymflow
install -d -m 0750 "${REPORT_DIR}" "${PRODUCTION_BACKUPS:-/var/backups/gymflow}"

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
report=${REPORT_DIR}/daily-${timestamp}.txt
current=none
[[ -r ${PRODUCTION_STATE:-/var/lib/gymflow-deploy}/current-sha ]] && current=$(<"${PRODUCTION_STATE:-/var/lib/gymflow-deploy}/current-sha")

{
  echo "GymFlow daily report ${timestamp}"
  echo "host=$(hostname -f 2>/dev/null || hostname)"
  echo "production_commit=${current}"
  echo "disk=$(df -P / | awk 'NR==2 {print $5}')"
  echo "memory=$(free | awk '/Mem:/ {printf \"%.0f%%\", ($2-$7)*100/$2}')"
  echo "load=$(awk '{print $1,$2,$3}' /proc/loadavg)"
  echo "security_updates=$(apt-get -s upgrade 2>/dev/null | awk '/^Inst/ && /security/ {count++} END {print count+0}')"
  echo "failed_units=$(systemctl --failed --no-legend | wc -l)"
  echo
  "${DEPLOY}" status || true
  echo
  docker system df || true
  echo
  fail2ban-client status sshd || true
} >"${report}" 2>&1
chmod 0640 "${report}"

if [[ ${current} != none ]]; then
  release=${PRODUCTION_RELEASES:-/opt/gymflow/releases}/${current}
  GYMFLOW_IMAGE="gymflow:${current}" \
  GYMFLOW_ENV_FILE="${PRODUCTION_ENV_FILE:-/etc/gymflow/production.env}" \
    docker compose --project-name gymflow \
      --env-file "${PRODUCTION_ENV_FILE:-/etc/gymflow/production.env}" \
      -f "${release}/deploy/compose.yaml" exec -T postgres \
      pg_dump -U gymflow gymflow | gzip -9 \
      >"${PRODUCTION_BACKUPS:-/var/backups/gymflow}/daily-${timestamp}.sql.gz"
  chmod 0600 "${PRODUCTION_BACKUPS:-/var/backups/gymflow}/daily-${timestamp}.sql.gz"
fi

find "${REPORT_DIR}" -type f -name 'daily-*.txt' -mtime +30 -delete
find "${PRODUCTION_BACKUPS:-/var/backups/gymflow}" -type f -name 'daily-*.sql.gz' -mtime +14 -delete

if [[ -x ${SEND} && -r ${MONITOR_ENV} ]]; then
  summary=$(head -n 9 "${report}")
  "${SEND}" "📋 GymFlow daily management" "${summary}" || true
fi
