# Roadmap

What's done and what's planned. Current state — [STATUS.md](./STATUS.md).

## Done

- VLESS + REALITY: Vision/TCP `:43000` (Standard), XHTTP `:43001` (Enhanced), without Vision-flow (Gaming). The subscription rebuilds the URI on the fly from the flags.
- AmneziaWG end-to-end: `awg-server`, peer provisioning and revocation, `.conf` + QR, import into AmneziaVPN, statistics (handshake / online).
- Mini App on React 18 + TS + Tailwind (Claude-style), i18n EN/RU with language sync with the bot.
- Devices tab (VLESS + AmneziaWG): rename, block/unblock, delete.
- Device recognition by HWID: every physical device is a separate entry on one shared link, showing the real model, with stable numbering by date.
- Server charts (CPU / RAM / network); used traffic in the subscription.
- Subscription reset — full cleanup of all configs and devices.
- Admin panel: keys (issue/revoke), profiles (search, subscription reset, list of configs, device blocking), traffic (total / today), domains.
- Claude-style design: pill buttons, "value on the right", unified empty states, segmented language switcher, theme by system, haptic feedback.
- Bot: private chats only, language sync with the app.
- Infrastructure: db-backup with rotation, xray log rotation, stack reconciliation on deploy, CPU/RAM limits on containers, auto-deploy via SSH-deploy-key.
- Security (v1.2): constant-time tokens, separate internal tokens, auth rate limiting, JWT revocation + secret rotation, xray API on the docker bridge, nginx security headers.
- Tests: User-Agent parser, `initData`, traffic accounting, JWT rotation — in CI.

## Plans — product

| Feature | Summary |
|------|------|
| Multiple devices on a single AmneziaWG config | "add device" → separate peer / `.conf` under the same config |
| Additional protocols | Trojan, Hysteria 2, Shadowsocks 2022 |

## Plans — infrastructure and quality

- Notifications via the bot (expiration, news).
