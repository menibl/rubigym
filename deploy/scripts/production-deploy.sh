#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "This command must run as root." >&2
  exit 1
fi

CONFIG_FILE=${GYMFLOW_PRODUCTION_CONFIG:-/etc/gymflow/production.conf}
[[ -r ${CONFIG_FILE} ]] || { echo "Missing ${CONFIG_FILE}" >&2; exit 1; }
# shellcheck disable=SC1090
source "${CONFIG_FILE}"

: "${PRODUCTION_GIT_URL:?Missing PRODUCTION_GIT_URL}"
: "${PRODUCTION_BRANCH:=main}"
: "${PRODUCTION_HEALTH_URL:?Missing PRODUCTION_HEALTH_URL}"
: "${PRODUCTION_ENV_FILE:=/etc/gymflow/production.env}"
: "${PRODUCTION_MIRROR:=/opt/gymflow/repository.git}"
: "${PRODUCTION_RELEASES:=/opt/gymflow/releases}"
: "${PRODUCTION_STATE:=/var/lib/gymflow-deploy}"
: "${PRODUCTION_BACKUPS:=/var/backups/gymflow}"
: "${KEEP_RELEASES:=7}"
: "${HEALTH_RETRIES:=36}"
: "${HEALTH_INTERVAL_SECONDS:=5}"

# The production service deliberately hides /root with ProtectHome=true.
# Keep Docker client state in the deployment state directory instead of
# allowing Docker Compose to fall back to the read-only /root/.docker path.
DOCKER_CONFIG=${PRODUCTION_STATE}/docker
COMPOSE_BAKE=false
export DOCKER_CONFIG COMPOSE_BAKE

[[ -r ${PRODUCTION_ENV_FILE} ]] || { echo "Missing ${PRODUCTION_ENV_FILE}" >&2; exit 1; }
if grep -Eiq 'CHANGE_ME|replace-with|example\.com|your-production-domain|YOUR_DOMAIN' "${PRODUCTION_ENV_FILE}"; then
  echo "Production environment still contains placeholder values." >&2
  exit 1
fi

install -d -m 0750 "${PRODUCTION_RELEASES}" "${PRODUCTION_STATE}" "${PRODUCTION_BACKUPS}"
install -d -m 0700 "${DOCKER_CONFIG}"
exec 9>/run/lock/gymflow-production.lock
flock -n 9 || { echo "Another GymFlow deployment is already running." >&2; exit 75; }

CURRENT_FILE=${PRODUCTION_STATE}/current-sha
PREVIOUS_FILE=${PRODUCTION_STATE}/previous-sha
SEND=/usr/local/lib/gymflow-monitor/telegram-send.sh

notify() {
  if [[ -x ${SEND} ]]; then "${SEND}" "$1" "$2" || true; fi
}

read_state() {
  if [[ -r $1 ]]; then cat "$1"; fi
}

ensure_mirror() {
  if [[ ! -d ${PRODUCTION_MIRROR} ]]; then
    git clone --mirror "${PRODUCTION_GIT_URL}" "${PRODUCTION_MIRROR}"
  fi
  git --git-dir="${PRODUCTION_MIRROR}" remote set-url origin "${PRODUCTION_GIT_URL}"
  git --git-dir="${PRODUCTION_MIRROR}" fetch --prune origin \
    "+refs/heads/${PRODUCTION_BRANCH}:refs/remotes/origin/${PRODUCTION_BRANCH}"
}

release_path() { printf '%s/%s' "${PRODUCTION_RELEASES}" "$1"; }

prepare_release() {
  local sha=$1 target
  target=$(release_path "${sha}")
  if [[ ! -f ${target}/deploy/compose.yaml ]]; then
    install -d -m 0750 "${target}"
    git --git-dir="${PRODUCTION_MIRROR}" archive "${sha}" | tar -x -C "${target}"
  fi
  [[ -f ${target}/Dockerfile && -f ${target}/deploy/compose.yaml ]] || {
    echo "Commit ${sha} does not contain production deployment files." >&2
    return 1
  }
}

compose_for() {
  local sha=$1
  shift
  GYMFLOW_IMAGE="gymflow:${sha}" \
  GYMFLOW_ENV_FILE="${PRODUCTION_ENV_FILE}" \
    docker compose --project-name gymflow \
      --env-file "${PRODUCTION_ENV_FILE}" \
      -f "$(release_path "${sha}")/deploy/compose.yaml" "$@"
}

wait_for_health() {
  local attempt
  for ((attempt=1; attempt<=HEALTH_RETRIES; attempt++)); do
    if curl --fail --silent --show-error --connect-timeout 5 --max-time 15 \
      "${PRODUCTION_HEALTH_URL}" >/dev/null; then
      return 0
    fi
    sleep "${HEALTH_INTERVAL_SECONDS}"
  done
  return 1
}

backup_database() {
  local sha=$1
  local backup=${PRODUCTION_BACKUPS}/pre-deploy-${sha}-$(date -u +%Y%m%dT%H%M%SZ).sql.gz
  if compose_for "${sha}" ps --status running postgres 2>/dev/null | grep -q postgres; then
    compose_for "${sha}" exec -T postgres pg_dump -U gymflow gymflow | gzip -9 >"${backup}"
    chmod 0600 "${backup}"
  fi
}

