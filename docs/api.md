# API — endpoints (current as of `api/main.go`)

> The project's REST API. The Mini App, the bot, and connect/ talk to it. Source of
> truth — the router in [`api/main.go`](../api/main.go); this file describes it 1:1.

---

## Basics

```
Base URL:  https://gw.mvp-n.net
Auth:      Authorization: Bearer <JWT>        (JWT issued by POST /auth/token)
Internal:  X-Internal-Token: <per-service>    (for /internal/*; constant-time)

Success:
{ "status": true,  "statusCode": 200, "data": { ... } }

Error:
{ "status": false, "statusCode": 400, "errorCode": "BAD_REQUEST", "message": "…" }
```

Authentication via Telegram `initData`: `POST /auth/token` verifies the
`initData` signature with the bot and returns a JWT (HS256, 30 days); protected
handlers require `Bearer <JWT>`. Admin handlers additionally check that the
Telegram ID is in `ADMIN_TG_IDS`.

**JWT revocation.** The owner is checked on every authorized request: tokens of
blocked users are rejected everywhere, of deleted users — everywhere except
`/auth/key` (so they can re-activate). Secret rotation — via
`JWT_SECRET_PREVIOUS` (the old secret is accepted for verification only).

**Rate limiting.** `/auth/token` (60/min, burst 30) and `/auth/key` (20/min,
burst 10) are limited by IP (token bucket) — protection against key brute-forcing;
exceeding it → `429`.

---

## Public / no JWT

```
GET  /health                  → liveness
GET  /health/deep             → DB and dependencies check
GET  /public/status           → public server status (status-page removed; endpoint kept)
GET  /to/{id}                 → plain-text VLESS subscription by short ID
                                (or .conf for AmneziaWG); calls connect/
POST /auth/token              → initData → JWT
```

## Internal (`X-Internal-Token`, per-service token)

```
POST /internal/provision      → issue a per-device VLESS-UUID (connect/; token INTERNAL_TOKEN_CONNECT)
GET  /internal/user-lang?tg_id=…  → language chosen in the Mini App (bot; token INTERNAL_TOKEN_BOT)
```
Comparison is constant-time; both tokens fall back to the legacy `ADMIN_TOKEN` if not set.

---

## Authorization / activation (JWT)

```
POST /auth/key                → activate an access key (TTL 12 h)
```

## /configs — configs (JWT)

```
GET    /configs                       → list of the user's configs
POST   /configs                       → create a config (VLESS / AmneziaWG)
GET    /configs/{id}                  → config details
DELETE /configs/{id}                  → delete (revokes the xray user / AWG peer)
PATCH  /configs/{id}/title            → rename
PATCH  /configs/{id}/settings         → change mode (enhanced / game_mode)
GET    /configs/{id}/serverStats      → server metrics (CPU/RAM/network)
GET    /configs/{id}/awgStats         → AmneziaWG peer statistics
```

## /profile — profile and devices (JWT)

```
GET    /profile                       → account (id, internal_id, traffic, limits)
GET    /profile/devices               → devices (VLESS + AmneziaWG peers)
PATCH  /profile/devices/{id}/name     → rename device
POST   /profile/devices/{id}/block    → block
POST   /profile/devices/{id}/unblock  → unblock
DELETE /profile/devices/{id}          → delete device
PATCH  /profile/subscriptionLink      → full reset: deletes ALL configs and
                                        devices (VLESS + AmneziaWG)
PATCH  /profile/device-limit          → device limit (0 = no limit)
PATCH  /profile/language              → save UI language ('en'|'ru');
                                        read by the bot via /internal/user-lang
DELETE /profile                       → delete account and all configs
```

## /admin — `ADMIN_TG_IDS` only (JWT + ID check)

```
POST   /admin/keys                                  → issue access keys
GET    /admin/keys                                  → list of keys
DELETE /admin/keys/{id}                             → revoke a key
GET    /admin/domains                               → domain statuses
GET    /admin/traffic?days=N                         → server traffic by day (1..90, def 30) + total
GET    /admin/profiles                              → list of profiles (+traffic, counters)
GET    /admin/profiles/{id}                         → profile by tg_id / internal_id
GET    /admin/profiles/{id}/devices                 → profile devices (VLESS + AWG)
GET    /admin/profiles/{id}/configs                 → profile configs
PATCH  /admin/profiles/{id}/reset                   → reset the profile's subscription
POST   /admin/profiles/{id}/block                   → ban/unban a profile
DELETE /admin/profiles/{id}                         → delete profile (purge xray + DB)
POST   /admin/profiles/{id}/devices/{did}/block     → block device
POST   /admin/profiles/{id}/devices/{did}/unblock   → unblock device
DELETE /admin/profiles/{id}/devices/{did}           → delete a profile device
```

---

## Device accounting

**VLESS.** When polling the subscription, connect/ hits `POST /internal/provision`:
each (launcher + OS) is issued a separate xray-UUID (`devices.vpn_uuid`),
so every device is visible in the list — it can be renamed/blocked.
Online status is estimated from traffic growth via xray gRPC (`last_active`).

**AmneziaWG.** One config = one peer. AWG devices are shown from active
`vpn_configs (protocol='awg')`, status/online is taken from `awg-server`
(`/clients/{id}` → handshake), the client is always "AmneziaVPN".

---

## Stack

```
Language:  Go 1.22 (net/http, ServeMux with methods and {param})
DB:        PostgreSQL 16 (schema — api/internal/config/config.go, migrations are idempotent)
Auth:      JWT (HS256) + Telegram WebApp initData
VPN:       xray gRPC :10085 (AddUser/RemoveUser/GetStats); awg-server HTTP :8080
Cron:      collection of server and traffic metrics (api/internal/cron)
```
