#!/usr/bin/env bash
set -Eeuo pipefail

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_dir"

api_one_url="http://127.0.0.1:${API_1_PORT:-8080}"
api_two_url="http://127.0.0.1:${API_2_PORT:-8081}"
api_one_stopped=false

restore_api() {
    if [[ "$api_one_stopped" == true ]]; then
        docker compose start api-1 >/dev/null 2>&1 || true
    fi
}
trap restore_api EXIT

wait_for_ready() {
    local base_url=$1
    for _ in {1..60}; do
        if curl --max-time 5 --fail --silent --show-error "$base_url/api/v1/ready" >/dev/null 2>&1; then
            return 0
        fi
        sleep 2
    done
    echo "readiness did not become healthy at $base_url" >&2
    return 1
}

check_api() {
    local base_url=$1
    curl --max-time 5 --fail --silent --show-error "$base_url/api/v1/health" | grep -q '"status":"ok"'
    curl --max-time 5 --fail --silent --show-error "$base_url/api/v1/ready" | grep -q '"status":"ok"'
    test "$(curl --max-time 5 --silent --output /dev/null --write-out '%{http_code}' "$base_url/metrics")" = "404"
}

docker compose up --build -d --remove-orphans

wait_for_ready "$api_one_url"
wait_for_ready "$api_two_url"
check_api "$api_one_url"
check_api "$api_two_url"

docker compose run --rm migrate seed >/dev/null
smoke_user_id=40000000-0000-4000-8000-000000000900
smoke_product_id=10000000-0000-4000-8000-000000000002
state_before=$(curl --max-time 10 --fail --silent \
    --request POST \
    --header "X-Demo-User-ID: $smoke_user_id" \
    "$api_one_url/api/v1/products/$smoke_product_id/queue/join" \
    | ruby -rjson -e 'state=JSON.parse(STDIN.read); puts "#{state.fetch("queue_entry_id")}|#{state.fetch("ticket_no")}"')

docker compose stop api-1
api_one_stopped=true

wait_for_ready "$api_two_url"
check_api "$api_two_url"
state_after=$(curl --max-time 10 --fail --silent \
    --header "X-Demo-User-ID: $smoke_user_id" \
    "$api_two_url/api/v1/products/$smoke_product_id/queue/me" \
    | ruby -rjson -e 'state=JSON.parse(STDIN.read); puts "#{state.fetch("queue_entry_id")}|#{state.fetch("ticket_no")}"')
test "$state_after" = "$state_before"
