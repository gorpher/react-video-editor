#!/usr/bin/env bash
set -euo pipefail

BUNDLE_DIR="${1:-.}"
BUNDLE_DIR="$(cd "$BUNDLE_DIR" && pwd)"

IMAGES_TAR="$BUNDLE_DIR/openvideo-editor-images-offline.tar"
COMPOSE_FILE="$BUNDLE_DIR/docker-compose.offline.yml"
ENV_EXAMPLE="$BUNDLE_DIR/.env.example"
ENV_FILE="$BUNDLE_DIR/.env"

if ! command -v docker >/dev/null 2>&1; then
  echo "[OfflineDeploy] docker is required but not found." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "[OfflineDeploy] Docker daemon is not reachable." >&2
  echo "[OfflineDeploy] Please start Docker Desktop/Engine and retry." >&2
  exit 1
fi

if [[ ! -f "$IMAGES_TAR" ]]; then
  echo "[OfflineDeploy] images tar not found: $IMAGES_TAR" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "[OfflineDeploy] compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" && -f "$ENV_EXAMPLE" ]]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "[OfflineDeploy] .env created from template."
fi

cd "$BUNDLE_DIR"

echo "[OfflineDeploy] Loading docker images..."
docker load -i "$IMAGES_TAR"

echo "[OfflineDeploy] Starting services..."
docker compose -f "$COMPOSE_FILE" up -d

echo "[OfflineDeploy] Current status:"
docker compose -f "$COMPOSE_FILE" ps

echo "[OfflineDeploy] Done."
