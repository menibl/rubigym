#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root: sudo $0 <telegram-user-id> [openclaw-version]" >&2
  exit 1
fi

TELEGRAM_USER_ID=${1:-}
OPENCLAW_VERSION=${2:-latest}
if [[ ! ${TELEGRAM_USER_ID} =~ ^[0-9]+$ ]]; then
  echo "A numeric Telegram user ID is required for the allowlist." >&2
  exit 1
fi
if [[ ! -s /etc/gymflow/secrets/telegram-bot-token ]]; then
  echo "Missing /etc/gymflow/secrets/telegram-bot-token" >&2
  exit 1
fi

if ! id openclaw >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash openclaw
fi

install -d -o openclaw -g openclaw -m 0700 \
  /home/openclaw/.openclaw /home/openclaw/.openclaw/workspace \
  /home/openclaw/.config/openclaw /home/openclaw/.npm
chown root:openclaw /etc/gymflow/secrets
chmod 0750 /etc/gymflow/secrets
chown root:openclaw /etc/gymflow/secrets/telegram-bot-token
chmod 0640 /etc/gymflow/secrets/telegram-bot-token

installer=$(mktemp /tmp/openclaw-install.XXXXXX.sh)
trap 'rm -f "${installer}"' EXIT
curl --fail --silent --show-error --location \
  --proto '=https' --tlsv1.2 https://openclaw.ai/install-cli.sh -o "${installer}"
sha256sum "${installer}" | tee -a /var/log/gymflow/openclaw-installer-sha256.log
chmod 0755 "${installer}"

runuser -u openclaw -- env HOME=/home/openclaw \
  bash "${installer}" \
  --prefix /home/openclaw/.local/openclaw \
  --version "${OPENCLAW_VERSION}" \
  --no-onboard

OPENCLAW=/home/openclaw/.local/openclaw/bin/openclaw
run_oc() { runuser -u openclaw -- env HOME=/home/openclaw "${OPENCLAW}" "$@"; }

install -o root -g openclaw -m 0640 \
  "$(dirname "${BASH_SOURCE[0]}")/../openclaw/AGENTS.md" /home/openclaw/.openclaw/workspace/AGENTS.md
install -o root -g openclaw -m 0640 \
  "$(dirname "${BASH_SOURCE[0]}")/../openclaw/SOUL.md" /home/openclaw/.openclaw/workspace/SOUL.md
install -o root -g openclaw -m 0640 \
  "$(dirname "${BASH_SOURCE[0]}")/../openclaw/HEARTBEAT.md" /home/openclaw/.openclaw/workspace/HEARTBEAT.md
install -d -o openclaw -g openclaw -m 0755 /home/openclaw/.local/bin
install -o root -g openclaw -m 0755 \
  "$(dirname "${BASH_SOURCE[0]}")/gymflow-dev.sh" /home/openclaw/.local/bin/gymflow-dev

run_oc config set gateway.mode '"local"'
run_oc config set gateway.bind '"loopback"'
run_oc config set channels.telegram.enabled true
run_oc config set channels.telegram.tokenFile '"/etc/gymflow/secrets/telegram-bot-token"'
run_oc config set channels.telegram.dmPolicy '"allowlist"'
run_oc config set channels.telegram.allowFrom "[\"${TELEGRAM_USER_ID}\"]"
run_oc config set channels.telegram.groupPolicy '"disabled"'
run_oc config set channels.telegram.customCommands '[{"command":"gymstatus","description":"Production and monitoring status"},{"command":"gymstart","description":"Start a feature branch"},{"command":"gymtest","description":"Test the current feature branch"},{"command":"gympublish","description":"Open a feature PR to staging"},{"command":"gymstage","description":"Approve a feature PR for GitHub Pages"},{"command":"gympromote","description":"Open staging to main PR"},{"command":"gymrelease","description":"Approve main merge and GCP release"},{"command":"gymlogs","description":"Bounded production logs"},{"command":"gymaudit","description":"Run the security audit"}]'
run_oc config set session.dmScope '"per-channel-peer"'
run_oc config set agents.defaults.model.primary '"openai/gpt-5.5"'
# A loopback listener still needs authentication in case a local reverse proxy is
# added later. Doctor creates and stores a random gateway token without exposing it.
run_oc doctor --generate-gateway-token
run_oc plugins install @openclaw/codex --force --pin
run_oc config set plugins.entries.codex.enabled true
run_oc config set plugins.allow '["codex"]'
run_oc config set logging.redactSensitive '"tools"'
run_oc config set tools.elevated.enabled false
run_oc config set browser.enabled false
run_oc config set tools.exec.host '"gateway"'
run_oc config set tools.exec.strictInlineEval true
# OpenClaw rejects tools.exec.mode when the explicit security/ask policy below is present.
# Remove it so rerunning after an older partial install is safe as well.
run_oc config unset tools.exec.mode >/dev/null 2>&1 || true
run_oc exec-policy set --host gateway --security allowlist --ask on-miss --ask-fallback deny
run_oc approvals allowlist add --agent main "/usr/local/bin/gymflow-status"
run_oc approvals allowlist add --agent main "/home/openclaw/.local/bin/gymflow-dev"
run_oc approvals allowlist add --agent main "/usr/local/bin/gymflow-prod"
run_oc config validate
run_oc security audit --fix

install -m 0644 "$(dirname "${BASH_SOURCE[0]}")/../systemd/openclaw.service" /etc/systemd/system/openclaw.service
systemctl daemon-reload

cat <<'EOF'
OpenClaw is installed and locked to Telegram allowlist mode.

Finish the one-time Codex sign-in as the isolated openclaw user:
  sudo -u openclaw -H /home/openclaw/.local/openclaw/bin/openclaw models auth login --provider openai --device-code

Then enable the gateway:
  sudo systemctl enable --now openclaw.service
  sudo -u openclaw -H /home/openclaw/.local/openclaw/bin/openclaw models list --provider openai
  sudo -u openclaw -H /home/openclaw/.local/openclaw/bin/openclaw security audit --deep

The Control UI remains bound to loopback. Use an SSH tunnel if it is needed; never open port 18789 publicly.
EOF
