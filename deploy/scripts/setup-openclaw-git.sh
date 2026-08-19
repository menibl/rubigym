#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root: sudo $0 [git-repository-url]" >&2
  exit 1
fi

REPOSITORY_URL=${1:-git@github.com:menibl/rubigym.git}
SSH_DIR=/home/openclaw/.ssh
KEY=${SSH_DIR}/gymflow_deploy
WORKTREE=/home/openclaw/.openclaw/workspace/gymflow-management

install -d -o openclaw -g openclaw -m 0700 "${SSH_DIR}"
if [[ ! -f ${KEY} ]]; then
  runuser -u openclaw -- ssh-keygen -q -t ed25519 -N '' -C "openclaw@$(hostname)-gymflow" -f "${KEY}"
fi

curl --fail --silent --show-error --location https://api.github.com/meta \
  | jq -r '.ssh_keys[]' \
  | sed 's/^/github.com /' >"${SSH_DIR}/known_hosts"
chown openclaw:openclaw "${SSH_DIR}/known_hosts"
chmod 0600 "${SSH_DIR}/known_hosts"

cat >"${SSH_DIR}/config" <<EOF
Host github.com
  HostName github.com
  User git
  IdentityFile ${KEY}
  IdentitiesOnly yes
  StrictHostKeyChecking yes
EOF
chown openclaw:openclaw "${SSH_DIR}/config"
chmod 0600 "${SSH_DIR}/config"

echo "Add this key to GitHub as a repository deploy key. Enable write access only if OpenClaw must push reviewed changes:"
cat "${KEY}.pub"
echo
echo "After registering the key, run:"
echo "  sudo -u openclaw -H git clone '${REPOSITORY_URL}' '${WORKTREE}'"
