# connect — subscription service

> Lightweight short-link service for VPN clients. On every request it parses
> the User-Agent → detects the device/client and updates `devices.last_seen`.

**Port:** `3000` · **Language:** Go 1.26

---

## What the server returns

```http
GET /to/abc123def
↓
HTTP/1.1 200 OK
Profile-Title:            mvp-n
Profile-Update-Interval:  12
Profile-Web-Page-URL:     https://t.me/mvp_n_net_bot
Support-URL:              https://t.me/mvp_n_net_bot
Subscription-Userinfo:    upload=180000000000; download=162000000000; total=0; expire=0
Content-Type:             text/plain

vless://uuid@89.x.x.x:43000/?type=tcp&security=reality&...#🇳🇱 Netherlands
```

---

## Device accounting

On every subscription request, `connect` asynchronously updates the record in the `devices` table:

### 1. User-Agent parsing

| Example UA | We detect |
|-----------|-----------|
| `Happ/1.5.2 (iPhone; iOS 17.6.1; iPhone 13 Pro; ru-RU)` | iPhone 13 Pro · iOS 17.6.1 |
| `v2RayTun/2.0 (iPad; iOS 16.5)` | iPad · iOS 16.5 |
| `NekoBox/Android 1.3 (SM-A366B; Android 15)` | SM-A366B · Android 15 |
| `V2Box/3.5 (Windows)` | V2Box (Windows) |
| _unknown_ | "Unknown device" |

Supported clients: **Happ, v2RayTun, V2Box, Streisand, NekoBox, Shadowrocket, Amneziya**.

### 2. Writing to the DB

```sql
INSERT INTO devices (user_id, name, client, ip, device_uid, last_seen)
VALUES ($1, 'iOS', 'v2RayTun', '188.130.x.x', NULL, NOW())
```

Then it's simply an `UPDATE last_seen` on the next request from the same device.
IP geolocation is not tracked — through a VPN tunnel the IP does not reflect the
device's real location.

---

## Endpoints

```
# Public
GET /to/:id          — VLESS URI + metadata + device registration
GET /health          — healthcheck

# Admin (Bearer ADMIN_TOKEN)
POST   /admin/configs       — create/update a record
DELETE /admin/configs/:id   — deactivate (will return 404 in the future)
```

---

## Environment variables

```env
PORT=3000
DATABASE_URL=postgres://mvpn:mvpn@localhost:5432/mvpn?sslmode=disable
ADMIN_TOKEN=secret

PROFILE_TITLE=mvp-n
UPDATE_HOURS=12
SUPPORT_URL=https://t.me/mvp_n_net_bot
```

---

## Running

```bash
cd connect
cp .env.example .env
go mod tidy
go run .
```
