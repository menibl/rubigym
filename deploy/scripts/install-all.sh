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
read -rp "Marketing landing subdomain (for example join.example.com): " LANDING_DOMAIN
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
read -rsp "Pulseem API key (leave empty to configure later): " PULSEEM_API_KEY; echo
read -rp "Pulseem approved sender number/name (leave empty to configure later): " PULSEEM_FROM_NUMBER
read -rsp "Initial password for Ruby Bali manager (minimum 8 characters): " INITIAL_ADMIN_PASSWORD; echo
if [[ ${#INITIAL_ADMIN_PASSWORD} -lt 8 ]]; then echo "Initial manager password must contain at least 8 characters." >&2; exit 1; fi
read -rsp "RIVHIT iCredit Group Private Token (leave empty to configure later): " RIVHIT_GROUP_PRIVATE_TOKEN; echo

[[ ${APP_DOMAIN} =~ ^[A-Za-z0-9.-]+$ ]] || { echo "Invalid domain." >&2; exit 2; }
[[ ${LANDING_DOMAIN} =~ ^[A-Za-z0-9.-]+$ ]] || { echo "Invalid landing domain." >&2; exit 2; }
[[ ${LANDING_DOMAIN,,} != ${APP_DOMAIN,,} ]] || { echo "Landing domain must differ from the app domain." >&2; exit 2; }
[[ ${ACME_EMAIL} == *@* ]] || { echo "Invalid email." >&2; exit 2; }
[[ ${TELEGRAM_USER_ID} =~ ^[0-9]+$ ]] || { echo "Telegram user ID must be numeric." >&2; exit 2; }
[[ ${TELEGRAM_CHAT_ID} =~ ^-?[0-9]+$ ]] || { echo "Telegram chat ID must be numeric." >&2; exit 2; }
[[ ${#TELEGRAM_BOT_TOKEN} -ge 20 ]] || { echo "Telegram token is too short." >&2; exit 2; }

PAYMENT_SIGNING_SECRET=$(openssl rand -hex 48)
SMS_OTP_SIGNING_SECRET=$(openssl rand -hex 48)
POSTGRES_PASSWORD=$(openssl rand -hex 32)
SMS_TEST_MODE=false

bash "${DEPLOY_DIR}/scripts/bootstrap-server.sh" "${ADMIN_USER}"
install -d -m 0750 /etc/gymflow/secrets /var/log/gymflow /var/lib/gymflow-deploy /var/backups/gymflow
umask 077
printf '%s' "${TELEGRAM_BOT_TOKEN}" >/etc/gymflow/secrets/telegram-bot-token

cat >/etc/gymflow/production.env <<EOF
APP_DOMAIN=${APP_DOMAIN}
LANDING_DOMAIN=${LANDING_DOMAIN}
ACME_EMAIL=${ACME_EMAIL}
OPENAI_API_KEY=${OPENAI_API_KEY}
INITIAL_ADMIN_PASSWORD=${INITIAL_ADMIN_PASSWORD}
INITIAL_ADMIN_EMAIL=robi@rubisgym.co.il
INITIAL_ADMIN_PHONE=054-6995885
PULSEEM_API_KEY=${PULSEEM_API_KEY}
PULSEEM_FROM_NUMBER=${PULSEEM_FROM_NUMBER}
PULSEEM_PHONE_FORMAT=local
PULSEEM_TIMEOUT_MS=10000
SMS_OTP_SIGNING_SECRET=${SMS_OTP_SIGNING_SECRET}
SMS_OTP_TTL_SECONDS=300
SMS_OTP_MAX_ATTEMPTS=5
SMS_OTP_REQUESTS_PER_HOUR=5
SMS_OTP_COOLDOWN_SECONDS=60
SMS_PHONE_VERIFICATION_TTL_SECONDS=7200
SMS_TEST_MODE=${SMS_TEST_MODE}
OPENAI_WORKOUT_MODEL=gpt-5.4-mini
OPENAI_WORKOUT_MAX_OUTPUT_TOKENS=12000
AI_REQUESTS_PER_HOUR=30
AI_ALLOWED_ORIGIN=https://${APP_DOMAIN},${STAGING_ORIGIN}
VITE_AI_API_URL=https://${APP_DOMAIN}
RIVHIT_ENVIRONMENT=test
RIVHIT_GROUP_PRIVATE_TOKEN=${RIVHIT_GROUP_PRIVATE_TOKEN}
RIVHIT_ENABLE_RECURRING=false
RIVHIT_USE_3DS=false
PAYMENT_SIGNING_SECRET=${PAYMENT_SIGNING_SECRET}
PUBLIC_APP_URL=https://${APP_DOMAIN}/
PAYMENT_STAGING_APP_URL=https://menibl.github.io/rubigym/
PUBLIC_LANDING_URL=https://${LANDING_DOMAIN}/
PAYMENT_ALLOWED_ORIGIN=https://${APP_DOMAIN},${STAGING_ORIGIN}
VITE_PAYMENT_API_URL=https://${APP_DOMAIN}
MAX_REQUEST_BODY_BYTES=16777216
DATABASE_URL=postgresql://gymflow:${POSTGRES_PASSWORD}@postgres:5432/gymflow
DATABASE_SSL=false
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
CLUB_ID=baly-wellness
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
install -o root -g openclaw -m 0755 "${DEPLOY_DIR}/scripts/gymflow-dev.sh" /home/openclaw/.local/bin/gymflow-dev
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
