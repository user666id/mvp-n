<div align="center">

# mvp-n.net

A private VPN that lives entirely inside Telegram.
VLESS + REALITY and AmneziaWG · console in a Mini App · access via one-time keys or a paid subscription.

[Status](./STATUS.md) · [Roadmap](./ROADMAP.md) · [Documentation](./docs/README.md)

</div>

## What it is

The user opens a Telegram bot, taps a single button — and lands in the
mini-app (console): activates an access key, creates a VPN config (VLESS or
AmneziaWG), gets a subscription link / `.conf` / QR, installs the config into the app in
one tap, manages their devices, switches the config mode and language. The owner,
through the same console, issues keys and views profiles and traffic.

The key principle — **web and VPN are separated**. The bot, API and subscriptions go behind Cloudflare
and the nginx SNI router; the VPN traffic itself goes directly to xray/AmneziaWG over IP:port,
without a domain and without Cloudflare on the path.

## Features

- **VLESS + REALITY** in three modes: Normal (Vision/TCP), Reinforced (XHTTP, disguised as HTTPS), Gaming (minimal latency).
- **AmneziaWG** — WireGuard with obfuscation, import into AmneziaVPN via `.conf` + QR.
- **One-tap connection** — pick a client and import the subscription via web-redirect.
- **Paid access** — one-time keys or a paid subscription (7 / 30 / 90 / 365 days); pay in crypto (GRAM / USDT on TON or TRC20) or Telegram Stars, one-tap from a TON wallet via TON Connect.
- **Per-HWID device accounting** — each device is separate on a single link, with its real model; block and rename one at a time.
- **Owner console** — keys, profiles, traffic (total / today in MSK), domain statuses.
- **Server charts** — CPU / RAM / network in real units.
- **Mini App** — Claude-style design, EN/RU, system-driven theme, haptic feedback.

## Architecture

Management (web) — behind Cloudflare and the nginx SNI router on `:443`:

```text
User → bot → Mini App ──initData → JWT──► Cloudflare → nginx :443 (SNI)
                                               ├─► api :8081 ──gRPC :10085─► xray
                                               │             └─HTTP :8080──► awg-server
                                               └─► connect :3000
                                       api · connect ──► PostgreSQL
```

VPN traffic — clients connect directly to the host, bypassing Cloudflare and nginx:

```text
VPN clients ──TCP :43000 / :43001 (REALITY)───────► xray        directly,
            ──UDP :51820 (WireGuard + obfuscation)─► AmneziaWG   bypassing CF & nginx
```

### Ports

| Port | Service | Access |
|------|--------|--------|
| `443` | nginx SNI router (web) | public, behind Cloudflare |
| `43000` | xray · VLESS REALITY + Vision (TCP) | public, direct |
| `43001` | xray · VLESS REALITY + XHTTP | public, direct |
| `51820/udp` | AmneziaWG | public, direct |
| `8443` | nginx http (web-domain backend) | local |
| `8081` | api | local |
| `3000` | connect (subscriptions) | local |
| `8080` | awg-server | local |
| `10085` | xray gRPC API | docker bridge only |
| `5432` | PostgreSQL | local |

## VPN: protocols and modes

VLESS + REALITY (Xray) — two inbounds, the mode is chosen when creating a config:

| Mode | Inbound | Transport | Purpose |
|-------|---------|-----------|------------|
| Normal | `:43000` | TCP · REALITY + Vision | Balance of speed and stability |
| Reinforced | `:43001` | TCP · REALITY + XHTTP | Maximum censorship circumvention |
| Gaming | `:43000` | TCP · REALITY (no Vision) | Minimal latency |

AmneziaWG (WireGuard + obfuscation) — UDP `:51820`, managed by `awg-server`. Issued as
`.conf` + QR, imported via AmneziaVPN. By design: 1 config = 1 device. High
speed, but some providers throttle UDP.

### Device accounting (per HWID)

For VLESS, each physical device is identified by Remnawave HWID headers —
`X-Hwid` / `X-Device-Model` / `X-Device-Os` (sent by v2RayTun ≥2.3.5, Happ,
Streisand, Hiddify), or by the install-id in the User-Agent for Happ. Each device
gets its own xray-UUID (`/internal/provision`) on a single shared subscription link; in
the list you see the real model ("iPhone 14 Pro Max", "SM-A366B"), and each can be
blocked and renamed individually. For AmneziaWG, one config = one peer.

### Access

One-time activation keys (TTL 12 h) are issued by the owner; console login — via
Telegram `initData`, exchanged for a JWT.

## Modules

