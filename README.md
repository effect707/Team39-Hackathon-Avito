# Авито «Честная очередь»

Хакатонный MVP строгой FIFO-очереди перед checkout для дефицитных товаров. Backend выдаёт временное персональное право на покупку, а после отказа, payment failure или истечения TTL передаёт единицу следующему участнику.

Backend Compose запускает PostgreSQL 17, SQL-migrator, worker и две API-реплики с реальными product/queue/SSE/checkout endpoints. React frontend собирается и запускается отдельно, по умолчанию обращается к backend API, а browser mock включается только явным frontend-режимом.

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

## Frontend

### Технологии

- **React 19 + TypeScript** — компонентный интерфейс и типизация моделей товаров, очереди, сессии и оплаты.
- **Vite 8** — dev-сервер, production-сборка, proxy `/api` на backend и отдельный mock-режим.
- **React Router 7** — маршрутизация между каталогом, карточкой товара, checkout, авторизацией и страницами ошибок.
- **Redux Toolkit** — глобальное состояние приложения.
- **RTK Query** — API-слой для товаров, очереди, checkout и demo-платежей.
- **Ant Design** — кнопки, модальные окна, skeleton/loading-состояния, рейтинг и уведомления.
- **Lucide React** — иконки таймера, статусов, геолокации, защиты очереди и результата оплаты.
- **CSS Modules** — локальная стилизация страниц, виджетов и feature-компонентов.
- **Roboto Variable и Inter** — шрифты через `@fontsource`.
- **Server-Sent Events** — realtime-уведомления об изменении состояния очереди.
- **Vitest + Testing Library** — unit-, компонентные и интеграционные тесты UI.
- **ESLint + Prettier** — статический анализ и единое форматирование.
- **Docker + Nginx** — production-сборка frontend и раздача статических файлов.

### Архитектура frontend

Frontend организован по принципам Feature-Sliced Design:

```text
src/
├── app/          # запуск приложения, providers, router, store, realtime
├── pages/        # страницы маршрутов
├── widgets/      # крупные самостоятельные блоки интерфейса
├── features/     # пользовательские сценарии
├── entities/     # бизнес-сущности и их API/model/UI
└── shared/       # общие API, UI, конфигурация и утилиты
```

- `app` инициализирует router, Redux Store, Ant Design и realtime-обработчики.
- `pages` собирает экраны из сущностей, виджетов и features.
- `widgets` содержит крупные блоки: header, footer, модальное окно очереди и уведомления.
- `features` реализует вход в очередь, demo-оплату, авторизацию и realtime-подписку.
- `entities` инкапсулирует предметные области `product`, `queue`, `grant`, `session` и `notification`.
- `shared` содержит базовый API-клиент, маршруты, форматирование цены, общие состояния загрузки и ошибок.

### Mock API

Изначально frontend разрабатывался на Mock API, чтобы не ждать готовности backend и параллельно проверять каталог, карточку товара, вход и выход из очереди, статусы, персональное право, checkout, demo-оплату, истечение grant, уведомления и realtime-обновления. Mock-слой имитирует HTTP-запросы и ключевые backend-сценарии:

- `frontend/mocks/mockBackend.ts` — имитация backend API;
- `frontend/mocks/mockBaseQuery.ts` — адаптер mock-запросов под RTK Query;
- `frontend/mocks/mockData.ts` — тестовые товары и пользователи;
- `frontend/mocks/mockSse.ts` — имитация realtime-событий;
- `frontend/mocks/config.ts` — выбор режима работы;
- `frontend/mocks/configureMockApi.ts` — подключение Mock API.

Основной пользовательский путь подключён к реальному backend API через `/api/v1`. Mock-режим сохранён для автономной разработки и демонстрации:

```bash
cd frontend
npm run mockapi
```

Альтернативный способ включения:

```bash
VITE_API_MODE=mock npm run dev
```

В обычном режиме frontend всегда работает с backend. Ошибка или недоступность реального API не подменяется mock-данными автоматически: интеграционные проблемы остаются видимыми.

### Особенности реализации

- Состояние отслеживаемых товаров хранится отдельно для каждого demo-пользователя.
- Сессия восстанавливается из `localStorage` по ключу `avito-fair-queue:session:v1`.
- Redux listener реагирует на `signedIn` и `signedOut`, сбрасывает RTK Query state и обновляет пользовательские уведомления.
- Идентификатор уведомления строится из товара, статуса и позиции/суффикса, что предотвращает дублирование событий.
- Модальное окно очереди загружается через `React.lazy` только при необходимости.
- Для `EXPIRED`, `PAYMENT_FAILED` и `SOLD_OUT` показываются альтернативные объявления.
- Статус товара учитывает lifecycle и соотношение проданных единиц к общему остатку.
- Backend остаётся источником истины: клиентский таймер и UI-решения не заменяют серверные проверки grant, TTL и checkout.
- Пользовательские сообщения, действия и статусы отображаются на русском языке.
- Для доступности используются `button`, `aria-label`, `role="timer"` и focus-состояния UI-компонентов.
- Общие `ErrorState`, `Loader`, `Skeleton`, retry-действия и сообщения Ant Design покрывают loading/error-состояния.
- В dev-режиме запросы к `/api` проксируются Vite на backend.

