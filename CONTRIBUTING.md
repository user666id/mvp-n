# Разработка

Как собрать, запустить и поменять mvp-n локально. Устройство системы —
[ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Требования

- Go **1.22**
- Node.js **20**
- Docker + Docker Compose v2 (для полного стека)
- PostgreSQL 16 (или через compose)

---

## Локальный запуск

Удобнее всего — через [`Makefile`](./Makefile):

```bash
make frontend       # Mini App на моках (VITE_MOCK=1), бэкенд не нужен
make api            # собрать и запустить api
make connect        # connect
make awg-server     # awg-server
make bot            # бот в watch-режиме
make docker-up      # весь стек в Docker
make tidy           # go mod tidy во всех Go-модулях
```

**Mini App без бэкенда.** Самый быстрый цикл для UI:

```bash
cd frontend && npm install && npm run dev
```

`VITE_MOCK=1` (в `.env.development`) подменяет все API-вызовы на
[`src/api/mock.ts`](./frontend/src/api/mock.ts) — реальный сервер не требуется.

**Полный стек.** Скопируй [`.env.example`](./.env.example) → `.env`, заполни и:

```bash
docker compose up -d --build
```

Каждый сервис также имеет свой `.env.example` и README с инструкцией запуска.

---

## Стиль кода

- **Go:** обязателен `gofmt` (CI падает на неформатированных файлах) + `go vet`.
  Перед коммитом: `gofmt -w api connect awg-server`.
- **Тесты:** `go test ./...` в каждом Go-модуле (гоняется в CI). Локально под
  Go 1.26 линковка `api` падает на зависимости xray/sing — используй
  `GOTOOLCHAIN=go1.22.12 go test ./...` (Go сам скачает тулчейн 1.22).
- **Frontend/bot (TS):** должен проходить `tsc --noEmit`. Сборка фронта —
  `npm run build` (включает type-check).
- Тексты в Mini App — только через i18n (`t('key')`), без захардкоженных строк.

---

## CI

GitHub Actions на каждый push в `main` и PR:

| Workflow | Что проверяет |
|----------|---------------|
| **Lint** | `gofmt`, `go vet` + `go test` (api/connect/awg-server), `tsc --noEmit` (frontend) |
| **Build** | `go build` каждого сервиса, `npm run build` фронта |
| **Deploy** | по push в `main` — SSH на VPS, `git reset --hard` + `scripts/deploy.sh` |

> VPS тянет код с GitHub по read-only **deploy key** (SSH через порт 443:
> `ssh://git@ssh.github.com:443/...`), не по встроенному в remote токену.

> Go-модули обязаны иметь актуальный `go.sum` (`go mod tidy`) — иначе
> `go build` в CI падает с «missing go.sum entry».

---

## Коммиты и деплой

- Ветка по умолчанию — `main`. Push в неё триггерит автодеплой.
- Деплой пересобирает только изменившиеся сервисы; правки в `docs/`/README
  деплой не трогают.
- Секреты — только в `.env` (gitignore) и GitHub Actions Secrets. В репозиторий
  не коммитим токены, ключи, сертификаты.

---

## Изменения схемы БД

Отдельной системы миграций нет — схема описана idempotent-DDL в
[`api/internal/config/config.go`](./api/internal/config/config.go) и применяется при
старте api. Новые таблицы/колонки добавляй туда через `CREATE TABLE IF NOT EXISTS`
/ `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
