SHELL := /bin/bash

GO_CACHE := $(CURDIR)/.cache/go-build
LINT_CACHE := $(CURDIR)/.cache/golangci-lint
GO := env GOTOOLCHAIN=go1.26.4 GOCACHE="$(GO_CACHE)" go
GOLANGCI_LINT_VERSION := 2.12.2
COMPOSE := docker compose

.PHONY: up down seed fmt fmt-check lint lint-backend lint-frontend test test-race test-integration build validate smoke logs verify check-tools

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down --remove-orphans

seed:
	$(COMPOSE) run --rm migrate seed

fmt:
	find backend -type f -name '*.go' -exec gofmt -w {} +
	cd frontend && npm run format

fmt-check:
	@unformatted="$$(find backend -type f -name '*.go' -exec gofmt -l {} +)"; \
		if [[ -n "$$unformatted" ]]; then printf '%s\n' "$$unformatted"; exit 1; fi
	cd frontend && npm run format:check

check-tools:
	@command -v golangci-lint >/dev/null || { echo "golangci-lint $(GOLANGCI_LINT_VERSION) is required"; exit 1; }
	@golangci-lint version | grep -Fq "version $(GOLANGCI_LINT_VERSION)" || { golangci-lint version; echo "golangci-lint $(GOLANGCI_LINT_VERSION) is required"; exit 1; }

lint: lint-backend lint-frontend

lint-backend: check-tools
	cd backend && GOCACHE="$(GO_CACHE)" GOLANGCI_LINT_CACHE="$(LINT_CACHE)" golangci-lint run --config ../.golangci.yaml ./...

lint-frontend:
	cd frontend && npm run lint

test:
	cd backend && $(GO) test ./...
	cd frontend && npm test

test-race:
	cd backend && $(GO) test -race ./...

test-integration:
	bash tools/test-integration.sh

build:
	cd backend && $(GO) build ./cmd/api ./cmd/worker ./cmd/migrate
	cd frontend && npm run build

validate:
	ruby tools/validate-openapi-examples.rb
	$(COMPOSE) config -q
	POSTGRES_PASSWORD=verify IMAGE_TAG=v0.0.0 $(COMPOSE) -f docker-compose.prod.yml config -q
	docker run --rm --add-host api-1:127.0.0.1 --add-host api-2:127.0.0.1 --add-host frontend:127.0.0.1 -v "$(CURDIR)/deploy/nginx/edge.conf:/etc/nginx/conf.d/default.conf:ro" nginx:1.27-alpine nginx -t
	tools/check-release.sh v0.0.0 HEAD HEAD
	@if tools/check-release.sh v0.0 HEAD HEAD >/dev/null 2>&1; then exit 1; fi
	@if tools/check-release.sh v0.0.0 HEAD $$(git rev-list --max-parents=0 HEAD) >/dev/null 2>&1; then exit 1; fi

smoke:
	bash tools/smoke.sh

logs:
	$(COMPOSE) logs --tail=200 -f

verify: fmt-check lint test test-race test-integration validate build
