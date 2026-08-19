#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root: sudo $0 [deploy-directory]" >&2
  exit 1
fi

DEPLOY_DIR=$(realpath "${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}")
for required in /etc/gymflow/production.conf /etc/gymflow/production.env; do
  [[ -s ${required} ]] || { echo "Missing ${required}" >&2; exit 1; }
  chmod 0600 "${required}"
done

# shellcheck disable=SC1091
source /etc/gymflow/production.conf
git ls-remote --exit-code "${PRODUCTION_GIT_URL}" "refs/heads/${PRODUCTION_BRANCH:-main}" >/dev/null

install -d -m 0755 /usr/local/lib/gymflow-deploy
install -m 0755 "${DEPLOY_DIR}/scripts/production-deploy.sh" /usr/local/lib/gymflow-deploy/
install -m 0755 "${DEPLOY_DIR}/scripts/daily-management.sh" /usr/local/lib/gymflow-deploy/
install -m 0755 "${DEPLOY_DIR}/scripts/gymflow-ops" /usr/local/sbin/gymflow-ops
install -m 0644 "${DEPLOY_DIR}/systemd/gymflow-production-deploy.service" /etc/systemd/system/
install -m 0644 "${DEPLOY_DIR}/systemd/gymflow-production-deploy.timer" /etc/systemd/system/
install -m 0644 "${DEPLOY_DIR}/systemd/gymflow-daily-management.service" /etc/systemd/system/
install -m 0644 "${DEPLOY_DIR}/systemd/gymflow-daily-management.timer" /etc/systemd/system/

systemctl daemon-reload
/usr/local/lib/gymflow-deploy/production-deploy.sh deploy
systemctl enable --now gymflow-production-deploy.timer gymflow-daily-management.timer
systemctl list-timers gymflow-production-deploy.timer gymflow-daily-management.timer --no-pager
