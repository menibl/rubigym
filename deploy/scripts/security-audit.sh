#!/usr/bin/env bash
set -Eeuo pipefail

SEND=/usr/local/lib/gymflow-monitor/telegram-send.sh
OPENCLAW=/home/openclaw/.local/openclaw/bin/openclaw
REPORT_DIR=/var/log/gymflow
REPORT=${REPORT_DIR}/openclaw-security-$(date -u +%F).json

mkdir -p "${REPORT_DIR}"
if ! runuser -u openclaw -- "${OPENCLAW}" security audit --deep --json >"${REPORT}" 2>&1; then
  chmod 0640 "${REPORT}"
  "${SEND}" "🔐 OpenClaw security audit warning" \
    "The daily deep audit reported findings on $(hostname). Review ${REPORT}."
  exit 1
fi
chmod 0640 "${REPORT}"
find "${REPORT_DIR}" -type f -name 'openclaw-security-*.json' -mtime +30 -delete
