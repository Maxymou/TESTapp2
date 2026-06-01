#!/usr/bin/env bash
set -Eeuo pipefail

MODE="${1:-normal}"
if [[ "$MODE" != "normal" && "$MODE" != "force-pwa" ]]; then
  echo "Mode invalide: $MODE" >&2
  exit 64
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/runtime"
LOG_DIR="$ROOT_DIR/logs"
LOCK_FILE="$RUNTIME_DIR/update.lock"
STATUS_FILE="$RUNTIME_DIR/update-status.json"
LATEST_LOG="$LOG_DIR/update-latest.log"
mkdir -p "$RUNTIME_DIR" "$LOG_DIR"

json_escape() {
  python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'
}

write_status() {
  local state="$1"
  local exit_code="${2:-0}"
  local message="${3:-}"
  local escaped_message
  escaped_message="$(printf '%s' "$message" | json_escape)"
  cat > "$STATUS_FILE" <<JSON
{
  "state": "$state",
  "mode": "$MODE",
  "exitCode": $exit_code,
  "message": $escaped_message,
  "updatedAt": "$(date -Is)"
}
JSON
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  write_status "locked" 75 "Une mise à jour est déjà en cours."
  echo "Une mise à jour est déjà en cours." >&2
  exit 75
fi

cd "$ROOT_DIR"
: > "$LATEST_LOG"
exec > >(tee -a "$LATEST_LOG") 2>&1

on_error() {
  local code="$?"
  write_status "failed" "$code" "Mise à jour échouée. Consultez logs/update-latest.log."
  exit "$code"
}
trap on_error ERR

write_status "running" 0 "Mise à jour en cours."
echo "[$(date -Is)] Début update mode=$MODE"
# Ne pas appeler de script d'initialisation ici.
# La configuration propre à l'app doit rester dans .env et les volumes Docker.

git fetch origin main
git reset --hard origin/main

if [[ "$MODE" == "force-pwa" ]]; then
  echo "[$(date -Is)] Nettoyage caches PWA générés"
  rm -rf frontend/dist
fi

docker compose up -d --build
docker compose ps

write_status "success" 0 "Mise à jour terminée."
echo "[$(date -Is)] Update terminée"
