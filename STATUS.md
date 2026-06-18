# Project status

What is implemented and running in production. Plans — [ROADMAP.md](./ROADMAP.md).

## VPN

### VLESS + REALITY (Xray)

- Two inbounds side by side, switching mode without restarting xray:
  - `:43000` — VLESS + REALITY + Vision, TCP (Normal; Gaming — the same inbound without Vision-flow);
  - `:43001` — VLESS + REALITY + XHTTP (Reinforced, masquerading as HTTPS, `mode=packet-up`).
- One UUID is registered in both inbounds — mode switching is instant.
- REALITY `dest=www.microsoft.com:443`, SNI in the URI is empty.
- gRPC management API on `:10085`, bound to the docker bridge (not on the public interface) + UFW deny from outside (AddUser / RemoveUser / GetStats).

### AmneziaWG

- `awg-server` (Go + `awg` CLI) manages peers: create / delete / enable / disable / statistics (handshake, RX/TX, online).
- UDP `:51820`, WireGuard + obfuscation (Jc/Jmin/Jmax/S1/S2/H1-H4).
- Provides a `.conf` + QR, import into AmneziaVPN. One config = one peer.

## Subscriptions

- `GET /to/{short_id}` builds the VLESS-URI on the fly from flags in the DB (port and transport change together with the mode). For AmneziaWG it returns a `.conf`.
- Per-device provisioning by HWID: each physical device is a separate record with its own xray-UUID on a single shared link. Identity is taken from Remnawave HWID headers (`X-Hwid`, `X-Device-Model`, `X-Device-Os`; sent by v2RayTun ≥2.3.5, Happ, Streisand, Hiddify) or from the install-id in the User-Agent for Happ. The real device model is shown; each device can be managed separately (`POST /internal/provision`).
- Used traffic is returned in `Subscription-Userinfo` — visible in any launcher.

## API (Go 1.22)

- **Auth:** Telegram `initData` → JWT; access via one-time keys (TTL 12 h).
- **Configs:** create (VLESS / AWG), list, details, rename, mode, delete, server metrics, AWG statistics.
- **Profile:** account, devices (VLESS + AWG), device renaming/block/unblock/delete, device limit, subscription reset (full cleanup of configs and devices), UI language, account deletion.
- **Admin:** key issuance/list/revoke, profiles (+traffic total/today), profile card, profile devices, block/unblock, profile deletion.
- **Internal:** `/internal/provision` (connect→api), `/internal/user-lang` (bot→api). A token per service (`INTERNAL_TOKEN_CONNECT`/`INTERNAL_TOKEN_BOT`), constant-time comparison.
- **Cron:** collection of `server_metrics` (CPU/RAM/network) and traffic (xray gRPC → `users.traffic_used`, daily aggregate `traffic_daily` by MSK).

## Security

- Constant-time comparison of all internal tokens; a separate token per service.
- Rate limiting by IP on `/auth/token` (60/min) and `/auth/key` (20/min) — protection against key brute-forcing.
- JWT revocation: on every request the owner is checked (blocked/deleted ones are cut off), despite the token's 30-day lifetime. Secret rotation via `JWT_SECRET_PREVIOUS`.
- Parameterized SQL, HMAC signature verification of `initData`, device limit under row locking (no race), unique device index.
- nginx: HSTS, `X-Content-Type-Options`, CSP `frame-ancestors` (Telegram), `client_max_body_size`. Containers under CPU/RAM limits, Go services not running as root.
- Tests: User-Agent parser, `initData` verification, traffic accounting, JWT rotation — run in CI (`go test ./...`).

## Mini App (React 18 + TS + Tailwind)

- Claude-style design; i18n EN/RU (EN by default, language sync with the bot); theme by system, haptic feedback.
- Config creation: location, protocol (VLESS / AmneziaWG), modes (Normal / Reinforced / Gaming).
- Config card: spec, subscription link / `.conf` + QR, install into the app (client selection via web-redirect), server charts, modes.
- Devices tab (VLESS + AmneziaWG): renaming, block/unblock, delete; stable numbering by date added.
- Admin panel: keys (issue/revoke), profiles (search, subscription reset, config list, device block), traffic (total / today), domains.
- Server charts (CPU / RAM on a 0–100% scale / network with host-NIC in auto units).

## Infrastructure

- Docker Compose: postgres, api, connect, awg-server, bot, db-backup (daily `pg_dump` with rotation).
- nginx `:443` (ssl_preread SNI router) + Cloudflare Origin Cert. VPN traffic goes past nginx, directly to xray/AmneziaWG.
- CI: GitHub Actions (lint + `go test` + build + security scanners). Deploy is a pull model: a systemd timer on the VPS polls GitHub every 2 min and, on a new commit to `main`, runs `scripts/deploy.sh` (rebuilding only the changed services, reconciling the stack when compose changes). The VPS pulls the code over a read-only SSH deploy key (port 443); Actions cannot connect to the VPS — the host's DDoS protection blocks CI runners.
- Bot `@mvp_n_net_bot`: `/start` → Mini App button; private chats only; language synced with the app.

## Limitations

- Online status is counted by the growth of the traffic counter. Behind a single NAT phones share the external IP, so there is no exact "per-device" online status.
- AmneziaWG: one config = one peer (multi-device — planned).

## Network diagram

```text
VPN:  client → IP :43000 (TCP+Vision) / :43001 (XHTTP) / :51820 (AmneziaWG UDP)
            → xray / awg on the host → internet

Sub:  Happ / v2RayTun → connect.mvp-n.net/to/{id} → connect → api :8081 → VLESS-URI / .conf

App:  Telegram → app.mvp-n.net/v2/ (React) → gw.mvp-n.net (api :8081) → JWT → API
```
