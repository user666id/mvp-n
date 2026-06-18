# Changelog

All notable changes to the project. Format — [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versions — [SemVer](https://semver.org/).

## [1.8.0] — 2026-06-18

The 1.8 update is in progress (accumulating). So far:

### Added
- **Payment via Telegram Stars (#7).** The API mints an invoice link (`createInvoiceLink`,
  `XTR`, `provider_token` omitted, payload `uid:days:nonce` from the user's JWT) →
  `POST /stars/invoice`; the frontend opens it via `WebApp.openInvoice` and **polls the
  profile** for confirmation (we don't trust the callback). Bot (top-level
  `pre_checkout_query`, answered in memory within <10s) + `message:successful_payment` →
  `POST /internal/credit-subscription` (auth via `BotInternalToken`). Idempotency —
  the `star_payments` table keyed by `telegram_payment_charge_id`, insert+extend in one tx.
  The price is an integer number of stars (`StarsByDays`, **without ×100** — the main XTR money risk),
  with a test. `allowed_updates += pre_checkout_query`, `drop_pending_updates=false`.
  **Requires a live test** (the mock doesn't reproduce TON/openInvoice).
- Entering an access key is now possible at renewal too: "I have a key" in the
  "Subscription" panel (`SubscriptionSheet`), not only in the activating Configs block.

### Fixed
- **GRAM via wallet didn't open TON Connect.** `WalletPay`: for native
  GRAM without a connected wallet, `sendTransaction` threw an error (the modal didn't
  open). Now connect-first for all TON assets (`needConnect = !address`).

### Privacy
- **Stopped collecting the user's IP entirely.** `connect` captured the real public
  IP (CF-Connecting-IP / X-Real-IP / X-Forwarded-For) on every subscription request and
  wrote it to `devices.ip` (+ sent it to the api). Removed completely: `clientIP` deleted, `ip` is no longer
  sent to `/internal/provision`, not written to `devices`, stripped from the `profile`/
  `admin` output. The `devices.ip` column was dropped (`ALTER ... DROP COLUMN IF EXISTS ip`)
  — this also **purges already-collected IPs**. (The privacy policy didn't declare IP anyway.)

### Added
- **Consent at sign-in.** On `AuthScreen` — a checkbox "I accept the Terms and Privacy
  Policy" with links; sign-in is blocked until it's checked.

### Changed
- The bot's menu button (left of the input field) now shows the command menu with /start,
  rather than launching the Mini App directly (`setChatMenuButton` → `type: 'commands'`).
- The country flag (🇳🇱) was removed from server statistics.
- **The admin panel was moved into the main menu** (Drawer, at the bottom, admins only);
  removed from Settings. App fetches `is_admin` and renders `AdminSheet` at the top level.
- **Loading reliability.** A new `LoadError` (error + "Retry") instead of
  an endless skeleton/false "empty" on failure: `DevicesSheet` (showed
  a false "no devices"), `ServerStatsSheet`, `ConfigsScreen` (first failure).
  The API client already had a 12s timeout + GET retries + re-auth on 401.
- **Smoothness.** A soft fade-in of content (`@keyframes fade-in`, respects
  reduced-motion) on sheet bodies (`Sheet`) and screen roots.
- **Payment-method selection — one compact selector** instead of a row of 4 chips:
  a collapsed card (icon + asset + network + chevron) expands into a list of
  GRAM/TON · USDT/TON · USDT/TRC20 · Stars with a checkmark on the selected one (`pickerOpen`
  in `SubscribeSheet`). The Stars price is shown in stars (`starsByDays`).
- **Asset icons.** GRAM — the updated "gem" after the rebrand (`assets/coins/
  gram.svg`, interim recreation — replace with the official file when available); Stars —
  a gold star with a gradient on a blue disc (`CurrencyIcon`). Fixed
  kebab-case SVG attributes in JSX (`stopColor`/`strokeWidth`/`strokeLinejoin`) —
  otherwise the star's gradient/stroke wouldn't apply.

### Legal / GDPR
- **The Privacy Policy** (RU+EN, `public/legal.js`) was expanded with sections:
  no analytics/trackers, legal basis (art. 6(1)(b) — contract,
  6(1)(f) — legitimate interest), retention periods (account lifetime; payments up to
  3 years), where data is processed (servers in the EU; tonapi/trongrid — only
  public on-chain data), data subject rights (access/rectification/erasure/
  portability/objection; account deletion in the app; other requests →
  @mvp_n_net_bot; right to lodge a complaint with a supervisory authority). **Without the controller's
  name/email** — for now (requires a legal entity/decision, not code).
- **Terms of Use** (RU+EN): payment — crypto or Telegram Stars; a digital
  service — a waiver of the 14-day right of withdrawal (Directive
  2011/83/EU): by paying, the user expressly requests the service to start immediately and
  acknowledges the loss of the right of withdrawal; non-refundable after activation.
- **Confirmation in the interface.** At the payment confirmation step — a mandatory
  checkbox (`pay.withdrawalConsent`): consent to immediate start + waiver of the
  14-day right; it blocks all three payment methods (`disabled={!consent}`).

### UI & assets
- **Payment-method picker is now an anchored dropdown** — the list unfolds from
  the selector row itself (absolute overlay + tap-outside backdrop) instead of a
  separate block that pushed the plans down (`SubscribeSheet`).
- **No method is preselected.** The selector starts on a "Choose payment"
  placeholder (`pay.choose`); the plan durations show immediately but each plan's
  **price is hidden until a method is chosen** (prices are currency-dependent),
  and Continue is disabled until then.
- **Official payment icons.** GRAM now uses the official post-rebrand mark from
  ton.org brand assets (`assets/coins/gram.svg`); Telegram Stars uses the
  official telegram-tt star geometry recoloured to the Stars gold
  (`assets/coins/stars.svg`), rendered via `<img>` (replaces the hand-drawn SVG).
- **Sign-in consent is now implicit** — the `AuthScreen` checkbox is gone; the
  policy notice + links remain and "by signing in you agree" is the consent
  (`auth.agreePre/agreeAnd/agreePost`).

### Docs, licenses & language
- **Full third-party license list** under About → Licenses, grouped by area
  (Mini App, Telegram bot, Backend (Go), VPN core & proxy, Infrastructure,
  Fonts) — covers Xray-core (MPL-2.0), uTLS/REALITY, quic-go, AmneziaWG/
  WireGuard, nginx, OpenSSL, PostgreSQL, Docker, TON Connect, etc. (was 8 items,
  mostly frontend). Sourced via a license audit across `package.json`/`go.mod`.
- **English by default.** App UI already defaults to English; legal docs now
  open English-first (RU via the on-page switch) and the bot's open-app console
  message is always English. Repository docs translated to English.

## [1.7.0] — 2026-06-16

Payment via **TON Connect** (Telegram Wallet, Tonkeeper) for GRAM — one-tap payment
from the wallet instead of a manual transfer.

### Added
- **TON Connect.** `@tonconnect/ui-react` + the manifest `frontend/public/tonconnect-manifest.json`
  (`/v2/`), the provider in `main.tsx`. At the confirmation step for GRAM — a button
  "Pay in wallet": `createOrder` → `tonConnectUI.sendTransaction(address,
  amount_nanotons)` → the existing polling. Payment matching — by the **unique
  amount** (as before), with no backend changes. The manual address/QR is left as a secondary
  button.
- **USDT-TON via TON Connect (jetton, phase 2).** Building a TEP-74 jetton-transfer
  (`@ton/core`): resolving the owner's jetton wallet via tonapi, transferring USD₮ to our
  TON wallet with ~0.05 TON of gas; matching by amount (as before). A jetton requires
  connecting the wallet as the first step ("Connect wallet" → "Pay"). The "Pay
  in wallet" button is now available for USDT-TON too. Buffer is polyfilled globally in `main.tsx`.
- USDT-TRC20 (TRON) remains a manual payment (TON Connect — TON network only).
- TON Connect was moved into a lazy chunk (first screen 243→112 KB gzip).

### Changed
- **CSP (nginx, by hand):** in `connect-src` added `raw.githubusercontent.com`
  (wallet list), `bridge.tonapi.io` (Tonkeeper), `walletbot.me` (Telegram Wallet),
  `tonapi.io` (resolving the jetton wallet for USDT-TON).

## [1.6.0] — 2026-06-16

Polishing of payments and the interface based on feedback: a confirmation step before payment,
confirmations for dangerous actions, a unified style for links and icons, restructuring
of the settings sections.

### Added
- **A confirmation step before payment.** After choosing a plan and currency — a preview
  screen (plan, currency, network, amount; for GRAM the amount is marked as
  approximate and is fixed at the next step), and only then is the order and
  QR created.

### Added
- **Time-limited keys (promo codes).** When generating a key in the admin panel you can choose
  an access period: unlimited (as before) or 7/30/90/365 days. The `plan_days` column
  in `access_keys` (NULL = unlimited). When a time-limited key is activated, `paid_until`
  is set to `max(current, now) + N days` — it stacks with an active subscription and never
  downgrades already-unlimited access.

### Changed
- **Dark theme — three background shades.** Settings → App: Warm (#20201E,
  as it was), Neutral (#0A0A0A) and Black (#000). The choice is stored in
  `mvpn_dark_shade`, applied via `.dark[data-shade]` + Telegram header/bg.
- **Public source mirror.** The repository `user666id/mvp-n` was created (public,
  scrubbed: no `.env`, keys, origin-IP or wallets). In "About → Useful
  links" a GitHub link (git icon) and a Telegram icon for the bot were added.
- **License → AGPL-3.0** (both repos). In "About" a "Licenses" section was added with
  third-party components (Hanken Grotesk/Inter fonts — OFL, React/Vite/Tailwind/
  grammY — MIT, Go — BSD). On the mirror, CI/Dependabot were removed, tags/releases
  v1.0.0–v1.6.0 were added.
- **Rewrote the FAQ/"Help".** Updated for paid subscriptions and keys; added
  a step-by-step connection guide, payment, limits, multi-device, what happens after
  a subscription ends and what data is collected.
- **Confirmations for dangerous actions.** Cancelling a payment now requires confirmation
  (with a warning that already-sent funds may not be credited), as does
  blocking a profile in the admin panel. The other destructive actions (deleting a
  config/account/profile, reset, key revocation) already had confirmations.
- **The payment success screen** distinguishes the first purchase ("Subscription created") from
  a renewal ("Subscription renewed").
- **Settings sections restructured:** notifications were moved into the "App" section
  (formerly "Appearance"), and the "Subscription" row was merged with connection into the
  "Subscription and connection" section.
- **Unified style for links and icons:** external links — neutral text with an
  "arrow-out-of-box" icon (including @username), without orange; updated the
  subscription and admin panel icons.

### Fixed
- The list of incomplete payments refreshes on every return to the selection screen
  (via an effect on step change — covers both returning via "‹" and order expiry),
  not only via the "back" button — no need to re-enter the app anymore.
- **AmneziaWG traffic accounting.** `collectTraffic` counted only VLESS (by `vpn_email`);
  AWG peers weren't accounted for. Now the cron pulls a peer's rx/tx from awg-server (the
  `vpn_configs.traffic_seen` field as the delta base) and likewise accumulates into `users.traffic_used`
  and `traffic_daily`. The AWG client was injected into the scheduler (`SetAwg`).

## [1.5.0] — 2026-06-15

Paid subscriptions and a major pass over the interface. Plus a dependency update,
Mini App reliability and moving legal documents to the web.

### Added
- **Paid subscriptions.** VPN access — by key (unlimited) or by a paid subscription
  for 7/30/90/365 days. Payment in crypto to your own wallet: **GRAM** and **USDT** on the TON network,
  **USDT** on the TRC20 network. USDT — 1:1, the GRAM amount is recalculated by the live rate
  (tonapi) and fixed for the duration of the order. A payment is recognized by a
  unique amount (also works for a transfer from an exchange), on-chain verification — once a minute.
  On expiry, access is suspended and configs are deleted, but **the account
  is preserved** — renewal restores it.
- **Sign-in and activation in the app.** A profile is created at sign-in via Telegram,
  the app opens right away. Until access is activated, on the home screen instead of
  "Create config" — "Buy subscription / I have a key". An incomplete payment
  survives a reload (same address and amount), and while a payment is being confirmed —
  "Payment is being processed" with auto-refresh.
- **The "Subscription" section** in settings: status, term, a "Buy/Renew" button and
  **payment history** with status and a link to the transaction (tonviewer / tronscan).
  Subscription status is also visible in the admin panel.
- **Legal documents** on a separate subdomain **legal.mvp-n.net** ("Terms
  of Use" and "Privacy Policy", EN/RU with a switch, in the app's style).

### Changed
- **A major pass over the interface:** removed an empty section and dead navigation code,
  settings sections reordered and renamed, icons spaced out, the dark theme
  tuned against a reference. The bot — a concise message with an "Open" button.
- **Dependencies and build:** updated the VPN core (xray-core) and key libraries;
  the Mini App was migrated to React 19 and Tailwind 4; the Go toolchain was raised to 1.26; updated
  GitHub Actions; services are built on a patched stdlib (closes a stdlib CVE).
- The internal profile number (`internal_id`) takes the smallest free one — without
  "holes" after deletions.

### Fixed
- Devices, profile and configs no longer "hang" on a poor connection: GET requests
  retry, the timeout was reduced, data refreshes on return to the app; the
  `initData` window was extended to 24h (silent re-login in long sessions).
- Static pages (legal documents, config import) didn't open under a strict CSP —
  their scripts were moved into separate files (same-origin).

### Removed
- The unused dependency `@twa-dev/sdk`.

### Not included (plan)
- TON Connect (needs a PNG icon, a CSP edit, a live test), subscription-expiry
  reminders in the bot, balance top-up. Legal document texts — a draft, require
  a final proofread.

## [1.4.0] — 2026-06-12

A pass over security and quality.

### Added
- Server status: the public IPv4 (the `server_ip` field from `SERVER_IP`) as a check of
  "which server we're connecting to"; the "online" indicator now reflects the real
  availability check of xray (`Xray.Healthy`) — previously it was hardcoded to `true`.
  When unavailable — a red "Server unavailable".
- Chart colors: in server status CPU/RAM — green, network — yellow; the traffic
  chart in the admin panel — yellow.
- In config details "Additional settings" were raised above the server status
  card.
- Traffic chart: bars are left-aligned (the timeline "fills from
  the left") — a single/few days no longer hang in the center; as days accumulate
  the chart fills the full width as before.

### Security
- CSP for the Mini App: a strict policy (`script-src 'self' + telegram.org`,
  `connect-src` only api/connect, Google fonts) — insurance against XSS theft of the JWT
  from localStorage. Applied on the nginx web vhost `app`.
- Validation of `JWT_SECRET` at api startup: length < 32 → startup refused (config.Load).
- `scripts/install/xray.sh`: the public IP is now obtained with a fallback across several
  services and `exit 1` on failure — previously an empty IP silently broke the REALITY URI.
- `SECURITY.md` — a responsible disclosure policy.

### CI
- Security scanners: `govulncheck` (Go, blocking), `gosec` (advisory),
  `npm audit` (prod dependencies, high+), CodeQL (Go + JS/TS), Dependabot
  (gomod/npm/actions). Previously CI did only lint/build/test.

### Tests
- `buildURI` (all three VLESS modes), `genShortID`, `xray.EmailFor`,
  `config.Load` validation.

### Infrastructure
- Removed the non-working push workflow `.github/workflows/deploy.yml`: after the move to
  hostoff, GitHub Actions can't reach the VPS (DDoS protection cuts off CI runners),
  so it failed on every push and sent failure emails. Pull-deploy is now
  committed into the repository — `scripts/pull-deploy.sh` + the systemd units
  `scripts/systemd/mvpn-deploy.{service,timer}` (polling GitHub once every 2 min),
  `setup-deploy.sh` installs the timer. The docs (deploy.md, README, ARCHITECTURE,
  CONTRIBUTING, STATUS) were brought in line with the pull model.

## [1.3.0] — 2026-06-11

### Added
- Admin panel: a daily traffic chart. Tapping the "Traffic" card opens a sheet
  with a "total / today" card (as in the admin area) and a bar chart — wide
  bars from the start of accounting (tap a bar → date and exact value). Backend —
  `GET /admin/traffic`, data from the already-collected `traffic_daily` (no migrations).
- Charts brought to a unified style: a shared `chartkit` module (axes, tooltip,
  crosshair guide) for the linear server charts and the bar traffic chart.
  The chart type follows the nature of the data: server — a live line, traffic — bars.
- Haptic feedback on charts: a light tick on drag (changing point/day),
  through the same gate as buttons — listens to the "Haptic feedback" toggle.
- The "today" bar — a soft `accent-soft` tint (theme-aware) instead of
  semi-transparency; the large total/today figures — in a serif font (Fraunces).

### Changed
- The server chart labels were shortened to "Processor / Memory / Network"
  (in the "Traffic" style), without the verbose "Load on… (%)".

### Infrastructure
- Migration to a new VPS (hostoff, Netherlands, <origin-ip>): migrated the
  REALITY keys (VLESS subscriptions preserved), AmneziaWG, the DB, nginx + the Cloudflare
  origin cert; traffic started from scratch. Server access — only from residential IPs
  (the host's DDoS protection cuts off datacenter/VPN exits, Cloudflare gets through).
- Auto-deploy on the new server — a pull model (a systemd timer polls GitHub
  once every 2 min and deploys on a new commit), since access for GitHub runners is cut off.

## [1.2.0] — 2026-06-10

Security and reliability hardening; repository cleanup.

### Fixed
- Mini App: switching tabs no longer recreates the screen and doesn't reset
  loaded data to an empty "skeleton". Tabs stay in memory, switching is
  instant, data refresh runs in the background without flicker.
- Admin panel: the profile list isn't cleared on refresh (after
  blocking/unblocking) — old rows stay until new ones arrive.

### Security
- Constant-time comparison of all internal tokens (`crypto/subtle`).
- Separate internal tokens per service: `INTERNAL_TOKEN_CONNECT`,
  `INTERNAL_TOKEN_BOT` (legacy `ADMIN_TOKEN` — fallback).
- Rate limiting by IP: `/auth/token` (60/min), `/auth/key` (20/min) — protection against
  key brute-forcing.
- JWT revocation: on every request the owner is checked — blocked/deleted
  users are cut off despite the 30-day token term.
- JWT secret rotation without logout: `JWT_SECRET_PREVIOUS` is accepted verify-only.
- The xray gRPC API (`:10085`) is bound to the docker bridge instead of `0.0.0.0`; the installer
  applies UFW rules itself.
- nginx: HSTS, `X-Content-Type-Options`, CSP `frame-ancestors`, `client_max_body_size`.
- `absolute_redirect off` — the `/` → `/v2/` redirect no longer exposes the internal `:8443`.
- nginx: access logs disabled on the web vhosts and the SNI stream — the service stores no
  per-request records of IP/SNI/API calls (VPN privacy).
- Removed the hardcoded server IP from the defaults (`SERVER_IP` is mandatory).
- `setup-deploy.sh` no longer prints the private key to stdout.

### Reliability
- A TOCTOU fix in the device limit check (locking the user row in the transaction).
- A unique device index + `ON CONFLICT DO NOTHING` — a race doesn't spawn duplicates.
- Graceful shutdown in `connect` and `awg-server`.
- CPU/RAM limits on all containers.
- Handling of previously-swallowed JSON decoding errors.

### Tests and CI
- Unit tests: the User-Agent parser, `initData` verification (HMAC), traffic accounting, JWT rotation.
- `go test ./...` for all Go modules in CI.

### Infrastructure
- Auto-deploy switched to a read-only GitHub deploy key (SSH over port 443) —
  no longer dependent on expiring tokens in the git remote.

### Removed
- The unfinished sub-config stubs (the `/configs/{id}/subconfig` endpoints and the
  `subconfigs` table) — the feature was unused.

## [1.1.0] — 2026-05-29

- The "Settings" tab: profile, devices (rename/block/delete), device
  limit, language, subscription reset, account deletion, "About".
- Admin panel in the Mini App: keys, profiles, traffic (total/today), domains.
- Auto-login, device accounting by HWID, device-limit enforcement in `connect`.

## [1.0.0] — 2026-05

- VLESS + REALITY (Vision/TCP `:43000`, XHTTP `:43001`) and AmneziaWG (`:51820`).
- Mini App (React + TS + Tailwind, Claude-style), a bot on grammY.
- API in Go: auth via Telegram `initData` → JWT, access keys, configs, subscriptions,
  per-device provisioning, cron accounting of traffic and server metrics.
- Docker Compose, an nginx SNI router, daily DB backups.

[1.3.0]: https://github.com/user666id/vpn-project/releases/tag/v1.3.0
[1.2.0]: https://github.com/user666id/vpn-project/releases/tag/v1.2.0
[1.1.0]: https://github.com/user666id/vpn-project/releases/tag/v1.1.0
[1.0.0]: https://github.com/user666id/vpn-project/releases/tag/v1.0.0