| Folder | Description | Technology |
|-------|----------|-----------|
| [`api/`](./api) | REST API — auth, configs, profile, devices, admin, cron, gRPC to xray, provisioning | Go 1.26 |
| [`connect/`](./connect) | Subscription service `/to/:id` — per-device VLESS subscription | Go 1.26 |
| [`awg-server/`](./awg-server) | AmneziaWG peer management (create/delete/enable/disable/stats) | Go + `awg` CLI |
| [`bot/`](./bot) | Telegram bot — `/start` → Mini App button, language sync | TypeScript (grammY) |
| [`frontend/`](./frontend) | Mini App, Claude-style design, i18n EN/RU | React 18 · TS · Tailwind · Vite |
| [`scripts/`](./scripts) | VPS install/setup (xray, AmneziaWG, XanMod, nginx) | Bash |
| [`nginx/`](./nginx) | SNI router `:443` + reverse proxy for web domains | nginx |
| [`docs/`](./docs) | Documentation (API, auth-flow, deploy, SSL) | Markdown |

Docker services (`docker-compose.yml`): `postgres` (5432), `api` (8081),
`connect` (3000), `awg-server` (8080), `bot` (long polling), `db-backup`
(daily `pg_dump` with 7d / 4w / 6m rotation).

## Domains

| Domain | Purpose | Cloudflare |
|-------|-----------|------------|
| `cdn.mvp-n.net` | REST API (→ :8081) | proxied |
| `app.mvp-n.net` | Mini App | proxied |
| `connect1.mvp-n.net` | Subscriptions `/to/:id` | proxied |

VPN traffic does not use a domain — the client connects via IP:port.

## Stack

| Layer | Technologies |
|------|-----------|
| Backend | Go 1.26 · PostgreSQL 16 · JWT · gRPC to xray |
| Bot | TypeScript (Node 20) · grammY · long polling |
| Frontend | React 18 · TypeScript · Tailwind · Vite |
| VPN | Xray VLESS+REALITY (`:43000` / `:43001`) · AmneziaWG (`:51820`) |
| Infra | nginx (ssl_preread SNI) · Docker Compose · XanMod + BBR3 |
| CI | GitHub Actions — lint · build · test · security |
| Deploy | pull model: a systemd timer on the VPS polls the `release` branch every 2 min |

Tested versions: Ubuntu 22.04 LTS, Docker Compose v2, PostgreSQL 16, Go 1.26,
Node.js 20, XanMod kernel + BBR3. Xray-core and AmneziaWG are installed by `scripts/install/*`.

## Configuration

All environment variables are collected in [`.env.example`](./.env.example) (DB, JWT, bot
token, REALITY keys, AmneziaWG token, etc.). Real values live only in
`.env` on the VPS (in `.gitignore`) — there are no secrets in the repository.

## Deploy and backup

Deploy — pull model: on the VPS a systemd timer polls GitHub every 2 min and on a
new commit on the **`release`** branch runs [`scripts/deploy.sh`](./scripts/deploy.sh) —
rebuilds only the changed services, reconciles the stack when compose changes,
syncs the built Mini App. Committing/pushing to `main` is safe (nothing deploys);
ship to production with `git push origin main:release`. (GitHub Actions cannot reach
the VPS — the host's DDoS protection throttles CI runners.) More details —
[`docs/deploy.md`](./docs/deploy.md).

Backup: the `db-backup` service makes a daily `pg_dump` with rotation (7d / 4w / 6m) into the
Docker volume `db_backups`. Restore — unpack the dump and feed it into the `psql` of
the `mvpn-postgres` container.

## Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — internals: flows, authorization, provisioning, traffic
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — local run, code style, CI, deploy
- [`docs/README.md`](./docs/README.md) — documentation map
- [`STATUS.md`](./STATUS.md) · [`ROADMAP.md`](./ROADMAP.md) · [`CHANGELOG.md`](./CHANGELOG.md) — status, plan, version history
- Modules: [`api`](./api/README.md) · [`connect`](./connect/README.md) · [`awg-server`](./awg-server/README.md) · [`bot`](./bot/README.md) · [`frontend`](./frontend/README.md) · [`nginx`](./nginx/README.md) · [`scripts`](./scripts/README.md)

## License

Copyright (C) 2026 mvp-n.net — [GNU AGPL-3.0](./LICENSE).

The code is open for transparency. AGPL means: you may study, modify and
self-host it, but if you run a modified version as a network service — you are
required to publish the source of your changes under the same license.

> **Public mirror.** A sanitized, read-only snapshot of mvp-n, published for transparency.
> Secrets, the origin server IP and the receiving wallet addresses are replaced with
> placeholders (`<origin-ip>`, `YOUR_TON_WALLET_ADDRESS`, `YOUR_TRON_WALLET_ADDRESS`).
> The project is developed in a private repo; issues/PRs here are not actively monitored.
