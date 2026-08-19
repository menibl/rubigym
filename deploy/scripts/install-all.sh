#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run from the cloned repository: sudo bash deploy/scripts/install-all.sh <ssh-admin-user>" >&2
  exit 1
fi

ADMIN_USER=${1:-${SUDO_USER:-}}
[[ -n ${ADMIN_USER} ]] || { echo "SSH administrator user is required." >&2; exit 2; }
ROOT_DIR=$(realpath "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)")
DEPLOY_DIR=${ROOT_DIR}/deploy
[[ -f ${ROOT_DIR}/package.json ]] || { echo "Run from the GymFlow repository." >&2; exit 1; }

read -rp "Production domain (for example gym.example.com): " APP_DOMAIN
read -rp "ACME email: " ACME_EMAIL
read -rp "Git repository URL [https://github.com/menibl/rubigym.git]: " PRODUCTION_GIT_URL
PRODUCTION_GIT_URL=${PRODUCTION_GIT_URL:-https://github.com/menibl/rubigym.git}
REPO_SLUG=$(printf '%s' "${PRODUCTION_GIT_URL}" | sed -E 's#^https://github\.com/##; s#^git@github\.com:##; s#\.git$##')
[[ ${REPO_SLUG} =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || {
  echo "The one-shot installer currently supports GitHub repository URLs." >&2
  exit 2
}
read -rp "GitHub Pages origin [https://menibl.github.io]: " STAGING_ORIGIN
STAGING_ORIGIN=${STAGING_ORIGIN:-https://menibl.github.io}
read -rp "Numeric Telegram user ID: " TELEGRAM_USER_ID
read -rp "Telegram chat ID: " TELEGRAM_CHAT_ID
read -rsp "Telegram bot token: " TELEGRAM_BOT_TOKEN; echo
read -rsp "OpenAI API key for the workout assistant (leave empty to configure later): " OPENAI_API_KEY; echo
read -rp "Use Cardcom demo mode for the first deployment? [Y/n]: " DEMO_CHOICE
DEMO_PAYMENT_MODE=true
if [[ ${DEMO_CHOICE,,} == n || ${DEMO_CHOICE,,} == no ]]; then DEMO_PAYMENT_MODE=false; fi

CARDCOM_TERMINAL_NUMBER=
CARDCOM_API_NAME=
CARDCOM_API_PASSWORD=
if [[ ${DEMO_PAYMENT_MODE} == false ]]; then
  read -rp "Cardcom terminal number: " CARDCOM_TERMINAL_NUMBER
  read -rp "Cardcom API name: " CARDCOM_API_NAME
  read -rsp "Cardcom API password: " CARDCOM_API_PASSWORD; echo
fi

[[ ${APP_DOMAIN} =~ ^[A-Za-z0-9.-]+$ ]] || { echo "Invalid domain." >&2; exit 2; }
[[ ${ACME_EMAIL} == *@* ]] || { echo "Invalid email." >&2; exit 2; }
[[ ${TELEGRAM_USER_ID} =~ ^[0-9]+$ ]] || { echo "Telegram user ID must be numeric." >&2; exit 2; }
[[ ${TELEGRAM_CHAT_ID} =~ ^-?[0-9]+$ ]] || { echo "Telegram chat ID must be numeric." >&2; exit 2; }
[[ ${#TELEGRAM_BOT_TOKEN} -ge 20 ]] || { echo "Telegram token is too short." >&2; exit 2; }

PAYMENT_SIGNING_SECRET=$(openssl rand -hex 48)
STATE_SYNC_TOKEN=$(openssl rand -hex 48)
POSTGRES_PASSWORD=$(openssl rand -hex 32)

bash "${DEPLOY_DIR}/scripts/bootstrap-server.sh" "${ADMIN_USER}"
install -d -m 0750 /etc/gymflow/secrets /var/log/gymflow /var/lib/gymflow-deploy /var/backups/gymflow
umask 077
printf '%s' "${TELEGRAM_BOT_TOKEN}" >/etc/gymflow/secrets/telegram-bot-token

cat >/etc/gymflow/production.env <<EOF
APP_DOMAIN=${APP_DOMAIN}
ACME_EMAIL=${ACME_EMAIL}
OPENAI_API_KEY=${OPENAI_API_KEY}
OPENAI_WORKOUT_MODEL=gpt-5.4-mini
OPENAI_WORKOUT_MAX_OUTPUT_TOKENS=12000
AI_REQUESTS_PER_HOUR=30
AI_ALLOWED_ORIGIN=https://${APP_DOMAIN},${STAGING_ORIGIN}
VITE_AI_API_URL=https://${APP_DOMAIN}
CARDCOM_TERMINAL_NUMBER=${CARDCOM_TERMINAL_NUMBER}
CARDCOM_API_NAME=${CARDCOM_API_NAME}
CARDCOM_API_PASSWORD=${CARDCOM_API_PASSWORD}
DEMO_PAYMENT_MODE=${DEMO_PAYMENT_MODE}
PAYMENT_SIGNING_SECRET=${PAYMENT_SIGNING_SECRET}
PUBLIC_APP_URL=https://${APP_DOMAIN}/
PAYMENT_ALLOWED_ORIGIN=https://${APP_DOMAIN},${STAGING_ORIGIN}
VITE_PAYMENT_API_URL=https://${APP_DOMAIN}
MAX_REQUEST_BODY_BYTES=1048576
DATABASE_URL=postgresql://gymflow:${POSTGRES_PASSWORD}@postgres:5432/gymflow
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
CLUB_ID=baly-wellness
STATE_SYNC_TOKEN=${STATE_SYNC_TOKEN}
GYMFLOW_ENV_FILE=/etc/gymflow/production.env
EOF

cat >/etc/gymflow/production.conf <<EOF
PRODUCTION_GIT_URL=${PRODUCTION_GIT_URL}
PRODUCTION_BRANCH=main
PRODUCTION_HEALTH_URL=https://${APP_DOMAIN}/healthz
PRODUCTION_ENV_FILE=/etc/gymflow/production.env
PRODUCTION_MIRROR=/opt/gymflow/repository.git
PRODUCTION_RELEASES=/opt/gymflow/releases
PRODUCTION_STATE=/var/lib/gymflow-deploy
PRODUCTION_BACKUPS=/var/backups/gymflow
KEEP_RELEASES=7
HEALTH_RETRIES=36
HEALTH_INTERVAL_SECONDS=5
EOF

cat >/etc/gymflow/monitor.env <<EOF
TELEGRAM_BOT_TOKEN_FILE=/etc/gymflow/secrets/telegram-bot-token
TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
APP_HEALTH_URL=https://${APP_DOMAIN}/healthz
DISK_WARN_PERCENT=85
MEMORY_WARN_PERCENT=90
LOAD_WARN_PER_CPU=2
ALERT_AFTER_FAILURES=2
EOF
chmod 0600 /etc/gymflow/production.env /etc/gymflow/production.conf /etc/gymflow/monitor.env /etc/gymflow/secrets/telegram-bot-token

bash "${DEPLOY_DIR}/scripts/install-openclaw.sh" "${TELEGRAM_USER_ID}" latest
install -o openclaw -g openclaw -m 0755 "${DEPLOY_DIR}/scripts/gymflow-dev.sh" /home/openclaw/.local/bin/gymflow-dev
bash "${DEPLOY_DIR}/scripts/install-monitoring.sh" "${DEPLOY_DIR}"
bash "${DEPLOY_DIR}/scripts/install-production-automation.sh" "${DEPLOY_DIR}"
bash "${DEPLOY_DIR}/scripts/grant-openclaw-docker-access.sh" "${DEPLOY_DIR}"

cat <<EOF

Base installation completed.

Required one-time steps:
1. Codex login:
   sudo -u openclaw -H /home/openclaw/.local/openclaw/bin/openclaw models auth login --provider openai --device-code
2. GitHub login with a fine-grained token (Contents RW, Pull requests RW, Actions read):
   sudo -u openclaw -H gh auth login --hostname github.com --git-protocol https
3. Clone the development worktree and configure identity:
   sudo -u openclaw -H gh repo clone ${REPO_SLUG} /home/openclaw/.openclaw/workspace/gymflow-management
   sudo -u openclaw -H git -C /home/openclaw/.openclaw/workspace/gymflow-management config user.name "GymFlow OpenClaw"
   sudo -u openclaw -H git -C /home/openclaw/.openclaw/workspace/gymflow-management config user.email "openclaw@${APP_DOMAIN}"
4. Start OpenClaw after authentication:
   systemctl enable --now openclaw.service
5. Configure branch protections once with a GitHub repository-admin login:
   bash ${DEPLOY_DIR}/scripts/configure-github-repository.sh ${REPO_SLUG}

Do not open port 18789 and do not add openclaw to the docker group.
EOF