### Ответственность frontend

Frontend отвечает за каталог и карточки объявлений, альтернативы, demo-сессию, передачу demo-user ID, отображение и изменение состояния очереди, CTA для каждого состояния, позицию и ожидаемое время, grant и countdown, checkout и demo-оплату, SSE-подписку, уведомления, восстановление UI после reload/reconnect, loading/error/empty/terminal states, маршрутизацию, mock-режим, UI-тесты и production-сборку.

Frontend не является источником истины для FIFO-порядка, фактической позиции, распределения товарной единицы, срока действия grant, допуска к checkout, продажи, защиты от oversell, конкурентного исхода expiry/payment callback и идемпотентности backend-операций.

### Тестирование frontend

Тесты покрывают Redux slices, API endpoints и invalidation, mock backend и конфигурацию, маршрутизацию, lazy loading, SSE-парсинг и подключение, countdown, позицию и время ожидания, CTA очереди, доступность checkout, режим заказа, форматирование цены, карточку и страницу товара, заказ, уведомления и demo-оплату.

```bash
cd frontend
npm test
npm run lint
npm run format:check
npm run build
```

<details>
<summary>История разработки frontend</summary>
Всю историю можно посмотреть в pull requests

| Коммит    | Дата       | Основные изменения                                                                                            |
| --------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| `7848984` | 2026-08-07 | FSD-структура, маршрутизация, базовые страницы, API/SSE-инфраструктура, shared UI и конфигурация инструментов |
| `dea2467` | 2026-08-07 | Merge `main` в `FE-02`                                                                                        |
| `5b6c3f0` | 2026-08-07 | FSD, маршрутизация, API/SSE, базовые состояния, линтер и форматтер                                            |
| `6a0b56a` | 2026-08-07 | Форматирование CSS                                                                                            |
| `632c0b7` | 2026-08-07 | Удаление устаревших файлов и переход к новой структуре                                                        |
| `2253356` | 2026-08-07 | Исправление TypeScript-конфигурации                                                                           |
| `ea449e9` | 2026-08-07 | Дополнительное исправление `tsconfig`                                                                         |
| `a74d530` | 2026-08-07 | Исправление Dockerfile                                                                                        |
| `1a6a7ce` | 2026-08-08 | Ant Design, header/footer, карточка товара и каталог                                                          |
| `e464f73` | 2026-08-09 | Mock backend/SSE, тесты, FSD, авторизация, очередь, checkout, уведомления, страницы и стили                   |
| `c431e61` | 2026-08-09 | Исправление теста и UI авторизации                                                                            |
| `882115d` | 2026-08-10 | Реальный backend API, endpoints, модели, queue watch, SSE, Docker/Nginx и frontend README                     |
| `81732cb` | 2026-08-10 | Merge `dev` в `FE-03`                                                                                         |

</details>

## Локальный запуск

Нужны Docker Engine с Compose plugin, Go 1.26.4, Node.js 22.14+ и npm 10.9+. Для `make lint` нужен `golangci-lint` 2.12.2:

```bash
GOTOOLCHAIN=go1.26.4 go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.12.2
cp .env.example .env
make up
make seed
```

Во втором терминале запустите frontend:

```bash
cd frontend
npm ci
npm run dev
```

Откройте `http://localhost:5173`. Vite проксирует `/api/v1` на первую API-реплику по адресу `http://localhost:8080`. Для автономного просмотра интерфейса без backend используйте `npm run mockapi`; это отдельный browser mock, а не проверка серверной FIFO-логики.

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

## Demo-сценарии

### 1. Успешная покупка

1. Откройте Fujifilm X100V и зарегистрируйте demo-пользователя. Регистрация локальная и нужна только для UUID в `X-Demo-User-ID`.
2. Нажмите «Встать в очередь». При свободной единственной единице пользователь получает временное право со статусом `GRANTED`.
3. До окончания countdown перейдите к checkout и выберите результат `success`.
4. Убедитесь, что заявка перешла в `PURCHASED`, а единица больше не выдаётся другим пользователям.

### 2. Строгий FIFO и передача единицы

