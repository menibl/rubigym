#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root: sudo $0 [deploy-directory]" >&2
  exit 1
fi

DEPLOY_DIR=$(realpath "${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}")
install -d -m 0755 /usr/local/lib/gymflow-deploy
install -m 0755 "${DEPLOY_DIR}/scripts/production-deploy.sh" /usr/local/lib/gymflow-deploy/
install -m 0755 "${DEPLOY_DIR}/scripts/daily-management.sh" /usr/local/lib/gymflow-deploy/
install -m 0755 "${DEPLOY_DIR}/scripts/gymflow-ops" /usr/local/sbin/gymflow-ops
install -o root -g openclaw -m 0755 "${DEPLOY_DIR}/scripts/gymflow-prod" /usr/local/bin/gymflow-prod

cat >/etc/sudoers.d/openclaw-gymflow <<'EOF'
Defaults:openclaw !requiretty
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/gymflow-ops status
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/gymflow-ops logs
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/gymflow-ops deploy-main
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/gymflow-ops rollback
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/gymflow-ops restart-app
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/gymflow-ops security-audit
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/gymflow-ops daily
EOF
chmod 0440 /etc/sudoers.d/openclaw-gymflow
visudo -cf /etc/sudoers.d/openclaw-gymflow

if id -nG openclaw | tr ' ' '\n' | grep -qx docker; then
  echo "Refusing insecure configuration: removing openclaw from the docker group."
  gpasswd -d openclaw docker || true
fi

echo "OpenClaw received constrained Docker operations through /usr/local/sbin/gymflow-ops."
echo "It was not added to the docker group, because docker group membership is root-equivalent."
