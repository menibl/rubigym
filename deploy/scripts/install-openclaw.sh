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
  /home/openclaw/.openclaw /home/openclaw/.openclaw/workspace /home/openclaw/.config/openclaw
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

install -o openclaw -g openclaw -m 0600 \
  "$(dirname "${BASH_SOURCE[0]}")/../openclaw/AGENTS.md" /home/openclaw/.openclaw/workspace/AGENTS.md
install -o openclaw -g openclaw -m 0600 \
  "$(dirname "${BASH_SOURCE[0]}")/../openclaw/SOUL.md" /home/openclaw/.openclaw/workspace/SOUL.md
install -o openclaw -g openclaw -m 0600 \
  "$(dirname "${BASH_SOURCE[0]}")/../openclaw/HEARTBEAT.md" /home/openclaw/.openclaw/workspace/HEARTBEAT.md
install -d -o openclaw -g openclaw -m 0755 /home/openclaw/.local/bin
install -o openclaw -g openclaw -m 0755 \
  "$(dirname "${BASH_SOURCE[0]}")/gymflow-dev.sh" /home/openclaw/.local/bin/gymflow-dev

run_oc config set gateway.mode '"local"'
run_oc config set gateway.bind '"loopback"'
run_oc config set channels.telegram.enabled true
run_oc config set channels.telegram.tokenFile '"/etc/gymflow/secrets/telegram-bot-token"'
run_oc config set channels.telegram.dmPolicy '"allowlist"'
run_oc config set channels.telegram.allowFrom "[\"${TELEGRAM_USER_ID}\"]"
run_oc config set channels.telegram.groupPolicy '"disabled"'
run_oc config set channels.telegram.customCommands '[{"command":"gymstatus","description":"GymFlow production and monitoring status"},{"command":"gymtest","description":"Run checks for the current feature branch"},{"command":"gympublish","description":"Prepare a feature PR for staging"},{"command":"gympromote","description":"Prepare a staging to main PR"},{"command":"gymrollback","description":"Request a production rollback"}]'
run_oc config set session.dmScope '"per-channel-peer"'
run_oc config set agents.defaults.model.primary '"openai/gpt-5.6-sol"'
run_oc config set plugins.entries.codex.enabled true
run_oc config set logging.redactSensitive '"tools"'
run_oc config set tools.exec.host '"gateway"'
run_oc config set tools.exec.mode '"ask"'
run_oc config set tools.exec.strictInlineEval true
run_oc exec-policy set --host gateway --security allowlist --ask on-miss --ask-fallback deny
run_oc approvals allowlist add --agent main "/usr/local/bin/gymflow-status"
run_oc approvals allowlist add --agent main "/home/openclaw/.local/bin/gymflow-dev"
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
