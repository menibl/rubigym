#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(realpath "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)")
SOURCE=${ROOT_DIR}/deploy/scripts/production-deploy.sh

grep -Fq 'DOCKER_CONFIG=${PRODUCTION_STATE}/docker' "${SOURCE}"
grep -Fq 'COMPOSE_BAKE=false' "${SOURCE}"
grep -Fq 'export DOCKER_CONFIG COMPOSE_BAKE' "${SOURCE}"
grep -Fq 'install -d -m 0700 "${DOCKER_CONFIG}"' "${SOURCE}"
grep -Fq 'your-production-domain' "${SOURCE}"
grep -Fq 'YOUR_DOMAIN' "${SOURCE}"

already_current_block=$(awk '
  /^if \[\[ \$\{target\} == "\$\{current\}" \]\]; then/ { capture=1 }
  capture { print }
  capture && /^fi$/ { exit }
' "${SOURCE}")

grep -Fq 'prepare_release "${target}"' <<<"${already_current_block}"
grep -Fq 'install_release_operations "${target}"' <<<"${already_current_block}"

function_source=$(awk '
  /^backup_database\(\)/ { capture=1 }
  capture { print }
  capture && /^}/ { exit }
' "${SOURCE}")

[[ -n ${function_source} ]] || {
  echo "Could not extract backup_database from ${SOURCE}." >&2
  exit 1
}

bash -Eeuo pipefail -c "
PRODUCTION_BACKUPS=/tmp
compose_for() { return 1; }
${function_source}
backup_database 0123456789abcdef
"

echo "production-deploy strict-mode regression test passed."
