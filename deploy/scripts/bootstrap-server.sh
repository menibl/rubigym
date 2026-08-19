#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root: sudo $0 <ssh-admin-user>" >&2
  exit 1
fi

ADMIN_USER=${1:-}
if [[ -z ${ADMIN_USER} ]] || ! id "${ADMIN_USER}" >/dev/null 2>&1; then
  echo "A valid existing SSH administrator user is required." >&2
  exit 1
fi

ADMIN_HOME=$(getent passwd "${ADMIN_USER}" | cut -d: -f6)
if [[ ! -s "${ADMIN_HOME}/.ssh/authorized_keys" ]]; then
  echo "Refusing to disable password SSH: ${ADMIN_USER} has no authorized_keys." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates curl docker.io fail2ban gh git jq openssl rsync ufw unattended-upgrades

if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y docker-compose-v2 || apt-get install -y docker-compose-plugin
fi

systemctl enable --now docker fail2ban unattended-upgrades
usermod -aG docker "${ADMIN_USER}"

install -d -m 0750 /etc/gymflow/secrets /var/lib/gymflow-monitor /var/log/gymflow /opt/gymflow

cat >/etc/ssh/sshd_config.d/99-gymflow-hardening.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowAgentForwarding no
PermitEmptyPasswords no
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

sshd -t
systemctl reload ssh

cat >/etc/fail2ban/jail.d/gymflow.local <<'EOF'
[sshd]
enabled = true
backend = systemd
bantime = 1h
findtime = 10m
maxretry = 5
EOF
systemctl restart fail2ban

cat >/etc/sysctl.d/99-gymflow-hardening.conf <<'EOF'
kernel.kptr_restrict=2
kernel.dmesg_restrict=1
kernel.unprivileged_bpf_disabled=1
fs.protected_hardlinks=1
fs.protected_symlinks=1
net.ipv4.conf.all.accept_redirects=0
net.ipv4.conf.default.accept_redirects=0
net.ipv4.conf.all.send_redirects=0
net.ipv4.conf.default.send_redirects=0
net.ipv4.conf.all.rp_filter=1
net.ipv4.conf.default.rp_filter=1
net.ipv4.tcp_syncookies=1
net.ipv6.conf.all.accept_redirects=0
net.ipv6.conf.default.accept_redirects=0
EOF
sysctl --system >/dev/null

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

dpkg-reconfigure -f noninteractive unattended-upgrades

echo "Server bootstrap complete. Reconnect before closing this SSH session to verify key access."
echo "The docker group change takes effect on the administrator's next login."
