# Architecture

An in-depth description of how mvp-n is built: how web and VPN are separated, what
the data flows are, and how authorization, device provisioning, and traffic
accounting work. For an overview and diagrams, see the [README](./README.md).

---

## Two independent planes

The core principle of the system is that the **control plane (web) and the data
plane (VPN) are physically separated**.

- **Control plane** — the bot, Mini App, API, subscriptions. It sits behind
  Cloudflare and the nginx SNI router on `:443`. All the logic lives here: keys,
  configs, profiles.
- **Data plane** — the actual VPN traffic. Clients connect **directly** to xray
  (`:43000` / `:43001`) and AmneziaWG (`:51820/udp`) by IP, bypassing Cloudflare and
  nginx. The port is baked into the subscription / `.conf`.

Why this way: Cloudflare does not pass arbitrary TCP/UDP, and REALITY/WireGuard
must go to the server directly. The separation also hides the web's origin IP
behind CF, while the VPN stays fast (no extra hop) and independent of the web
infrastructure.

---

## Routing on :443 (SNI)

nginx in `stream` mode reads the SNI from the ClientHello **without decrypting it**
(`ssl_preread`) and forwards by host name:

| SNI | Destination |
|-----|-----------|
| `gw` / `app` / `connect.mvp-n.net` | internal nginx http `:8443` → api / static / connect |
| anything else (`www.microsoft.com` etc.) | `127.0.0.1:2443` — a stub with no listener (probe into the void) |

The web domains are behind Cloudflare (proxied); their TLS is terminated by the
internal http server on `:8443` using the Cloudflare Origin Cert. **VPN traffic does
not go through `:443`/nginx** — clients connect directly to xray
`:43000`/`:43001`; `default → :2443` in the stream config currently has no listener
(unwanted SNI hits a closed port). For details, see
[`nginx/README.md`](./nginx/README.md).

---

## Authorization flow

```
Mini App  ──initData──►  POST /auth/token
                          │  verify the initData signature with the BOT_TOKEN key
                          ▼
                         JWT  ──►  stored in localStorage, sent as Bearer
```

1. Telegram gives the Mini App a signed `initData`.
2. The API verifies the HMAC signature of `initData` with the secret derived from
   `BOT_TOKEN` → extracts the Telegram ID, creates/finds the user, issues a JWT.
3. The first login requires activating a **one-time key** (`POST /auth/key`, TTL 12 h),
   which is issued by the owner.

For more, see [`docs/auth-flow.md`](./docs/auth-flow.md).

---

## Device provisioning (by HWID)

A single subscription link serves all of a user's devices, but **each physical
device gets its own xray UUID** — this enables per-device blocking, statistics, and
the real model name in the list.

```
Client (v2RayTun/Happ) ──GET /to/{id}──► connect
   headers X-Hwid / X-Device-Model / X-Device-Os (Remnawave HWID)
        │
        ▼
   connect ──POST /internal/provision──► api
        api: finds/creates a devices record by HWID,
             issues a device UUID, registers it in xray (gRPC AddUser)
        │
        ▼
   connect returns a VLESS URI with this UUID
```

If the HWID headers are absent, it falls back to the install-id from the
User-Agent (Happ). For AmneziaWG the model is simpler: 1 config = 1 peer.

---

## Traffic accounting

xray counts bytes per user. A cron in api (`internal/cron`) polls xray once a minute
(`GetTraffic`) and:

- adds the **positive delta** to `users.traffic_used` (a monotonic counter that
  survives device deletion and xray restarts);
- uses the delta to determine which devices are **online** (counter grew → active);
- accumulates the same delta into `traffic_daily` by **Moscow** days (00:00 MSK) —
  this is where "Traffic, today" in the admin panel comes from.

Server metrics (CPU/RAM/network) are collected by a separate cron every 10 minutes
from the host sysfs (api is mounted `/sys:/host/sys:ro`, node-exporter-style).

---

## Components

| Component | Where it lives | Role |
|-----------|-----------|------|
| **bot** | Docker | `/start` → Mini App button, language sync |
| **frontend** | nginx static `/v2/` | Mini App (console) |
| **api** | Docker | all the logic, gRPC to xray, HTTP to awg-server, cron |
| **connect** | Docker | serves subscriptions, registers devices |
| **awg-server** | Docker (host net) | manages AmneziaWG peers on `awg0` |
| **postgres** | Docker | state |
| **db-backup** | Docker | daily dumps |
| **xray** | host (systemd) | VLESS+REALITY inbounds |
| **AmneziaWG** | host (kernel) | WireGuard+obfuscation |
| **nginx** | host | SNI router + reverse proxy |

xray and AmneziaWG are deliberately **outside Docker** — they need direct access to
the host network and the kernel (REALITY on low ports, the WireGuard kernel module).
They are managed over gRPC/HTTP from the Docker services via `host.docker.internal`.

---

## Data

The schema is created by idempotent migrations at api startup
(`internal/config/config.go`); there is no separate migration system. Tables:
`users`, `access_keys`, `vpn_configs`, `devices`, `server_metrics`, `traffic_daily`.
For a description of the fields, see [`api/README.md`](./api/README.md).

---

## Deploy

Pull model: a systemd timer on the VPS polls GitHub every 2 min and, on a new commit
on the **`release`** branch, does `git reset --hard origin/release` +
[`scripts/deploy.sh`](./scripts/deploy.sh), which rebuilds **only the changed**
services (by diffing paths), reconciles the stack when compose changes, and syncs
the built frontend. (Push deploy is impossible — the host's DDoS protection cuts off
GitHub's CI runners.) xray/AmneziaWG/nginx live on the host and are installed once by
the scripts in [`scripts/install`](./scripts/install). For details, see
[`docs/deploy.md`](./docs/deploy.md).

Committing/pushing to `main` is safe — nothing deploys; production ships only when
the `release` branch advances (`git push origin main:release`).
