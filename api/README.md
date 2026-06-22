# api — REST API

> The project's central service. The Mini App, bot, and subscriptions all work through it;
> it also provisions users into xray (gRPC) and AmneziaWG (HTTP to awg-server).

**Port:** `8081` · **Language:** Go 1.26 · **Public address:** `https://gw.mvp-n.net`

---

## Running

```bash
cd api
cp .env.example .env   # fill in the variables (see below)
go mod tidy
go run .
```

---

## Structure

```
api/
├── main.go                     # router (net/http ServeMux), startup, graceful shutdown
└── internal/
    ├── config/config.go        # env config, DB pool, migrations (idempotent schema)
    ├── middleware/
    │   ├── auth.go             # JWT verification (Authorization: Bearer)
    │   └── admin.go            # access only for ADMIN_TG_IDS
    ├── handlers/
    │   ├── handlers.go        # shared Response types, writeJSON/writeError
    │   ├── auth.go            # /auth/token (initData→JWT), /auth/key
    │   ├── configs.go         # config CRUD, buildURI (VLESS)
    │   ├── profile.go         # profile, devices, limit, language, deletion
    │   ├── provision.go       # /internal/provision — per-device by HWID
    │   ├── admin.go           # access keys (create/list/revoke)
    │   ├── admin_profiles.go  # profiles/devices/traffic, domains
    │   ├── public.go          # /public/status, /to/{id}
    │   ├── health.go          # /health, /health/deep
    │   └── health_helpers.go  # tcp/http probes
    ├── cron/cron.go           # metrics, traffic, reconcile xray, cleanups
    ├── xray/client.go         # gRPC: AddUser / RemoveUser / GetTraffic
    ├── awg/client.go          # HTTP client for awg-server
    └── metrics/collector.go   # CPU/RAM/network (host sysfs) → server_metrics
```

---

## Endpoints

### Public (no JWT)
```
GET  /health                 — liveness
GET  /health/deep            — DB + dependencies
GET  /public/status          — server status
GET  /to/{id}                — VLESS subscription (fallback path; primary is connect)
POST /auth/token             — Telegram initData → JWT
```

### Internal (header `X-Internal-Token`, a token per service)
```
POST /internal/provision     — issue a per-device config by HWID (calls connect; token INTERNAL_TOKEN_CONNECT)
GET  /internal/user-lang     — user language (read by the bot; token INTERNAL_TOKEN_BOT)
```
Token comparison is constant-time. Both tokens fall back to legacy `ADMIN_TOKEN` if
the per-service ones are not set.

### Authorized (JWT) — configs
```
POST   /auth/key                       — activate an access key
GET    /configs                        — list configs
POST   /configs                        — create (vless / awg)
GET    /configs/{id}                   — details
DELETE /configs/{id}                   — delete
PATCH  /configs/{id}/title             — rename
PATCH  /configs/{id}/settings          — change mode (enhanced / game)
GET    /configs/{id}/serverStats       — CPU / RAM / network charts
GET    /configs/{id}/awgStats          — AmneziaWG peer statistics
```

### Authorized (JWT) — profile
```
GET    /profile                        — account data
GET    /profile/devices                — devices
PATCH  /profile/devices/{id}/name      — rename device
POST   /profile/devices/{id}/block     — block
POST   /profile/devices/{id}/unblock   — unblock
DELETE /profile/devices/{id}           — delete device
PATCH  /profile/subscriptionLink       — reset subscription link
PATCH  /profile/device-limit           — device limit
PATCH  /profile/language               — language (en / ru)
DELETE /profile                        — delete account
```

### Admin (JWT + ADMIN_TG_IDS)
```
POST   /admin/keys                                  — create N keys
GET    /admin/keys                                  — list keys
DELETE /admin/keys/{id}                             — revoke key
GET    /admin/domains                               — domain statuses
GET    /admin/traffic                                — server traffic by day (?days=N) + total
GET    /admin/profiles                              — profiles + traffic (total/today)
GET    /admin/profiles/{id}                         — profile
GET    /admin/profiles/{id}/devices                 — profile devices
GET    /admin/profiles/{id}/configs                 — profile configs
PATCH  /admin/profiles/{id}/reset                   — reset subscription
POST   /admin/profiles/{id}/block                   — block/unblock profile
DELETE /admin/profiles/{id}                         — delete profile
POST   /admin/profiles/{id}/devices/{did}/block     — block device
POST   /admin/profiles/{id}/devices/{did}/unblock   — unblock device
DELETE /admin/profiles/{id}/devices/{did}           — delete device
```

Full description — [`docs/api.md`](../docs/api.md).

---

## Response format

```json
// Success
{ "status": true, "statusCode": 200, "data": { ... } }

// Error
{ "status": false, "statusCode": 400, "errorCode": "INVALID_KEY", "message": "..." }
```

---

## Environment variables

See [`.env.example`](./.env.example). Key ones: `DATABASE_URL`, `JWT_SECRET`
(+ optional `JWT_SECRET_PREVIOUS` for rotation), `BOT_TOKEN`, `ADMIN_TG_IDS`,
`INTERNAL_TOKEN_CONNECT`/`INTERNAL_TOKEN_BOT` (+ legacy `ADMIN_TOKEN`),
`AWG_API_URL`/`AWG_API_TOKEN`, `XRAY_API_HOST`/`XRAY_API_PORT`,
`SERVER_IP`/`XRAY_PUBLIC_KEY`/`XRAY_SHORT_ID`.

---

## Database

Tables are created automatically on startup (idempotent migrations in `config.go`):

| Table | Description |
|---------|----------|
| `users` | Users (Telegram ID, internal_id, traffic_used, lang) |
| `access_keys` | Access keys (TTL, used_by) |
| `vpn_configs` | VPN configs (vless / awg, modes) |
| `devices` | Devices (HWID, model, last_seen, traffic_seen) |
| `server_metrics` | CPU/RAM/network, samples every 10 min |
| `traffic_daily` | Traffic by day (boundary 00:00 MSK) |
