#!/usr/bin/env bash
set -Eeuo pipefail

deploy_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
compose=(docker compose --env-file "$deploy_dir/.env" -f "$deploy_dir/docker-compose.prod.yml")

failure_logs() {
    status=$?
    if [[ $status -ne 0 ]]; then
        "${compose[@]}" logs --no-color --tail=120 postgres migrate api-1 api-2 worker || true
    fi
}
trap failure_logs EXIT

"${compose[@]}" pull
"${compose[@]}" run --rm migrate
"${compose[@]}" up -d --remove-orphans

api_one_port=$("${compose[@]}" port api-1 8080 | awk -F: 'NR == 1 { print $NF }')
api_two_port=$("${compose[@]}" port api-2 8080 | awk -F: 'NR == 1 { print $NF }')

for _ in {1..60}; do
    if curl --fail --silent --show-error "http://127.0.0.1:${api_one_port}/api/v1/ready" >/dev/null 2>&1 \
        && curl --fail --silent --show-error "http://127.0.0.1:${api_two_port}/api/v1/ready" >/dev/null 2>&1; then
        exit 0
    fi
    sleep 2
done

echo "readiness did not become healthy" >&2
exit 1
