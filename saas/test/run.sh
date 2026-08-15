#!/usr/bin/env bash
# Apply the SaaS migrations to a throwaway Postgres and run the RLS suite.
#
# These tests are the tenant-isolation gate: if they fail, one client company
# can read another's calls. Run them after touching anything in
# saas/migrations/. Needs Docker; nothing else.
#
#   ./saas/test/run.sh
set -euo pipefail

SAAS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="cc-pg-test"
IMAGE="${PG_IMAGE:-postgres:17-alpine}"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

echo "==> starting $IMAGE"
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=pg -e POSTGRES_DB=cc \
  -v "$SAAS_DIR:/saas:ro" \
  "$IMAGE" >/dev/null

# Wait on the real database, not on pg_isready: during initdb the image runs a
# temporary server that answers pg_isready before `cc` exists.
echo "==> waiting for postgres"
for _ in $(seq 1 120); do
  if docker exec "$CONTAINER" psql -q -U postgres -d cc -c 'select 1' >/dev/null 2>&1; then
    ready=1; break
  fi
done
[ "${ready:-}" = 1 ] || { echo "postgres never became ready"; docker logs "$CONTAINER" | tail -20; exit 1; }

psql_run() {
  docker exec "$CONTAINER" psql -q -v ON_ERROR_STOP=1 -U postgres -d cc -f "$1"
}

echo "==> supabase shim"
psql_run /saas/test/00_supabase_shim.sql

# Numbered migrations only: ALL_IN_ONE.sql is the generated paste-bundle of
# the same files and would re-apply everything on top of itself.
for f in "$SAAS_DIR"/migrations/[0-9]*.sql; do
  echo "==> $(basename "$f")"
  psql_run "/saas/migrations/$(basename "$f")"
done

echo "==> RLS isolation suite"
docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d cc \
  -f /saas/test/01_rls_isolation.sql 2>&1 | grep -E "PASS|FAIL|ALL TESTS"

echo "==> ok"
