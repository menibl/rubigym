#!/usr/bin/env bash
set -Eeuo pipefail

STATUS=/var/lib/gymflow-monitor/status.json
if [[ ${1:-} == --json ]]; then
  exec cat "${STATUS}"
fi

jq -r '
  "status=" + (if .healthy then "healthy" else "unhealthy" end),
  "timestamp=" + .timestamp,
  "host=" + .hostname,
  "disk=" + (.diskPercent|tostring) + "% memory=" + (.memoryPercent|tostring) + "% load=" + (.load1m|tostring),
  (.issues[]? | "issue=" + .)
' "${STATUS}"
