#!/usr/bin/env bash
set -Eeuo pipefail

[[ ${EUID} -eq 0 ]] || { echo "Use sudo /usr/local/sbin/gymflow-ops refresh-runtime." >&2; exit 1; }
DEPLOY_DIR=$(realpath "${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}")

monitor_configured() { [[ -r /etc/gymflow/monitor.env ]]; }

refresh_runtime() {
  # Validate every source before changing the host. No secrets are copied or printed.
  local source
  for source in scripts/server-monitor.sh systemd/gymflow-monitor.service \
      systemd/gymflow-monitor.timer systemd/openclaw-resource-limits.conf \
      systemd/gymflow-production-deploy.service; do
    [[ -f ${DEPLOY_DIR}/${source} ]] || { echo "Release is missing ${source}." >&2; return 1; }
  done
  install -d -m 0755 /usr/local/lib/gymflow-monitor /var/lib/gymflow-monitor \
    /etc/systemd/system/openclaw.service.d || return 1
  install -m 0755 "${DEPLOY_DIR}/scripts/server-monitor.sh" /usr/local/lib/gymflow-monitor/server-monitor.sh || return 1
  install -m 0644 "${DEPLOY_DIR}/systemd/gymflow-monitor.service" /etc/systemd/system/gymflow-monitor.service || return 1
  install -m 0644 "${DEPLOY_DIR}/systemd/gymflow-monitor.timer" /etc/systemd/system/gymflow-monitor.timer || return 1
  install -m 0644 "${DEPLOY_DIR}/systemd/gymflow-production-deploy.service" /etc/systemd/system/gymflow-production-deploy.service || return 1
  install -m 0644 "${DEPLOY_DIR}/systemd/openclaw-resource-limits.conf" \
    /etc/systemd/system/openclaw.service.d/40-gymflow-resources.conf || return 1
  systemctl daemon-reload || return 1

  if [[ $(systemctl show openclaw.service --property=LoadState --value) != not-found ]]; then
    # Apply to the entire service cgroup, including hooks/child processes, without
    # restarting the gateway or granting Docker access. Persistent drop-in above
    # preserves the same limits after reboot. MemoryMax may kill an oversized task.
    systemctl set-property --runtime openclaw.service \
      CPUAccounting=true CPUQuota=100% CPUWeight=20 \
      MemoryAccounting=true MemoryHigh=1536M MemoryMax=2G \
      TasksAccounting=true TasksMax=128 IOAccounting=true IOWeight=20 || return 1
    systemctl show openclaw.service --property=CPUQuotaPerSecUSec \
      --property=MemoryHigh --property=MemoryMax --property=TasksMax || return 1
  else
    echo "OpenClaw is not installed; limits will apply when its service is installed."
  fi

  if monitor_configured; then
    systemctl enable --now gymflow-monitor.timer || return 1
    # Unhealthy checks must not roll back an otherwise successful application
    # deployment. Report them visibly rather than silently pretending all is well.
    if ! systemctl start gymflow-monitor.service; then
      echo "WARNING: monitor reported an unhealthy check; inspect gymflow-ops status and monitor journal." >&2
    fi
  fi
}

refresh_runtime
