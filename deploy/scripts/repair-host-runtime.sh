#!/usr/bin/env bash
set -Eeuo pipefail

# One-time operator-approved bootstrap for hosts whose old gymflow-ops cannot
# refresh itself. Use only AFTER main was deployed. Never uses a local worktree.
[[ ${EUID} -eq 0 ]] || { echo "This one-time repair requires explicit root operator approval." >&2; exit 1; }
sha=$(</var/lib/gymflow-deploy/current-sha)
[[ ${sha} =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid current release SHA." >&2; exit 1; }
release=/opt/gymflow/releases/${sha}
for source in production-deploy.sh daily-management.sh gymflow-ops refresh-server-runtime.sh; do
  [[ -f ${release}/deploy/scripts/${source} ]] || { echo "Current deployed release is missing ${source}." >&2; exit 1; }
done
# Refresh service sandbox and monitor first; install the new operation interface
# only after resource limits were successfully applied. No application restart.
bash "${release}/deploy/scripts/refresh-server-runtime.sh" "${release}/deploy"
install -m 0755 "${release}/deploy/scripts/production-deploy.sh" /usr/local/lib/gymflow-deploy/production-deploy.sh
install -m 0755 "${release}/deploy/scripts/daily-management.sh" /usr/local/lib/gymflow-deploy/daily-management.sh
install -m 0755 "${release}/deploy/scripts/gymflow-ops" /usr/local/sbin/gymflow-ops
echo "Host runtime repaired from deployed commit ${sha}; future operations use gymflow-ops."
