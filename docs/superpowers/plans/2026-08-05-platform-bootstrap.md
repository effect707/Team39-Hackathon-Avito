# Platform Bootstrap Implementation Plan

> **For agentic workers:** implement one task at a time, follow repository `AGENTS.md`, use TDD for behavioral code, preserve unrelated user changes, and commit only files owned by the task.

**Goal:** Deliver a runnable Go/React walking skeleton with PostgreSQL migrations, Docker Compose, GitHub CI/CD, and tag-driven deployment to Ubuntu.

**Architecture:** A modular Go monolith uses PostgreSQL as the only source of truth. One backend image contains `api`, `worker`, and `migrate`; a Vite frontend is served behind an edge Nginx that balances two API replicas. GitHub Actions verifies every change and deploys public GHCR images for strict semver tags.

**Tech Stack:** Go 1.26.4, `net/http`, `log/slog`, GORM, PostgreSQL 17, React 18, TypeScript, Vite, TanStack Query, Vitest, Docker Compose, Nginx, GitHub Actions, GHCR.

## Global Constraints

- Preserve every invariant in `AGENTS.md`; no Redis, Kafka, Kubernetes, real auth, real payment, or process-memory correctness guarantees.
- `docs/spec.md` is the product source of truth, `docs/openapi.yaml` the public HTTP contract, and versioned SQL migrations the schema source of truth.
- Never call GORM `AutoMigrate`; application/worker repositories use GORM while migrations use versioned SQL.
- User-facing text is Russian; code, JSON fields, env names, and identifiers are English.
- `X-Demo-User-ID` supplies demo identity only on business routes. Health/readiness are unauthenticated.
- Preserve current user files; remove legacy `.github-ci.yml` only after equivalent GitHub workflows exist.

---

### Task 1: Sources of truth, OpenAPI, schema, and seed

Normalize documentation and create the shared contract baseline.

- Move `avito-fair-queue-spec.md` to `docs/spec.md` and the case PDF to `docs/reference/case-2.pdf`; keep `AGENTS.md` and `team-responsibilities.md` intact.
- Add `.gitignore` for `.idea/`, `.env`, build/test artifacts, logs, PostgreSQL data, frontend stores, and `.superpowers/`.
- Create OpenAPI 3.1 for every `/api/v1` route from the spec. Include product, queue, grant, checkout, error, and SSE signal schemas; include `501 NOT_IMPLEMENTED` while stubs remain.
- Create reversible migration `000001_initial_schema.up.sql`/`.down.sql` for `products`, `inventory_units`, `queue_entries`, `purchase_grants`, and `checkout_attempts`, including status checks, foreign keys, `(product_id,ticket_no)`, active-entry partial uniqueness, active-grant partial uniqueness, and indexes for FIFO/expiry.
- Create an idempotent seed for one-unit, five-unit, and alternative products with stable UUIDs.
- Validate SQL syntax against PostgreSQL 17 when Docker is available and validate OpenAPI syntax.

### Task 2: Go platform runtime

Implement behavior test-first.

- Create one Go module and focused platform packages for config, database, HTTP errors/middleware, health handlers, routing, and shutdown.
- Tests must first fail for config defaults/validation, request-ID propagation, panic recovery, JSON error envelopes, health 200, ready 200 with a healthy checker, ready 503 with a failing checker, and demo-auth rejection/identity propagation.
- Implement `api`, `worker`, and `migrate`. `api` exposes `/api/v1/health`, `/api/v1/ready`, internal `/metrics`, and `501` domain stubs. `worker` validates config/DB and runs a cancellable interval loop. `migrate` supports `up`, `version`, and idempotent `seed` using embedded SQL.
- Use GORM postgres for application connectivity, configure `database/sql` pool limits, and implement graceful shutdown.
- Add backend Dockerfile that produces a non-root runtime image containing all three binaries.

### Task 3: Minimal frontend

Implement behavior test-first.

- Create React 18 + TypeScript + Vite with TanStack Query, ESLint, Prettier, Vitest, and Testing Library.
- Write failing tests for Russian loading, ready, and recoverable error states; then implement a minimal readiness screen fetching `/api/v1/ready`.
- Add accessible refresh action, keyboard focus styles, responsive layout from 360px, and no domain-state computation.
- Add a multi-stage frontend Dockerfile and internal Nginx SPA config; run as non-root where supported.

### Task 4: Local orchestration and developer commands

- Add `.env.example` with non-secret development values and all backend/worker/pool settings.
- Add edge Nginx config that serves frontend, balances `api-1`/`api-2`, proxies `/api/`, and disables buffering/increases timeout for SSE.
- Add local `docker-compose.yml` with `postgres`, one-shot `migrate`, `api-1`, `api-2`, `worker`, `frontend`, and `nginx`; expose only `${APP_PORT:-8080}`.
- Add root `.golangci.yaml` for golangci-lint 2.12.2 with the agreed correctness/security linters.
- Add Make targets: `up`, `down`, `seed`, `fmt`, `fmt-check`, `lint`, `test`, `test-race`, `test-integration`, `build`, `smoke`, `logs`, `verify`. `verify` must not rewrite files.
- Smoke verification must cover UI/health/ready through edge Nginx and availability after stopping one API replica.

### Task 5: GitHub CI/CD, production deploy, and README

- Replace the legacy GitLab file with `.github/workflows/ci.yml` for pull requests and pushes to `main`: format/lint/test/race/build, OpenAPI/Compose/Nginx validation, migration integration, Docker build, and smoke.
- Add `.github/workflows/release.yml` for strict `vMAJOR.MINOR.PATCH` tags whose commit is contained in `main`. Re-run verification, publish public multi-arch backend/frontend images to the fixed GHCR names, and serialize production deploys.
- Add production Compose and idempotent Ubuntu bootstrap for user `avito-deploy`, Docker/Compose, `/opt/avito-fair-queue`, SSH key access, and UFW ports 22/80.
- Deploy using known-host verification and GitHub Environment values, write server `.env` as `0600`, then `pull`, `migrate up`, `up -d`, and retry readiness. On failure print bounded logs; do not auto-rollback DB.
- Rewrite README in Russian with architecture, FIFO rationale, local setup, commands, seed/demo flow, lint rationale, AI usage, GitHub secrets/variables, server bootstrap, tag release, logs, rollback limits, public URL placeholder, and HTTP-now/HTTPS-later limitation.
- Run all feasible verification and report any step blocked only by missing external secrets/server access.
