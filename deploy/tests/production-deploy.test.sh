#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(realpath "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)")
SOURCE=${ROOT_DIR}/deploy/scripts/production-deploy.sh

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
