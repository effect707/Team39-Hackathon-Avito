# Авито «Честная очередь»

Хакатонный MVP строгой FIFO-очереди перед checkout для дефицитных товаров. Backend выдаёт временное персональное право на покупку, а после отказа, payment failure или истечения TTL передаёт единицу следующему участнику.

Сейчас backend walking skeleton запускает PostgreSQL 17, SQL-migrator, worker и две API-реплики. Доменные queue/allocation/checkout handlers пока стабированы ответом `501 NOT_IMPLEMENTED` и зарегистрированы по фиксированному OpenAPI-контракту. Frontend собирается и публикуется отдельно, но не входит в backend Compose.

## Источники истины

1. [`docs/spec.md`](docs/spec.md) — продуктовые сценарии, state machine и Definition of Done.
2. [`docs/openapi.yaml`](docs/openapi.yaml) — публичный HTTP API v1.
3. [`backend/migrations`](backend/migrations) — версионируемая схема PostgreSQL.
4. [`AGENTS.md`](AGENTS.md) — обязательные инварианты и правила разработки.

Исходный кейс сохранён в [`docs/reference/case-2.pdf`](docs/reference/case-2.pdf).

## Архитектура

```text
React frontend (отдельный build/deploy)
   │ configured API URL
   ▼
api-1 :8080 ───────────┐
                       ├── PostgreSQL 17
api-2 :8081 ───────────┘        ▲
                           worker + migrator
```

Backend — модульный монолит на Go. PostgreSQL — единственный источник истины для остатка, FIFO-порядка, права на checkout и TTL. Две API-реплики и worker не делят process-memory state. Строгий FIFO определяется минимальным `ticket_no`, а не `created_at` и не случайным розыгрышем.

API-реплики публикуются напрямую на разных портах, без прозрачной балансировки или failover одного URL. `/metrics` обслуживается отдельным listener на `:9090` только внутри compose-сети. SSE отдаётся Go API напрямую; событие лишь сигнализирует frontend перечитать REST-state.

## Локальный запуск

Нужны Docker Engine с Compose plugin, Go 1.26.4, Node.js 22.14+ и npm 10.9+. Для `make lint` нужен `golangci-lint` 2.12.2:

```bash
GOTOOLCHAIN=go1.26.4 go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.12.2
cp .env.example .env
make up
make seed
```

После запуска:

- api-1 liveness: `http://localhost:8080/api/v1/health`;
- api-1 readiness PostgreSQL: `http://localhost:8080/api/v1/ready`;
- api-2 liveness: `http://localhost:8081/api/v1/health`;
- api-2 readiness PostgreSQL: `http://localhost:8081/api/v1/ready`.

Порты реплик настраиваются через `API_1_PORT` и `API_2_PORT`, внутренний listener метрик — через `METRICS_ADDRESS`. Frontend этим Compose не запускается. PostgreSQL и metrics-listeners не публикуются на host. `make down` останавливает стенд, но не удаляет volume с данными.

Seed идемпотентен и создаёт:

- Fujifilm X100V с одной единицей;
- PlayStation 5 с пятью единицами;
- Sony A6400, Fujifilm XF 23mm и Xbox Series X как альтернативы.

В demo-режиме бизнес-запросы передают UUID тестового пользователя только в `X-Demo-User-ID`. `user_id` в JSON не принимается. Для curl-сценариев можно использовать `40000000-0000-4000-8000-000000000001`.

## Команды

| Команда | Назначение |
|---|---|
| `make up` | собрать и запустить Compose |
| `make down` | остановить без удаления данных |
| `make seed` | повторно безопасно загрузить demo-товары |
| `make fmt` | отформатировать Go и frontend |
| `make lint` | golangci-lint, ESLint |
| `make test` | Go unit и Vitest |
| `make test-race` | Go race detector |
| `make test-integration` | миграции/seed/constraints на чистом PostgreSQL 17 |
| `make build` | production Go и Vite builds |
| `make smoke` | health/ready обеих API-реплик и доступность `api-2` после остановки `api-1` |
| `make logs` | последние compose-логи |
| `make verify` | format-check, lint, unit/race/integration, contracts/configs и builds |

`make verify` не переформатирует исходники. Интеграционный тест использует отдельный compose-project и свой временный volume; общая локальная БД не очищается.

## Линтеры

Backend проверяется golangci-lint 2.12.2 с `errcheck`, `govet`, `ineffassign`, `staticcheck`, `unused`, `bodyclose`, `errorlint`, `gosec`, `noctx`, `sqlclosecheck`, `misspell` и `revive`. В `revive` точечно отключено только правило `exported`: Go-пакеты сейчас внутренние, а декоративные doc-comments противоречат правилам читаемости. Других exclusions нет.

