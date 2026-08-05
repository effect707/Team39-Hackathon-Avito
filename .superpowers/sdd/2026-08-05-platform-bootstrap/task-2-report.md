# Task 2 — Go platform runtime report

## Scope

Implemented only the requested backend runtime: Go module (Go 1.26.4), configuration, GORM/PostgreSQL connectivity and pool limits, HTTP router/middleware/errors, health/readiness, Prometheus `/metrics`, cancellable worker loop, API/worker/migrate binaries, embedded SQL migrations and seed, graceful HTTP shutdown, and a non-root backend Docker image. Existing SQL migrations were not modified.

Product route stubs follow `docs/openapi.yaml`: public product-read routes and protected queue/checkout/demo routes return the stable `501 NOT_IMPLEMENTED` envelope. Health, readiness and metrics do not require demo identity.

## TDD evidence

Tests were written before the corresponding production packages. With an entirely absent Go package, Go reports the wished-for missing API as a compile-time test failure; this is the initial red evidence for the first three behavioral packages.

### Config, router and worker — RED

Command:

```text
cd backend && env GOTOOLCHAIN=go1.26.4 go test ./internal/platform/config ./internal/platform/httpapi ./internal/platform/worker
```

Exact output:

```text
# github.com/team39/avito-fair-queue/backend/internal/platform/worker [github.com/team39/avito-fair-queue/backend/internal/platform/worker.test]
internal/platform/worker/loop_test.go:14:9: undefined: Run
# github.com/team39/avito-fair-queue/backend/internal/platform/config [github.com/team39/avito-fair-queue/backend/internal/platform/config.test]
internal/platform/config/config_test.go:11:14: undefined: Load
internal/platform/config/config_test.go:34:15: undefined: Load
FAIL    github.com/team39/avito-fair-queue/backend/internal/platform/config [build failed]
# github.com/team39/avito-fair-queue/backend/internal/platform/httpapi [github.com/team39/avito-fair-queue/backend/internal/platform/httpapi.test]
internal/platform/httpapi/router_test.go:17:12: undefined: NewRouter
internal/platform/httpapi/router_test.go:36:12: undefined: NewRouter
internal/platform/httpapi/router_test.go:56:3: undefined: NewRouter
internal/platform/httpapi/router_test.go:64:3: undefined: NewRouter
internal/platform/httpapi/router_test.go:75:12: undefined: NewRouter
internal/platform/httpapi/router_test.go:104:18: undefined: DemoUserID
internal/platform/httpapi/router_test.go:123:12: undefined: NewRouter
FAIL    github.com/team39/avito-fair-queue/backend/internal/platform/httpapi [build failed]
FAIL    github.com/team39/avito-fair-queue/backend/internal/platform/worker [build failed]
FAIL
```

The tests protect configuration defaults/validation, request-ID propagation, recovery error envelope, health, both readiness outcomes, demo-auth rejection/context propagation, all declared walking-skeleton endpoints, and worker cancellation.

### Metrics route correction — RED then GREEN

The behavioral test for the explicit `/metrics` path was added before changing the pre-existing route registration.

```text
$ env GOTOOLCHAIN=go1.26.4 go test ./internal/platform/httpapi -run TestMetricsIsAvailableAtInternalMetricsPath -count=1
--- FAIL: TestMetricsIsAvailableAtInternalMetricsPath (0.00s)
    router_test.go:159: status = 404, want 200
FAIL
FAIL    github.com/team39/avito-fair-queue/backend/internal/platform/httpapi    0.435s
FAIL

$ env GOTOOLCHAIN=go1.26.4 go test ./internal/platform/httpapi -run TestMetricsIsAvailableAtInternalMetricsPath -count=1
ok      github.com/team39/avito-fair-queue/backend/internal/platform/httpapi    0.439s
```

### Config, router and worker — GREEN

```text
$ env GOTOOLCHAIN=go1.26.4 go test ./internal/platform/config ./internal/platform/httpapi ./internal/platform/worker
ok      github.com/team39/avito-fair-queue/backend/internal/platform/config     (cached)
ok      github.com/team39/avito-fair-queue/backend/internal/platform/httpapi    0.433s
ok      github.com/team39/avito-fair-queue/backend/internal/platform/worker     (cached)
```

## Final verification

Command:

```text
gofmt -w $(rg --files backend -g '*.go')
cd backend && env GOTOOLCHAIN=go1.26.4 go test -race ./... && env GOTOOLCHAIN=go1.26.4 go vet ./... && env GOTOOLCHAIN=go1.26.4 go build ./cmd/api ./cmd/worker ./cmd/migrate
```

Exact `go test -race ./...` output (the following `go vet` and `go build` completed silently with exit code 0):

```text
?       github.com/team39/avito-fair-queue/backend/cmd/api       [no test files]
?       github.com/team39/avito-fair-queue/backend/cmd/migrate   [no test files]
?       github.com/team39/avito-fair-queue/backend/cmd/worker    [no test files]
ok      github.com/team39/avito-fair-queue/backend/internal/platform/config     1.499s
?       github.com/team39/avito-fair-queue/backend/internal/platform/database   [no test files]
ok      github.com/team39/avito-fair-queue/backend/internal/platform/httpapi    1.827s
?       github.com/team39/avito-fair-queue/backend/internal/platform/server     [no test files]
ok      github.com/team39/avito-fair-queue/backend/internal/platform/worker     1.411s
?       github.com/team39/avito-fair-queue/backend/migrations    [no test files]
```

`docker build -f backend/Dockerfile -t avito-fair-queue-platform:task2 backend` completed successfully. Image inspection reported:

```text
nonroot:nonroot ["/api"]
```

## Self-review

- No `AutoMigrate`, process-memory state, or SQL schema change was introduced.
- Runtime database access uses GORM PostgreSQL and applies `database/sql` pool settings before the startup ping.
- Request ID is emitted for success and error paths; panic recovery does not leak panic details.
- The API and worker share config/database packages; worker work is cancellable.
- The migration command uses `golang-migrate/migrate/v4` with `io/fs`-embedded migration and seed SQL. Seed SQL is the existing idempotent script.

## Concern

The attempted isolated PostgreSQL end-to-end `migrate up` smoke test did not execute: zsh treated the unquoted `?` in `DATABASE_URL=...?...` as a glob and returned `zsh:1: no matches found`. The temporary PostgreSQL container was stopped and auto-removed. Compile/build and Docker-image checks passed, but `up`, `version`, and `seed` were not exercised against a live database in this task.