activate_release() {
  local sha=$1 target attempt build_ok=false
  target=$(release_path "${sha}")
  prepare_release "${sha}"
  if ! docker image inspect "gymflow:${sha}" >/dev/null 2>&1; then
    for attempt in 1 2 3; do
      if GYMFLOW_IMAGE="gymflow:${sha}" \
        GYMFLOW_ENV_FILE="${PRODUCTION_ENV_FILE}" \
          docker compose --project-name gymflow \
            --env-file "${PRODUCTION_ENV_FILE}" \
            -f "${target}/deploy/compose.yaml" build --pull app; then
        build_ok=true
        break
      fi
      echo "Application image build attempt ${attempt}/3 failed." >&2
      if (( attempt < 3 )); then sleep $((attempt * 10)); fi
    done
    if [[ ${build_ok} != true ]]; then
      echo "Application image build failed; health checks were not started." >&2
      return 1
    fi
  fi
  if ! compose_for "${sha}" up -d --remove-orphans; then
    echo "Docker Compose failed to start release ${sha}." >&2
    return 1
  fi
  wait_for_health
}

cleanup_old_releases() {
  mapfile -t releases < <(find "${PRODUCTION_RELEASES}" -mindepth 1 -maxdepth 1 -type d \
    -printf '%T@ %f\n' | sort -nr | awk '{print $2}')
  local current previous candidate resolved index=0
  current=$(read_state "${CURRENT_FILE}")
  previous=$(read_state "${PREVIOUS_FILE}")
  for candidate in "${releases[@]}"; do
    [[ ${candidate} =~ ^[0-9a-f]{40}$ ]] || continue
    index=$((index + 1))
    if (( index <= KEEP_RELEASES )) || [[ ${candidate} == "${current}" || ${candidate} == "${previous}" ]]; then
      continue
    fi
    resolved=$(realpath "$(release_path "${candidate}")")
    [[ ${resolved} == "$(realpath "${PRODUCTION_RELEASES}")/"* ]] || continue
    rm -rf -- "${resolved}"
    docker image rm "gymflow:${candidate}" >/dev/null 2>&1 || true
  done
  find "${PRODUCTION_BACKUPS}" -type f -name 'pre-deploy-*.sql.gz' -mtime +30 -delete
}

show_status() {
  local current previous
  current=$(read_state "${CURRENT_FILE}")
  previous=$(read_state "${PREVIOUS_FILE}")
  current=${current:-none}
  previous=${previous:-none}
  printf 'current=%s\nprevious=%s\n' "${current}" "${previous}"
  if [[ ${current} != none ]]; then compose_for "${current}" ps; fi
  curl --fail --silent --show-error --max-time 10 "${PRODUCTION_HEALTH_URL}" || true
  echo
}

mode=${1:-deploy}
case "${mode}" in
  status)
    show_status
    exit 0
    ;;
  rollback)
    [[ -s ${PREVIOUS_FILE} ]] || { echo "No previous release is recorded." >&2; exit 1; }
    target=$(<"${PREVIOUS_FILE}")
    old_current=$(read_state "${CURRENT_FILE}")
    if activate_release "${target}"; then
      printf '%s\n' "${target}" >"${CURRENT_FILE}"
      [[ -n ${old_current} ]] && printf '%s\n' "${old_current}" >"${PREVIOUS_FILE}"
      ln -sfn "$(release_path "${target}")" /opt/gymflow/current
      notify "↩️ GymFlow rollback completed" "Production is healthy on commit ${target}."
      exit 0
    fi
    notify "🚨 GymFlow rollback failed" "Manual intervention is required on $(hostname)."
    exit 1
    ;;
  deploy) ;;
  *) echo "Usage: $0 [deploy|rollback|status]" >&2; exit 2 ;;
esac

ensure_mirror
target=$(git --git-dir="${PRODUCTION_MIRROR}" rev-parse "refs/remotes/origin/${PRODUCTION_BRANCH}")
current=$(read_state "${CURRENT_FILE}")
if [[ ${target} == "${current}" ]]; then
  echo "Production is already at ${target}."
  exit 0
fi

prepare_release "${target}"
if [[ -n ${current} ]]; then backup_database "${current}"; fi
notify "🚀 GymFlow production deployment" "Deploying main commit ${target}."

if activate_release "${target}"; then
  [[ -n ${current} ]] && printf '%s\n' "${current}" >"${PREVIOUS_FILE}"
  printf '%s\n' "${target}" >"${CURRENT_FILE}"
  ln -sfn "$(release_path "${target}")" /opt/gymflow/current
  cleanup_old_releases
  notify "✅ GymFlow production healthy" "Deployment ${target} passed the public health check."
  exit 0
fi

notify "🚨 GymFlow deployment failed" "Commit ${target} failed health checks; automatic rollback is starting."
if [[ -n ${current} ]] && activate_release "${current}"; then
  notify "↩️ GymFlow automatic rollback complete" "Production was restored to ${current}."
else
  notify "🆘 GymFlow production unavailable" "Deployment and rollback both failed on $(hostname). Immediate manual action is required."
fi
exit 1