Frontend проверяется ESLint, Prettier, TypeScript, Vitest и React Testing Library. Lockfile обязателен; `npm audit` для production и dev dependencies должен завершаться без vulnerabilities.

## CI и release

`.github/workflows/ci.yml` запускается на pull request и push в `main`: устанавливает фиксированные Go/Node/linter, выполняет `make verify`, затем Compose smoke с двумя API-репликами. Все actions закреплены immutable commit SHA.

Release принимает только тег `vMAJOR.MINOR.PATCH`, чей commit входит в `main`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Workflow повторяет `make verify`, собирает `linux/amd64` и `linux/arm64`, публикует точный тег:

- `ghcr.io/effect707/team39-hackathon-avito-backend:<tag>`;
- `ghcr.io/effect707/team39-hackathon-avito-frontend:<tag>`.

Публикация идёт через repository `GITHUB_TOKEN` с `packages: write`. После самой первой публикации владелец один раз выставляет обоим Container packages видимость **Public** в GitHub Package settings. `GITHUB_TOKEN` не используется для недокументированного изменения visibility. Dockerfiles содержат OCI source label, поэтом packages автоматически связываются с репозиторием.

## Ubuntu deployment

Первичная цель — `http://<IPv4>` без домена и TLS. HTTPS настраивается отдельно после получения домена.

Создайте отдельную SSH-пару для deploy и один раз запустите bootstrap от root/sudo:

```bash
sudo AVITO_DEPLOY_SSH_PUBLIC_KEY='ssh-ed25519 AAAA...' bash deploy/scripts/bootstrap-server.sh
```

Скрипт идемпотентно:

- устанавливает Docker Engine и Compose plugin из официального Docker-репозитория для Ubuntu;
- создаёт `avito-deploy`, `authorized_keys` и `/opt/avito-fair-queue`;
- открывает UFW 22/tcp и 80/tcp;
- не меняет пароль и SSH-настройки существующего аварийного account. Его пароль не передаётся в GitHub.

В GitHub Environment `production` задайте:

| Тип | Имя | Значение |
|---|---|---|
| secret | `DEPLOY_HOST` | IPv4 сервера |
| secret | `DEPLOY_SSH_PRIVATE_KEY` | приватный ключ `avito-deploy` |
| secret | `DEPLOY_KNOWN_HOSTS` | проверенная known-hosts строка сервера |
| secret | `POSTGRES_PASSWORD` | 24–128 символов `A-Z`, `a-z`, `0-9`, `_`, `-` |
| variable | `DEPLOY_USER` | `avito-deploy` |
| variable | `DEPLOY_PATH` | `/opt/avito-fair-queue` |

Fingerprint host key для `DEPLOY_KNOWN_HOSTS` нужно сверить через консоль хостера или другой доверенный канал; не принимайте непроверенный `ssh-keyscan` как доказательство подлинности.

Деплой копирует backend Compose и script, пишет `.env` с mode `0600`, временно авторизует сервер в GHCR через job-scoped `GITHUB_TOKEN`, выполняет `pull`, `migrate`, `up -d` и readiness retry обеих реплик, затем удаляет временные файлы и делает `docker logout`. `api-1` публикуется на порту 80, а `api-2` доступна только через `127.0.0.1:8081`; прозрачного failover нет. Production concurrency-group не пускает два деплоя одновременно. При ошибке workflow печатает не более 120 строк логов на сервис и завершается failed.

Логи на сервере:

```bash
cd /opt/avito-fair-queue
docker compose --env-file .env -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.prod.yml logs --tail=200 api-1 api-2 worker
```

Автоматического rollback миграций нет. Приложение можно вернуть на прошлый совместимый `IMAGE_TAG`, но откат схемы выполняется только после ручного анализа и backup.

## Ограничения MVP

- FIFO/allocation/checkout/SSE business logic ещё не подключены: их endpoints возвращают стаб `501`.
- Нет Redis, Kafka, Kubernetes, настоящей авторизации, платежей и AI-интеграций.
- Demo deployment работает по IPv4/HTTP; domain, DNS и TLS — отдельная задача.
- Добавление доменной логики требует конкурентных интеграционных тестов на настоящем PostgreSQL.

## Использование ИИ

Команда использовала AI-ассистентов для проработки архитектуры, каркаса Go/React, SQL constraints, тестов, CI/CD и документации. Контракты, FIFO-инварианты, миграции, безопасность деплоя и результаты тестов проверяются разработчиками перед merge/release.

Пользовательские и production-данные, SSH-ключи, пароли и GitHub secrets не отправляются во внешние AI-сервисы. В самом продукте AI-интеграции нет.
