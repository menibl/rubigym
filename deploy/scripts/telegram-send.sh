#!/usr/bin/env bash
set -Eeuo pipefail

ENV_FILE=${GYMFLOW_MONITOR_ENV:-/etc/gymflow/monitor.env}
[[ -r ${ENV_FILE} ]] || { echo "Missing ${ENV_FILE}" >&2; exit 1; }
# shellcheck disable=SC1090
source "${ENV_FILE}"

TITLE=${1:-GymFlow alert}
MESSAGE=${2:-No details provided}
TOKEN=$(<"${TELEGRAM_BOT_TOKEN_FILE}")

PAYLOAD=$(jq -n \
  --arg chat_id "${TELEGRAM_CHAT_ID}" \
  --arg text "${TITLE}"$'\n'"${MESSAGE}" \
  '{chat_id:$chat_id,text:$text,disable_web_page_preview:true}')

curl --fail --silent --show-error \
  --connect-timeout 5 --max-time 15 \
  -H 'Content-Type: application/json' \
  -d "${PAYLOAD}" \
  "https://api.telegram.org/bot${TOKEN}/sendMessage" >/dev/null
