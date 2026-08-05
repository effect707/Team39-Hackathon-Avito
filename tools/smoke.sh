#!/usr/bin/env bash
set -Eeuo pipefail

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_dir"

port=${APP_PORT:-8080}
base_url="http://127.0.0.1:${port}"
api_one_stopped=false

restore_api() {
    if [[ "$api_one_stopped" == true ]]; then
        docker compose start api-1 >/dev/null 2>&1 || true
    fi
}
trap restore_api EXIT

docker compose up --build -d

for _ in {1..60}; do
    if curl --max-time 5 --fail --silent --show-error "$base_url/api/v1/ready" >/dev/null 2>&1; then
        break
    fi
    sleep 2
done

curl --max-time 5 --fail --silent --show-error "$base_url/" | grep -q 'Честная очередь'
curl --max-time 5 --fail --silent --show-error "$base_url/api/v1/health" | grep -q '"status":"ok"'
curl --max-time 5 --fail --silent --show-error "$base_url/api/v1/ready" | grep -q '"status":"ok"'
test "$(curl --max-time 5 --silent --output /dev/null --write-out '%{http_code}' "$base_url/metrics")" = "404"

docker compose stop api-1
api_one_stopped=true

for _ in {1..15}; do
    if curl --max-time 5 --fail --silent --show-error "$base_url/api/v1/health" | grep -q '"status":"ok"'; then
        exit 0
    fi
    sleep 1
done

exit 1
