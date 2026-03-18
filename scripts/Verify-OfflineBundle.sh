#!/usr/bin/env bash
set -euo pipefail

BUNDLE_DIR="${1:-.}"
TIMEOUT_SEC="${TIMEOUT_SEC:-180}"
INTERVAL_SEC="${INTERVAL_SEC:-5}"

BUNDLE_DIR="$(cd "$BUNDLE_DIR" && pwd)"
COMPOSE_FILE="$BUNDLE_DIR/docker-compose.offline.yml"
ENV_EXAMPLE="$BUNDLE_DIR/.env.example"
ENV_FILE="$BUNDLE_DIR/.env"

if ! command -v docker >/dev/null 2>&1; then
  echo "[OfflineVerify] docker is required but not found." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "[OfflineVerify] Docker daemon is not reachable." >&2
  echo "[OfflineVerify] Please start Docker Desktop/Engine and retry." >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "[OfflineVerify] compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" && -f "$ENV_EXAMPLE" ]]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "[OfflineVerify] .env created from template."
fi

WEB_PORT=5000
if [[ -f "$ENV_FILE" ]]; then
  WEB_PORT_LINE="$(grep -E '^[[:space:]]*WEB_PORT=' "$ENV_FILE" | head -n1 || true)"
  if [[ -n "$WEB_PORT_LINE" ]]; then
    WEB_PORT="${WEB_PORT_LINE#*=}"
    WEB_PORT="${WEB_PORT//\"/}"
    WEB_PORT="${WEB_PORT//\'/}"
  fi
fi

cd "$BUNDLE_DIR"

start_ts="$(date +%s)"
while true; do
  postgres_status="$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' openvideo-editor-postgres 2>/dev/null || true)"
  web_status="$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' openvideo-editor-web 2>/dev/null || true)"

  if [[ "$postgres_status" == "running healthy" && "$web_status" == "running healthy" ]]; then
    break
  fi

  now_ts="$(date +%s)"
  if (( now_ts - start_ts >= TIMEOUT_SEC )); then
    echo "[OfflineVerify] timeout waiting for services ready."
    docker compose -f "$COMPOSE_FILE" ps
    exit 1
  fi

  sleep "$INTERVAL_SEC"
done

if command -v curl >/dev/null 2>&1; then
  curl -fsS "http://localhost:${WEB_PORT}/projects" >/dev/null
fi

echo "[OfflineVerify] Container status:"
docker compose -f "$COMPOSE_FILE" ps

echo "[OfflineVerify] PASS"
