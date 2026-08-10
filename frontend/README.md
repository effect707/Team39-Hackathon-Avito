# Frontend «Авито Честная очередь»

React/Vite frontend по умолчанию работает с реальным API через `/api/v1`. В dev-режиме Vite проксирует `/api` на edge Nginx по адресу `http://localhost:8080`.

```bash
npm ci
npm run dev
```

Для автономной UI-разработки остаётся явный mock-режим:

```bash
npm run mockapi
```

Переменные сборки:

- `VITE_API_MODE=mock` — включить browser mock backend;
- `VITE_API_URL` — переопределить базовый URL, по умолчанию `/api/v1`.

Проверки:

```bash
npm test
npm run lint
npm run format:check
npm run build
```
