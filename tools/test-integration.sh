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

"${compose[@]}" up --build -d --scale worker=2 api-1 api-2 worker
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

payment_product_id=10000000-0000-4000-8000-000000000003
payment_user_id=40000000-0000-4000-8000-000000000201
foreign_user_id=40000000-0000-4000-8000-000000000202
payment_join_response="$response_dir/payment-join.json"
curl --max-time 10 --fail --silent \
    --request POST \
    --header "X-Demo-User-ID: $payment_user_id" \
    --output "$payment_join_response" \
    "http://127.0.0.1:$integration_api_one_port/api/v1/products/$payment_product_id/queue/join"
payment_grant_id=$(ruby -rjson -e 'puts JSON.parse(File.read(ARGV.fetch(0))).fetch("grant").fetch("id")' \
    "$payment_join_response")

foreign_checkout_code=$(curl --max-time 10 --silent --output /dev/null --write-out '%{http_code}' \
    --request POST \
    --header "X-Demo-User-ID: $foreign_user_id" \
    "http://127.0.0.1:$integration_api_two_port/api/v1/grants/$payment_grant_id/checkout")
test "$foreign_checkout_code" = 404

missing_checkout_code=$(curl --max-time 10 --silent --output /dev/null --write-out '%{http_code}' \
    --request POST \
    --header "X-Demo-User-ID: $payment_user_id" \
    "http://127.0.0.1:$integration_api_two_port/api/v1/grants/50000000-0000-4000-8000-000000000999/checkout")
test "$missing_checkout_code" = 404

curl --max-time 10 --fail --silent \
    --request POST \
    --header "X-Demo-User-ID: $payment_user_id" \
    --output /dev/null \
    "http://127.0.0.1:$integration_api_one_port/api/v1/grants/$payment_grant_id/checkout"

idempotency_key=50000000-0000-4000-8000-000000000201
payment_body="{\"idempotency_key\":\"$idempotency_key\",\"result\":\"success\"}"
payment_pids=()
for replica in 1 2; do
    if [[ "$replica" = 1 ]]; then
        port=$integration_api_one_port
    else
        port=$integration_api_two_port
    fi
    curl --max-time 15 --silent --show-error \
        --request POST \
        --header 'Content-Type: application/json' \
        --header "X-Demo-User-ID: $payment_user_id" \
        --data "$payment_body" \
        --output "$response_dir/payment-$replica.json" \
        --write-out '%{http_code}' \
        "http://127.0.0.1:$port/api/v1/demo/grants/$payment_grant_id/payment-result" \
        > "$response_dir/payment-$replica.code" &
    payment_pids+=("$!")
done
for pid in "${payment_pids[@]}"; do
    wait "$pid"
done

ruby -rjson -e '
dir = ARGV.fetch(0)
codes = [1, 2].map { |index| File.read(File.join(dir, "payment-#{index}.code")) }
unless codes == ["200", "200"]
  bodies = [1, 2].map { |index| File.read(File.join(dir, "payment-#{index}.json")) }
  abort "concurrent payment codes: #{codes}; bodies: #{bodies}"
end
responses = [1, 2].map { |index| JSON.parse(File.read(File.join(dir, "payment-#{index}.json"))) }
flags = responses.map { |response| response.fetch("already_processed") }.sort_by(&:to_s)
abort "concurrent payment flags: #{flags}" unless flags == [false, true]
' "$response_dir"

retry_processed=$(curl --max-time 10 --fail --silent \
    --request POST \
    --header 'Content-Type: application/json' \
    --header "X-Demo-User-ID: $payment_user_id" \
    --data "$payment_body" \
    "http://127.0.0.1:$integration_api_one_port/api/v1/demo/grants/$payment_grant_id/payment-result" \
    | ruby -rjson -e 'puts JSON.parse(STDIN.read).fetch("already_processed")')
test "$retry_processed" = true

foreign_payment_code=$(curl --max-time 10 --silent --output /dev/null --write-out '%{http_code}' \
    --request POST \
    --header 'Content-Type: application/json' \
    --header "X-Demo-User-ID: $foreign_user_id" \
    --data "$payment_body" \
    "http://127.0.0.1:$integration_api_two_port/api/v1/demo/grants/$payment_grant_id/payment-result")
test "$foreign_payment_code" = 404

used_checkout_code=$(curl --max-time 10 --silent --output /dev/null --write-out '%{http_code}' \
    --request POST \
    --header "X-Demo-User-ID: $payment_user_id" \
    "http://127.0.0.1:$integration_api_two_port/api/v1/grants/$payment_grant_id/checkout")
test "$used_checkout_code" = 409

payment_state=$("${compose[@]}" exec -T postgres psql -U queue -d queue -Atc \
    "SELECT
        (SELECT status FROM queue_entries WHERE product_id = '$payment_product_id' AND user_id = '$payment_user_id') || '|' ||
        (SELECT status FROM purchase_grants WHERE id = '$payment_grant_id') || '|' ||
        (SELECT status FROM inventory_units WHERE product_id = '$payment_product_id') || '|' ||
        (SELECT count(*) FROM checkout_attempts WHERE grant_id = '$payment_grant_id');")
test "$payment_state" = "PURCHASED|PURCHASED|SOLD|1"

race_product_id=10000000-0000-4000-8000-000000000004
race_user_id=40000000-0000-4000-8000-000000000301
race_join_response="$response_dir/race-join.json"
curl --max-time 10 --fail --silent \
    --request POST \
    --header "X-Demo-User-ID: $race_user_id" \
    --output "$race_join_response" \
    "http://127.0.0.1:$integration_api_one_port/api/v1/products/$race_product_id/queue/join"
race_grant_id=$(ruby -rjson -e 'puts JSON.parse(File.read(ARGV.fetch(0))).fetch("grant").fetch("id")' \
    "$race_join_response")

"${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U queue -d queue -c \
    "UPDATE purchase_grants SET expires_at = now() WHERE id = '$race_grant_id';" >/dev/null
race_checkout_code=$(curl --max-time 10 --silent --output /dev/null --write-out '%{http_code}' \
    --request POST \
    --header "X-Demo-User-ID: $race_user_id" \
    "http://127.0.0.1:$integration_api_two_port/api/v1/grants/$race_grant_id/checkout")
test "$race_checkout_code" = 409

for _ in {1..40}; do
    race_grant_status=$("${compose[@]}" exec -T postgres psql -U queue -d queue -Atc \
        "SELECT status FROM purchase_grants WHERE id = '$race_grant_id';")
    if [[ "$race_grant_status" = EXPIRED ]]; then
        break
    fi
    sleep 0.25
done
test "$race_grant_status" = EXPIRED

race_state=$("${compose[@]}" exec -T postgres psql -U queue -d queue -Atc \
    "SELECT
        (SELECT status FROM queue_entries WHERE product_id = '$race_product_id' AND user_id = '$race_user_id') || '|' ||
        (SELECT status FROM purchase_grants WHERE id = '$race_grant_id') || '|' ||
        (SELECT status FROM inventory_units WHERE product_id = '$race_product_id');")
test "$race_state" = "EXPIRED|EXPIRED|AVAILABLE"
