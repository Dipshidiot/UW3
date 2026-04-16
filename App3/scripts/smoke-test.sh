#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

STAGING_PORT="${STAGING_PORT:-5050}"
API_BASE_URL="${API_BASE_URL:-http://localhost:${STAGING_PORT}}"
HEALTH_PATH="${HEALTH_PATH:-/api/health}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "[smoke] starting staging server"
PORT="$STAGING_PORT" npm run start:staging >/tmp/utility-watch-staging.log 2>&1 &
SERVER_PID=$!

ATTEMPTS=30
SLEEP_SECONDS=1

for ((i=1; i<=ATTEMPTS; i++)); do
  if curl -fsS "${API_BASE_URL}${HEALTH_PATH}" >/tmp/utility-watch-health.json; then
    break
  fi

  if [[ "$i" -eq "$ATTEMPTS" ]]; then
    echo "[smoke] health check failed after ${ATTEMPTS} attempts"
    cat /tmp/utility-watch-staging.log || true
    exit 1
  fi

  sleep "$SLEEP_SECONDS"
done

echo "[smoke] health ok: $(cat /tmp/utility-watch-health.json)"

echo "[smoke] check auth route availability"
curl -fsS -X POST "${API_BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@example.com","password":"invalid"}' >/tmp/utility-watch-auth-smoke.json || true

echo "[smoke] check admin route protection"
STATUS_CODE=$(curl -s -o /tmp/utility-watch-admin-smoke.json -w "%{http_code}" "${API_BASE_URL}/api/admin/overview")
if [[ "$STATUS_CODE" != "401" && "$STATUS_CODE" != "403" ]]; then
  echo "[smoke] expected protected admin endpoint to return 401/403, got ${STATUS_CODE}"
  exit 1
fi

echo "Smoke tests complete."
