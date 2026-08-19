#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/scripts/update-openclaw-workflow.sh [deploy-directory]" >&2
  exit 1
fi

DEPLOY_DIR=$(realpath "${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}")
OPENCLAW=/home/openclaw/.local/openclaw/bin/openclaw
[[ -x ${OPENCLAW} ]] || { echo "OpenClaw is not installed." >&2; exit 1; }
id openclaw >/dev/null 2>&1 || { echo "Missing openclaw service user." >&2; exit 1; }

install -d -o openclaw -g openclaw -m 0700 /home/openclaw/.openclaw/workspace
install -d -o openclaw -g openclaw -m 0755 /home/openclaw/.local/bin
install -o root -g openclaw -m 0640 \
  "${DEPLOY_DIR}/openclaw/AGENTS.md" /home/openclaw/.openclaw/workspace/AGENTS.md
install -o root -g openclaw -m 0640 \
  "${DEPLOY_DIR}/openclaw/SOUL.md" /home/openclaw/.openclaw/workspace/SOUL.md
install -o root -g openclaw -m 0640 \
  "${DEPLOY_DIR}/openclaw/HEARTBEAT.md" /home/openclaw/.openclaw/workspace/HEARTBEAT.md
install -o root -g openclaw -m 0755 \
  "${DEPLOY_DIR}/scripts/gymflow-dev.sh" /home/openclaw/.local/bin/gymflow-dev

bash "${DEPLOY_DIR}/scripts/grant-openclaw-docker-access.sh" "${DEPLOY_DIR}"

run_oc() { runuser -u openclaw -- env HOME=/home/openclaw "${OPENCLAW}" "$@"; }
run_oc config set channels.telegram.customCommands '[{"command":"gymstatus","description":"Production and monitoring status"},{"command":"gymstart","description":"Start a feature branch"},{"command":"gymtest","description":"Test the current feature branch"},{"command":"gympublish","description":"Open a feature PR to staging"},{"command":"gymstage","description":"Approve a feature PR for GitHub Pages"},{"command":"gympromote","description":"Open staging to main PR"},{"command":"gymrelease","description":"Approve main merge and GCP release"},{"command":"gymlogs","description":"Bounded production logs"},{"command":"gymaudit","description":"Run the security audit"}]'
run_oc approvals allowlist add --agent main "/usr/local/bin/gymflow-status"
run_oc approvals allowlist add --agent main "/home/openclaw/.local/bin/gymflow-dev"
run_oc approvals allowlist add --agent main "/usr/local/bin/gymflow-prod"
run_oc config validate

systemctl restart openclaw.service
systemctl is-active --quiet openclaw.service
echo "OpenClaw Telegram development workflow updated successfully."
