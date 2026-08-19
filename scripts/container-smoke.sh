#!/usr/bin/env sh
set -eu

compose_file="docker-compose.production.yml"
project_name="super-oi-smoke-$$"
cleanup() {
  docker compose -p "$project_name" -f "$compose_file" down -v --remove-orphans
}
trap cleanup EXIT INT TERM

: "${POSTGRES_USER:=super_oi}"
: "${POSTGRES_PASSWORD:=smoke-test-password}"
: "${POSTGRES_DB:=super_oi}"
: "${SESSION_SECRET:=smoke-session-secret-with-at-least-32-characters}"
: "${SECURE_COOKIES:=false}"
: "${APP_PORT:=3100}"
: "${APP_ORIGIN:=http://127.0.0.1:${APP_PORT}}"
export POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB SESSION_SECRET SECURE_COOKIES APP_PORT APP_ORIGIN

docker compose -p "$project_name" -f "$compose_file" up -d --build
attempt=0
until curl --fail --silent "${APP_ORIGIN}/health"; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 30 ] || { echo "container health check timed out" >&2; exit 1; }
  sleep 2
done
printf '\ncontainer smoke test passed\n'
