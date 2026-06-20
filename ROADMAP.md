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
- Paid subscriptions & payments: crypto (GRAM / USDT-TON / USDT-TRC20, matched by a unique amount), Telegram Stars, and one-tap TON Connect; live GRAM/USD rate; "Subscription" pane — status, renewal and payment history.
- Admin panel: keys (issue/revoke), profiles (search, subscription reset, list of configs, device blocking), traffic (total / today), domains.
- Unified design system (1.9): green for status + charts, orange for actions/promo, accent-outline selectors, neutral info capsules; centred titles, circle coin icons, smoother loading; theme by system, haptic feedback. Plus a guided per-launcher install flow (OS dropdown → 3-step page), a TON-wallet connect/disconnect in the payment pane, a home-screen subscription banner, and an optional Fragment-style blue theme.
- Bot: private chats only, language sync with the app.
- Infrastructure: db-backup with rotation, xray log rotation, stack reconciliation on deploy, CPU/RAM limits on containers, auto-deploy via SSH-deploy-key.
- Security (v1.2): constant-time tokens, separate internal tokens, auth rate limiting, JWT revocation + secret rotation, xray API on the docker bridge, nginx security headers.
- Tests: User-Agent parser, `initData`, traffic accounting, JWT rotation — in CI.

## In progress / pending

- **More crypto via Heleket ("Other cryptocurrency").** USDT-TRC20 and additional
  coins paid through Heleket invoices + webhook, alongside the self-custody GRAM /
  USDT-TON / Stars (which stay). **Blocked on merchant credentials** (Merchant UUID
  + API key); the bot's domain was verified through its Telegram profile. Then: a Go
  Heleket client (create invoice + MD5 `sign`), `POST /orders/heleket`,
  `POST /heleket/webhook` (idempotent, signature-checked), and an "Other crypto"
  method in the frontend.
- **Bot "Open" launcher cross-client.** The chat menu button is now configured in
  BotFather (the API-set web_app button didn't render on every client). Verify it
  shows "Open" everywhere after a client cache refresh; revisit if Telegram changes
  the behaviour.

## Plans — product

| Feature | Summary |
|------|------|
| RU cards & СБП via Platega | Card / СБП / crypto acquiring for RU users (researched: pay-per-transaction, no monthly minimum, no legal entity required). |
| More TON jettons | NOT, MAJOR (and similar) as one-tap TON Connect options, priced live via tonapi — same flow as the existing USDT-TON. |
| Multiple devices on a single AmneziaWG config | "add device" → separate peer / `.conf` under the same config |
| Additional protocols | Trojan, Hysteria 2, Shadowsocks 2022 |

## Plans — infrastructure and quality

- Notifications via the bot (subscription expiry, news).
- TON Connect return strategy (`twaReturnUrl`) so the wallet (e.g. Tonkeeper)
  returns to the Mini App after signing.
