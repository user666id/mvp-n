# API — endpoints (актуально по `api/main.go`)

> REST API проекта. Mini App, бот и connect/ общаются с ним. Источник правды —
> роутер в [`api/main.go`](../api/main.go); этот файл описывает его 1:1.

---

## Основы

```
Base URL:  https://gw.mvp-n.net
Auth:      Authorization: Bearer <JWT>        (JWT выдаётся POST /auth/token)
Internal:  X-Internal-Token: <ADMIN_TOKEN>    (для /internal/*)

Успех:
{ "status": true,  "statusCode": 200, "data": { ... } }

Ошибка:
{ "status": false, "statusCode": 400, "errorCode": "BAD_REQUEST", "message": "…" }
```

Аутентификация по `initData` Telegram: `POST /auth/token` проверяет подпись
`initData` ботом и возвращает JWT; защищённые ручки требуют `Bearer <JWT>`.
Админ-ручки дополнительно проверяют, что Telegram-ID входит в `ADMIN_TG_IDS`.

---

## Публичные / без JWT

```
GET  /health                  → liveness
GET  /health/deep             → проверка БД и зависимостей
GET  /public/status           → публичный статус сервера (status-page удалён; эндпоинт оставлен)
GET  /to/{id}                 → plain-text VLESS-подписка по короткому ID
                                (или .conf для AmneziaWG); зовёт connect/
POST /auth/token              → initData → JWT
```

## Внутренние (`X-Internal-Token: ADMIN_TOKEN`)

```
POST /internal/provision      → выдать per-device VLESS-UUID (зовёт connect/)
GET  /internal/user-lang?tg_id=…  → язык, выбранный в Mini App (для бота)
```

---

## Авторизация / активация (JWT)

```
POST /auth/key                → активировать ключ доступа (TTL 12 ч)
```

## /configs — конфиги (JWT)

```
GET    /configs                       → список конфигов пользователя
POST   /configs                       → создать конфиг (VLESS / AmneziaWG)
GET    /configs/{id}                  → детали конфига
DELETE /configs/{id}                  → удалить (отзывает xray-юзера / AWG-пира)
PATCH  /configs/{id}/title            → переименовать
PATCH  /configs/{id}/settings         → сменить режим (enhanced / game_mode)
GET    /configs/{id}/serverStats      → метрики сервера (CPU/RAM/сеть)
GET    /configs/{id}/awgStats         → статистика AmneziaWG-пира
GET    /configs/{id}/subconfig        → доп. конфиг
POST   /configs/{id}/subconfig        → создать доп. конфиг
PATCH  /configs/{id}/subconfig        → изменить доп. конфиг
DELETE /configs/{id}/subconfig        → удалить доп. конфиг
```

## /profile — профиль и устройства (JWT)

```
GET    /profile                       → аккаунт (id, internal_id, трафик, лимиты)
GET    /profile/devices               → устройства (VLESS + AmneziaWG-пиры)
PATCH  /profile/devices/{id}/name     → переименовать устройство
POST   /profile/devices/{id}/block    → заблокировать
POST   /profile/devices/{id}/unblock  → разблокировать
DELETE /profile/devices/{id}          → удалить устройство
PATCH  /profile/subscriptionLink      → полный сброс: удаляет ВСЕ конфиги и
                                        устройства (VLESS + AmneziaWG)
PATCH  /profile/device-limit          → лимит устройств (0 = без лимита)
PATCH  /profile/language              → сохранить язык UI ('en'|'ru');
                                        читается ботом через /internal/user-lang
DELETE /profile                       → удалить аккаунт и все конфиги
```

## /admin — только для `ADMIN_TG_IDS` (JWT + проверка ID)

```
POST   /admin/keys                            → выпустить ключи доступа
GET    /admin/keys                            → список ключей
DELETE /admin/keys/{id}                       → отозвать ключ
GET    /admin/profiles                        → список профилей (+трафик, счётчики)
GET    /admin/profiles/{id}                   → профиль по tg_id / internal_id
GET    /admin/profiles/{id}/devices           → устройства профиля (VLESS + AWG)
DELETE /admin/profiles/{id}/devices/{did}     → удалить устройство профиля
POST   /admin/profiles/{id}/block             → бан/разбан профиля
DELETE /admin/profiles/{id}                   → удалить профиль (purge xray + БД)
```

---

## Учёт устройств

**VLESS.** При опросе подписки connect/ дергает `POST /internal/provision`:
каждому (лаунчер + ОС) выдаётся отдельный xray-UUID (`devices.vpn_uuid`),
поэтому в списке видно каждое устройство — его можно переименовать/заблокировать.
Онлайн оценивается по приросту трафика из xray gRPC (`last_active`).

**AmneziaWG.** Один конфиг = один пир. Устройства AWG отображаются из активных
`vpn_configs (protocol='awg')`, статус/онлайн берётся из `awg-server`
(`/clients/{id}` → handshake), клиент всегда «AmneziaVPN».

---

## Стек

```
Язык:   Go 1.22 (net/http, ServeMux с методами и {param})
БД:     PostgreSQL 16 (схема — api/internal/config/config.go, миграции идемпотентны)
Auth:   JWT (HS256) + Telegram WebApp initData
VPN:    xray gRPC :10085 (AddUser/RemoveUser/GetStats); awg-server HTTP :8080
Cron:   сбор метрик сервера и трафика (api/internal/cron)
```
