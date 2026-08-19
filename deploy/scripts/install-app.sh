#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root: sudo $0 [repository-root]" >&2
  exit 1
fi

SOURCE_DIR=$(realpath "${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}")
TARGET_DIR=/opt/gymflow

if [[ ! -f "${SOURCE_DIR}/package.json" || ! -f "${SOURCE_DIR}/deploy/compose.yaml" ]]; then
  echo "Source directory does not look like the GymFlow repository: ${SOURCE_DIR}" >&2
  exit 1
fi

if [[ ! -f "${SOURCE_DIR}/deploy/.env" ]]; then
  echo "Create ${SOURCE_DIR}/deploy/.env from .env.example before deployment." >&2
  exit 1
fi
chmod 600 "${SOURCE_DIR}/deploy/.env"

install -d -m 0750 "${TARGET_DIR}"
rsync -a --delete \
  --exclude '.git' --exclude 'node_modules' --exclude 'dist' --exclude '*.log' \
  "${SOURCE_DIR}/" "${TARGET_DIR}/"
chmod 600 "${TARGET_DIR}/deploy/.env"

cd "${TARGET_DIR}/deploy"
docker compose build --pull
docker compose up -d --remove-orphans
docker compose ps

for _ in {1..30}; do
  if docker compose exec -T app node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    echo "GymFlow is healthy."
    exit 0
  fi
  sleep 2
done

echo "GymFlow did not become healthy in time." >&2
docker compose logs --tail=100 app caddy >&2
exit 1