1. Откройте Fujifilm X100V в двух браузерных профилях и войдите под разными demo-пользователями.
2. Первый пользователь встаёт в очередь и получает `GRANTED`; второй встаёт после него и получает `WAITING`.
3. У первого пользователя выберите payment-результат `failure` или `timeout`. Единица освободится. Альтернативно дождитесь истечения TTL — grant освободит worker.
4. Убедитесь, что право получает именно второй пользователь с минимальным `ticket_no`. SSE сигнализирует об изменении, после чего frontend перечитывает REST-state.

### 3. Reload и reconnect

1. Встаньте в очередь и запомните отображаемый статус.
2. Перезагрузите страницу или кратковременно отключите сеть.
3. После восстановления соединения убедитесь, что UI вернул состояние через REST, а повторные SSE-события не создали дубликаты уведомлений и не изменили FIFO-порядок.

### 4. Автономная демонстрация frontend

1. Не запуская backend, выполните `cd frontend && npm run mockapi`.
2. Откройте `http://localhost:5173` и пройдите каталог, очередь, grant, checkout, demo-оплату и терминальные состояния.
3. Используйте этот режим только для демонстрации UI: серверные FIFO, oversell и конкурентные гарантии проверяются в обычном режиме с PostgreSQL.

Быстрая проверка backend без UI:

```bash
curl http://localhost:8080/api/v1/products
curl -X POST \
  -H 'X-Demo-User-ID: 40000000-0000-4000-8000-000000000001' \
  http://localhost:8080/api/v1/products/10000000-0000-4000-8000-000000000001/queue/join
```

Публичная full-stack ссылка пока не опубликована. Production workflow и Compose разворачивают backend; frontend публикуется отдельным образом. Актуальные ограничения и короткий план доведения до сдачи — в [`docs/MISSING_BACKEND_METHODS.md`](docs/MISSING_BACKEND_METHODS.md).

## Команды

| Команда                 | Назначение                                                                     |
| ----------------------- | ------------------------------------------------------------------------------ |
| `make up`               | собрать и запустить Compose                                                    |
| `make down`             | остановить без удаления данных                                                 |
| `make seed`             | повторно безопасно загрузить demo-товары                                       |
| `make fmt`              | отформатировать Go и frontend                                                  |
| `make lint`             | golangci-lint, ESLint                                                          |
| `make test`             | Go unit и Vitest                                                               |
| `make test-race`        | Go race detector                                                               |
| `make test-integration` | миграции/seed/constraints и конкурентный FIFO-сценарий на чистом PostgreSQL 17 |
| `make build`            | production Go и Vite builds                                                    |
| `make smoke`            | health/ready обеих API-реплик и доступность `api-2` после остановки `api-1`    |
| `make logs`             | последние compose-логи                                                         |
| `make verify`           | format-check, lint, unit/race/integration, contracts/configs и builds          |

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

| Тип      | Имя                      | Значение                                      |
| -------- | ------------------------ | --------------------------------------------- |
| secret   | `DEPLOY_HOST`            | IPv4 сервера                                  |
| secret   | `DEPLOY_SSH_PRIVATE_KEY` | приватный ключ `avito-deploy`                 |
| secret   | `DEPLOY_KNOWN_HOSTS`     | проверенная known-hosts строка сервера        |
| secret   | `POSTGRES_PASSWORD`      | 24–128 символов `A-Z`, `a-z`, `0-9`, `_`, `-` |
| variable | `DEPLOY_USER`            | `avito-deploy`                                |
| variable | `DEPLOY_PATH`            | `/opt/avito-fair-queue`                       |

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

- Нет Redis, Kafka, Kubernetes, настоящей авторизации, платежей и AI-интеграций.
- Demo deployment работает по IPv4/HTTP; domain, DNS и TLS — отдельная задача.
- Основной demo-path и критические FIFO/promotion/checkout/expiry/idempotency-сценарии проверяются на настоящем PostgreSQL; browser-level SSE reconnect остаётся отдельной frontend-проверкой.
- Production workflow разворачивает backend без публичного frontend и без единого балансирующего URL для двух API-реплик.
- Поиск, глобальное восстановление SSE-подписок, load generator и остальные известные пробелы перечислены в [`docs/MISSING_BACKEND_METHODS.md`](docs/MISSING_BACKEND_METHODS.md).

## Использование ИИ

Команда использовала AI-ассистентов для проработки архитектуры, каркаса Go/React, SQL constraints, тестов, CI/CD и документации. Контракты, FIFO-инварианты, миграции, безопасность деплоя и результаты тестов проверяются разработчиками перед merge/release.

Пользовательские и production-данные, SSH-ключи, пароли и GitHub secrets не отправляются во внешние AI-сервисы. В самом продукте AI-интеграции нет.
