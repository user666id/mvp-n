# api — REST API

> Центральный сервис проекта. Mini App, бот и подписки работают через него;
> он же провижинит пользователей в xray (gRPC) и AmneziaWG (HTTP к awg-server).

**Порт:** `8081` · **Язык:** Go 1.22 · **Публичный адрес:** `https://gw.mvp-n.net`

---

## Запуск

```bash
cd api
cp .env.example .env   # заполни переменные (см. ниже)
go mod tidy
go run .
```

---

## Структура

```
api/
├── main.go                     # роутер (net/http ServeMux), запуск, graceful shutdown
└── internal/
    ├── config/config.go        # env-конфиг, пул БД, миграции (idempotent schema)
    ├── middleware/
    │   ├── auth.go             # JWT-проверка (Authorization: Bearer)
    │   └── admin.go            # доступ только для ADMIN_TG_IDS
    ├── handlers/
    │   ├── handlers.go        # общие типы Response, writeJSON/writeError
    │   ├── auth.go            # /auth/token (initData→JWT), /auth/key
    │   ├── configs.go         # CRUD конфигов, buildURI (VLESS), сабконфиги
    │   ├── profile.go         # профиль, устройства, лимит, язык, удаление
    │   ├── provision.go       # /internal/provision — per-device по HWID
    │   ├── admin.go           # ключи доступа (создать/список/отозвать)
    │   ├── admin_profiles.go  # профили/устройства/трафик, домены
    │   ├── public.go          # /public/status, /to/{id}
    │   ├── health.go          # /health, /health/deep
    │   └── health_helpers.go  # tcp/http-пробы
    ├── cron/cron.go           # метрики, traffic, reconcile xray, чистки
    ├── xray/client.go         # gRPC: AddUser / RemoveUser / GetTraffic
    ├── awg/client.go          # HTTP-клиент к awg-server
    └── metrics/collector.go   # CPU/RAM/сеть (host sysfs) → server_metrics
```

---

## Эндпоинты

### Публичные (без JWT)
```
GET  /health                 — liveness
GET  /health/deep            — БД + зависимости
GET  /public/status          — статус серверов
GET  /to/{id}                — VLESS-подписка (запасной путь; основной — connect)
POST /auth/token             — Telegram initData → JWT
```

### Internal (заголовок `X-Internal-Token: ADMIN_TOKEN`)
```
POST /internal/provision     — выдать per-device конфиг по HWID (зовёт connect)
GET  /internal/user-lang     — язык пользователя (читает бот для приветствия)
```

### Авторизованные (JWT) — конфиги
```
POST   /auth/key                       — активация ключа доступа
GET    /configs                        — список конфигов
POST   /configs                        — создать (vless / awg)
GET    /configs/{id}                   — детали
DELETE /configs/{id}                   — удалить
PATCH  /configs/{id}/title             — переименовать
PATCH  /configs/{id}/settings          — сменить режим (enhanced / game)
GET    /configs/{id}/serverStats       — графики CPU / RAM / сеть
GET    /configs/{id}/awgStats          — статистика AmneziaWG-пира
GET    /configs/{id}/subconfig         — доп. конфиг
POST   /configs/{id}/subconfig         — создать доп. конфиг
PATCH  /configs/{id}/subconfig         — сменить
DELETE /configs/{id}/subconfig         — удалить
```

### Авторизованные (JWT) — профиль
```
GET    /profile                        — данные аккаунта
GET    /profile/devices                — устройства
PATCH  /profile/devices/{id}/name      — переименовать устройство
POST   /profile/devices/{id}/block     — заблокировать
POST   /profile/devices/{id}/unblock   — разблокировать
DELETE /profile/devices/{id}           — удалить устройство
PATCH  /profile/subscriptionLink       — сбросить ссылку подписки
PATCH  /profile/device-limit           — лимит устройств
PATCH  /profile/language               — язык (en / ru)
DELETE /profile                        — удалить аккаунт
```

### Админ (JWT + ADMIN_TG_IDS)
```
POST   /admin/keys                                  — создать N ключей
GET    /admin/keys                                  — список ключей
DELETE /admin/keys/{id}                             — отозвать ключ
GET    /admin/domains                               — статусы доменов
GET    /admin/profiles                              — профили + трафик (всего/сегодня)
GET    /admin/profiles/{id}                         — профиль
GET    /admin/profiles/{id}/devices                 — устройства профиля
GET    /admin/profiles/{id}/configs                 — конфиги профиля
PATCH  /admin/profiles/{id}/reset                   — сбросить подписку
POST   /admin/profiles/{id}/block                   — блок/разблок профиля
DELETE /admin/profiles/{id}                         — удалить профиль
POST   /admin/profiles/{id}/devices/{did}/block     — блок устройства
POST   /admin/profiles/{id}/devices/{did}/unblock   — разблок устройства
DELETE /admin/profiles/{id}/devices/{did}           — удалить устройство
```

Полное описание — [`docs/api.md`](../docs/api.md).

---

## Формат ответов

```json
// Успех
{ "status": true, "statusCode": 200, "data": { ... } }

// Ошибка
{ "status": false, "statusCode": 400, "errorCode": "INVALID_KEY", "message": "..." }
```

---

## Переменные окружения

См. [`.env.example`](./.env.example). Ключевые: `DATABASE_URL`, `JWT_SECRET`,
`BOT_TOKEN`, `ADMIN_TG_IDS`, `ADMIN_TOKEN`, `AWG_API_URL`/`AWG_API_TOKEN`,
`XRAY_API_HOST`/`XRAY_API_PORT`, `SERVER_IP`/`XRAY_PUBLIC_KEY`/`XRAY_SHORT_ID`.

---

## База данных

Таблицы создаются автоматически при старте (idempotent-миграции в `config.go`):

| Таблица | Описание |
|---------|----------|
| `users` | Пользователи (Telegram ID, internal_id, traffic_used, lang) |
| `access_keys` | Ключи доступа (TTL, used_by) |
| `vpn_configs` | VPN-конфиги (vless / awg, режимы) |
| `subconfigs` | Доп. конфиги |
| `devices` | Устройства (HWID, модель, last_seen, traffic_seen) |
| `server_metrics` | CPU/RAM/сеть, семплы каждые 10 мин |
| `traffic_daily` | Трафик по дням (граница 00:00 МСК) |
