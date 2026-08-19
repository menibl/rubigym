#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root: sudo $0 [deploy-directory]" >&2
  exit 1
fi

DEPLOY_DIR=$(realpath "${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}")
if [[ ! -f /etc/gymflow/monitor.env ]]; then
  echo "Create /etc/gymflow/monitor.env from ${DEPLOY_DIR}/monitor.env.example first." >&2
  exit 1
fi
if [[ ! -s /etc/gymflow/secrets/telegram-bot-token ]]; then
  echo "Write the Telegram bot token to /etc/gymflow/secrets/telegram-bot-token first." >&2
  exit 1
fi

chown root:openclaw /etc/gymflow/secrets
chmod 0750 /etc/gymflow/secrets
chmod 0600 /etc/gymflow/monitor.env
chown root:openclaw /etc/gymflow/secrets/telegram-bot-token
chmod 0640 /etc/gymflow/secrets/telegram-bot-token
install -d -m 0755 /usr/local/lib/gymflow-monitor /var/lib/gymflow-monitor /var/log/gymflow
install -m 0755 "${DEPLOY_DIR}/scripts/telegram-send.sh" /usr/local/lib/gymflow-monitor/
install -m 0755 "${DEPLOY_DIR}/scripts/server-monitor.sh" /usr/local/lib/gymflow-monitor/
install -m 0755 "${DEPLOY_DIR}/scripts/security-audit.sh" /usr/local/lib/gymflow-monitor/
install -m 0755 "${DEPLOY_DIR}/scripts/gymflow-status.sh" /usr/local/bin/gymflow-status
install -m 0644 "${DEPLOY_DIR}/systemd/gymflow-monitor.service" /etc/systemd/system/
install -m 0644 "${DEPLOY_DIR}/systemd/gymflow-monitor.timer" /etc/systemd/system/
install -m 0644 "${DEPLOY_DIR}/systemd/gymflow-security-audit.service" /etc/systemd/system/
install -m 0644 "${DEPLOY_DIR}/systemd/gymflow-security-audit.timer" /etc/systemd/system/

systemctl daemon-reload
systemctl enable --now gymflow-monitor.timer gymflow-security-audit.timer
systemctl start gymflow-monitor.service || true
/usr/local/lib/gymflow-monitor/telegram-send.sh "✅ GymFlow monitoring enabled" \
  "24/7 deterministic monitoring is active on $(hostname)."

systemctl list-timers gymflow-monitor.timer gymflow-security-audit.timer --no-pager
