#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
failed=0

fail() {
  echo "[ERREUR] $*" >&2
  failed=1
}

warn() {
  echo "[ATTENTION] $*" >&2
}

if [[ ! -f "$ENV_FILE" ]]; then
  fail ".env absent. Copiez .env.example vers .env puis adaptez les secrets."
else
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${APP_WORKDIR:-${PWA_TEST_LAB_WORKDIR:-}}" ]]; then
  fail "APP_WORKDIR absent (ou ancien PWA_TEST_LAB_WORKDIR absent en fallback)."
fi

session_secret_value="${SESSION_SECRET:-}"
if [[ ${#session_secret_value} -lt 32 ]]; then
  fail "SESSION_SECRET doit contenir au moins 32 caractères."
fi

case "${DEV_ADMIN_TOKEN:-}" in
  ''|change-me-admin-token|replace-with-a-long-random-admin-token)
    fail "DEV_ADMIN_TOKEN doit être personnalisé."
    ;;
esac

case "${DEV_ALLOWED_TOKEN:-}" in
  ''|change-me-host-token|replace-with-a-different-long-random-host-token)
    fail "DEV_ALLOWED_TOKEN doit être personnalisé."
    ;;
esac

if ! (cd "$ROOT_DIR" && docker compose config >/dev/null); then
  fail "docker compose config échoue."
fi

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

warn "Vérification terminée: la configuration template semble cohérente."
