#!/usr/bin/env bash
set -Eeuo pipefail

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
project=avito-fair-queue-integration
compose=(docker compose -p "$project" -f "$repo_dir/docker-compose.yml")

cleanup() {
    "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup
"${compose[@]}" up -d postgres

for _ in {1..30}; do
    if "${compose[@]}" exec -T postgres pg_isready -U queue -d queue >/dev/null 2>&1; then
        break
    fi
    sleep 1
done
"${compose[@]}" exec -T postgres pg_isready -U queue -d queue >/dev/null

"${compose[@]}" build migrate
"${compose[@]}" run --rm migrate up
"${compose[@]}" run --rm migrate up
"${compose[@]}" run --rm migrate version | grep -q 'version: 1 dirty: false'
"${compose[@]}" run --rm migrate seed
"${compose[@]}" run --rm migrate seed

counts=$("${compose[@]}" exec -T postgres psql -U queue -d queue -Atc \
    "SELECT count(*) || '|' || (SELECT count(*) FROM inventory_units) FROM products;")
test "$counts" = "5|9"

"${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U queue -d queue \
    < "$repo_dir/backend/tests/integration/schema_constraints.sql"
