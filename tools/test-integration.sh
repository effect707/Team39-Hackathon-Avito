#!/usr/bin/env bash
set -Eeuo pipefail

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
project=avito-fair-queue-integration
integration_api_one_port=${INTEGRATION_API_1_PORT:-18080}
integration_api_two_port=${INTEGRATION_API_2_PORT:-18081}
export API_1_PORT=$integration_api_one_port
export API_2_PORT=$integration_api_two_port
export WORKER_INTERVAL=500ms
compose=(docker compose -p "$project" -f "$repo_dir/docker-compose.yml")
response_dir=

cleanup() {
    if [[ -n "$response_dir" && -d "$response_dir" ]]; then
        rm -rf -- "$response_dir"
    fi
    "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_for_ready() {
    local port=$1
    for _ in {1..60}; do
        if curl --max-time 3 --fail --silent "http://127.0.0.1:$port/api/v1/ready" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
    done
    return 1
}

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

"${compose[@]}" up -d --scale worker=2 api-1 api-2 worker
wait_for_ready "$integration_api_one_port"
wait_for_ready "$integration_api_two_port"

response_dir=$(mktemp -d "${TMPDIR:-/tmp}/avito-fair-queue-responses.XXXXXX")
product_id=10000000-0000-4000-8000-000000000002
join_pids=()
for index in $(seq 1 100); do
    user_id=$(printf '40000000-0000-4000-8000-%012d' "$index")
    if ((index % 2 == 0)); then
        port=$integration_api_two_port
    else
        port=$integration_api_one_port
    fi
    curl --max-time 60 --fail-with-body --silent --show-error \
        --request POST \
        --header "X-Demo-User-ID: $user_id" \
        --output "$response_dir/$index.json" \
        "http://127.0.0.1:$port/api/v1/products/$product_id/queue/join" &
    join_pids+=("$!")
done

join_failed=0
for pid in "${join_pids[@]}"; do
    if ! wait "$pid"; then
        join_failed=1
    fi
done
test "$join_failed" = 0

ruby -rjson -e '
files = Dir[File.join(ARGV.fetch(0), "*.json")]
abort "expected 100 responses, got #{files.length}" unless files.length == 100
states = files.map { |file| JSON.parse(File.read(file)) }
counts = states.group_by { |state| state.fetch("status") }.transform_values(&:length)
abort "expected 5 GRANTED and 95 WAITING, got #{counts}" unless counts == {"GRANTED" => 5, "WAITING" => 95}
tickets = states.map { |state| state.fetch("ticket_no") }.sort
abort "tickets are not the range 1..100" unless tickets == (1..100).to_a
' "$response_dir"

repeat_user_id=40000000-0000-4000-8000-000000000010
original_ticket=$(ruby -rjson -e 'puts JSON.parse(File.read(ARGV.fetch(0))).fetch("ticket_no")' \
    "$response_dir/10.json")
repeat_ticket=$(curl --max-time 10 --fail --silent \
    --request POST \
    --header "X-Demo-User-ID: $repeat_user_id" \
    "http://127.0.0.1:$integration_api_two_port/api/v1/products/$product_id/queue/join" \
    | ruby -rjson -e 'puts JSON.parse(STDIN.read).fetch("ticket_no")')
test "$repeat_ticket" = "$original_ticket"

entry_count=$("${compose[@]}" exec -T postgres psql -U queue -d queue -Atc \
    "SELECT count(*) FROM queue_entries WHERE product_id = '$product_id';")
test "$entry_count" = 100

"${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U queue -d queue -c \
    "WITH target AS (
        SELECT g.id
        FROM purchase_grants AS g
        JOIN queue_entries AS e ON e.id = g.queue_entry_id
        WHERE g.product_id = '$product_id' AND g.status = 'ACTIVE'
        ORDER BY e.ticket_no
        LIMIT 2
    )
    UPDATE purchase_grants AS g
    SET expires_at = now() - interval '1 second'
    FROM target
    WHERE g.id = target.id;" >/dev/null

for _ in {1..40}; do
    promoted=$("${compose[@]}" exec -T postgres psql -U queue -d queue -Atc \
        "SELECT count(*) FROM queue_entries WHERE product_id = '$product_id' AND ticket_no IN (6, 7) AND status = 'GRANTED';")
    if [[ "$promoted" = 2 ]]; then
        break
    fi
    sleep 0.25
done
test "$promoted" = 2

lifecycle=$("${compose[@]}" exec -T postgres psql -U queue -d queue -Atc \
    "SELECT
        count(*) FILTER (WHERE status = 'EXPIRED') || '|' ||
        count(*) FILTER (WHERE status = 'GRANTED') || '|' ||
        count(*) FILTER (WHERE status = 'WAITING') || '|' ||
        (SELECT count(*) FROM purchase_grants WHERE product_id = '$product_id' AND status = 'ACTIVE') || '|' ||
        (SELECT count(*) FROM inventory_units WHERE product_id = '$product_id' AND status = 'RESERVED') || '|' ||
        (SELECT count(*) FROM (
            SELECT inventory_unit_id
            FROM purchase_grants
            WHERE product_id = '$product_id' AND status IN ('ACTIVE', 'CHECKOUT_PENDING')
            GROUP BY inventory_unit_id
            HAVING count(*) > 1
        ) AS duplicate_grants)
    FROM queue_entries
    WHERE product_id = '$product_id';")
test "$lifecycle" = "2|5|93|5|5|0"
