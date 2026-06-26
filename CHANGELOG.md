# Changelog

All notable changes to the project. Format — [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versions — [SemVer](https://semver.org/).

## [2.4.0] — 2026-06-26

UI consistency pass — unified "liquid glass", tactility, native-feel transitions,
and code-splitting for faster load. (User-facing notes live in
`frontend/src/lib/changelog.ts` under the 2.4 entry.)

### Changed
- **One liquid-glass material**: added `.glass` / `.glass-thin` utilities in
  `index.css` (single source of truth — translucent fill + blur + saturation +
  hairline edge + top highlight). Replaced ad-hoc glass strings across
  `BottomTabs`, `Toast`, `Dropdown`, `Sheet` footer and `SubscribeSheet`'s asset
  menu. Dropped wasted `backdrop-blur` from `Button`, `Switch` and the in-card
  accent buttons (blur over a solid surface is invisible but costs GPU).
- **Buttons restyled** to solid accent (`primary` = `bg-accent`, `secondary` =
  `bg-accent/85`), with a press `active:scale-[0.97]` and a light haptic tick wired
  once in the shared `Button`. Interactive `Cell` rows get `active:scale` + a
  `selectionChanged` haptic.
- **Sliding tab indicator**: `BottomTabs` now moves a single highlight between the
  two main tabs (transform transition) instead of fading a per-tab pill in place.
- **Staggered list entrance**: `.stagger` utility (nth-child delays) applied to the
  configs and devices lists.
- **Snappier base** carried over from 2.3 (sheet 300 ms, fade 200 ms).

### Performance
- **Code-splitting**: `AdminScreen` is now `React.lazy` (admin-only, ~12 kB off the
  main bundle); the `qrcode` lib is imported dynamically inside `Qr` (~24 kB,
  on-demand); a `manualChunks` rule splits the React runtime (~193 kB) into its own
  chunk that stays cached across deploys. Main bundle 844 → 615 kB (gzip 258 → 186).

### Accessibility
- `prefers-reduced-motion` now also neutralises the stagger + toast animations.

## [2.3.0] — 2026-06-26

UI pass on the header/sheets + a legal-copy correction. (User-facing notes live in
`frontend/src/lib/changelog.ts` under the 2.3 entry.)

### Changed
- **Header scrolls with the page**: `PageHeader` is no longer `sticky` and carries no
  divider — it sits on a solid `bg-canvas` (dropped the translucent `bg-canvas/72` +
  `backdrop-blur-xl`), so the avatar + wallet capsules move together with the content
  instead of letting it bleed through a fixed glass bar. `Sheet`'s header matches
  (solid, no hairline) and stays fixed so its enter/exit slide keeps the no-flicker
  behaviour from 2.2.
- **Capsules restyled**: avatar + `WalletPill` recoloured to `bg-surface` (#2C2C2E in
  dark, matching the request) from `bg-surface-sunken`, bumped 30→32px with a slightly
  larger label; the wallet icon disc flips to `bg-surface-sunken` to keep contrast.
- **Pop-up sheets are immovable**: removed drag-to-dismiss from `BottomSheet` (no
  pointer handlers / `drag` state / `CLOSE_DRAG`) — like the TON Connect modal it sits
  still and closes only via the ✕ or a tap on the dimmed backdrop above it.
- **Snappier transitions**: sheet slide `DUR` 360→300 ms and `.animate-fade` 240→200 ms.

### Fixed
- **Privacy Policy** (`public/legal.js`): "What we store" no longer claims to keep
  configuration names (only device names); Retention + Deletion sections now state
  explicitly that account deletion happens **in the app** (profile → Account → Delete
  account), not by removing/blocking the bot in Telegram; minor wording polish across
  privacy + terms; `Updated` date → 2026-06-26.

## [2.2.1] — 2026-06-26

Subscription-expiry rework + UX fixes on top of 2.2.0. (User-facing notes live in
`frontend/src/lib/changelog.ts` under the 2.2 entry.)

### Changed
- **Expiry now SUSPENDS instead of deleting** (`SuspendExpired` in
  `handlers/profile.go`, wired as the expiry-cron callback): revokes xray/AWG keys
  and clears devices but KEEPS the config rows + their subscription links.
  `reconcileXray`'s config-base query is gated on `paid_until`; `connect` serves an
  expired link relabeled "Подписка истекла" without provisioning. Renewal re-arms
  the SAME key, so the existing launcher link revives.
- **Pay-button labels name the method**: «Оплатить/Продлить в кошельке» (TON Connect)
  vs «Оплатить/Продлить напрямую» (manual QR / Stars / TRC20).
- **Avatar navigation** driven by `HeaderCtx.accountOpen`: opens Settings everywhere,
  goes back inside the Settings stack (Account → home, sub-sheet → Account).
- **Static sheet header** — identical to the tab `PageHeader` and never transforms;
  both sheet animations (push slide, center scale+fade) run on the body only, so the
  top bar + its divider line no longer move / double / flicker on transitions.
- Account pill shows the real Telegram photo + first name (orange letter fallback).

### Added
- Admin: a blocked profile shows «Заблокировано» as its status + a red (!) → a small
  sheet "Заблокировано владельцем или администратором".
- `BottomSheet` ✕ close button + swipe-down-to-dismiss; ref-counted background scroll
  lock (`lib/scrollLock`) shared with `Sheet`.

## [2.2.0] — 2026-06-26

Cosmetic polish + a code-quality sweep — no behaviour change. (User-facing notes
live in `frontend/src/lib/changelog.ts`.)

### Changed
- **Unified group headers** to one uppercase-eyebrow style (`text-[12px] font-medium
  uppercase tracking-[0.06em] text-faint`) — `Card`'s `Section` and the admin headers
  now match.
- **`Button` gained `size="sm"`** (inline pill); the four hand-rolled accent pills
  (renew / buy / resume / connect across `ConfigsScreen` / `SubscribeSheet` /
  `WalletStatus`) now route through it — one source for the recipe.
- **Dropdown** menu fades + scales on open/close (was an instant pop).
- **Collapse** content expands/collapses smoothly (grid-rows) + chevron `duration-200`.
- **BottomTabs** blur `2xl → xl` (match the other frosted surfaces); **BottomSheet**
  `320 → 360 ms` (match `Sheet`).
- Config-detail copy / QR icon buttons unified to `rounded-full`.

### Added
- **`<BusyOverlay/>`** — single component for the three identical busy spinners
  (config detail / account / admin), with a fade-in.

### Removed (cleanup)
- Unused keyframes (`sheet-up` / `drawer-in` / `push-in`), the unused Newsreader /
  `serif` font family, and the no-op `shadow-card` boxShadow (+ all 7 usages).

## [2.1.0] — 2026-06-25

The config-detail redesign, a header TON-wallet capsule, default-Enhanced configs,
differentiated sheet animations, and a dead-code sweep. (User-facing notes for 2.0–2.1
live in `frontend/src/lib/changelog.ts`.)

### Added
- **Header wallet capsule** on every screen (`WalletPill` + `WalletSheet`, app-wide
  `TonConnectUIProvider`). Not connected → tap opens TON Connect directly; connected →
  green icon + short address, tap → bottom-sheet with copy + red disconnect. Sized to
  match the account avatar pill.

### Changed
- **Config detail ("Настроить") rebuilt** (`ConfigDetailSheet`): centred title, the
  subscription link as its own capsule (orange QR / copy icons), a protocol picker
  (VLESS active, AmneziaWG / Hysteria locked "Скоро"), Обычный / Усиленный mode, an OS
  dropdown (iOS / Android / Windows / macOS / Linux), an App Store capsule, a stepped
  install guide in a capsule, and the QR in a bottom-sheet.
- **Sheet animations differentiated** (`Sheet` `anim` prop): `push` (drill-down, back
  exits right) for "›" navigation, `center` (scale + fade) for action sheets like
  Настроить. Unified the popup menus to one row style.
- **Wallet colour lore**: neutral = disconnected, green = connected, red = disconnect.
- **New configs default to Enhanced** (XHTTP / :43001) so they connect immediately
  (`ensureUserConfig`).

### Removed (cleanup)
- The **Fragment dark-theme** leftovers (`index.html` bootstrap, `legal.js` and
  `import.js` palettes / checks).
- **27 unused i18n keys** orphaned by the redesign (delete-config, other-format,
  raw-view, install-step labels, the device block-menu, the old Settings tab) and the
  unused `getHomeScreenStatus()` export.

## [1.9.0] — 2026-06-20

A full design-system pass, a live GRAM price, admin-as-a-tab, smoother loading,
and a code / VPS / repo cleanup.

### Changed
- **Unified design system.** One colour language across the app: **green** for
  status/indicators (online, paid, recommended) + all charts; **orange** for
  actions/promo (buttons, the slider toggle, discount badges); **accent-outline**
  for selectors (language / theme / plan / payment / protocol); **neutral grey**
  for info capsules; **orange text-links** (no border). Centred titles,
  sentence-case labels, solid buttons.
- **Subscription / payment polish.** Plans show their per-day saving up front and
  prices render immediately in the chosen currency; official coin icons (GRAM,
  USDT with a TON / TRC20 network badge, Stars); USDT picks its network from a
  Fragment-style dropdown over the Buy button.
- **Admin panel is a top-level tab** (like Configs / Settings) instead of an
  overlay sheet; its drill-downs stay as ‹back› sheets.
- **One static server-status dot** everywhere (no pulse, no checkmark); all charts
  share the single green hue (multi-series area charts fill one envelope so the
  overlap no longer darkens).
- **Smoother loading** — content fades in after skeletons (configs, devices,
  payment history, server stats).
- Cleaner Settings / About — one "Account" group; removed the bottom version
  badge, the device-limit hint, the About FAQ and the config-rename description.

### Fixed
- **Live GRAM/USD price.** The rate is warmed at boot and refreshed every 2 min
  (`StartRateRefresher`) instead of lazily — GRAM prices are real from the first
  request, not the baked fallback.

### Removed (cleanup)
- The dropped **beta UI** — all `IS_BETA` branches, the `BottomNav` component, the
  beta card and sheet footers (`VITE_BETA` no longer exists).
- **80 unused i18n keys** and the orphaned `Note` / `EmptyState` components.
- Pruned **3.2 GB** of Docker build cache on the VPS; re-synced the public mirror
  (scrubbed, leak-scan clean).

### Polish (2026-06-22 → 06-23)

- **Guided install, rebuilt.** "Choose an app" is now an inline guide: an **OS
  dropdown** (iOS / Android / Windows / macOS / Linux, styled like the USDT-network
  picker), and picking a launcher **swaps the whole pane** to a 3-step page —
  Install → Add subscription → Connect — with store links and a one-tap "Add
  subscription" deeplink (mobile) or copy-link (desktop). v2RayTun is App Store
  **Global-only** (pulled from the RU store); v2RayTun & Happ gained Windows/macOS/
  Linux; v2rayNG stays Android-only (`ConfigDetailSheet`).
- **Subscription banner on the home screen.** With an active paid subscription,
  Configs shows "Active until <date> · N days left" + a filled-orange **Renew**
  pill (`ConfigsScreen`, `fmtSubDate`).
- **TON wallet in the payment pane.** Connect / show (short address) / disconnect
  at the top of the "Payment" pane (`WalletStatus`, lazy TON Connect). Not-connected
  is the same capsule with a filled-orange **Connect** pill; **Disconnect** is red.
  The session persists, so once linked a renewal is one tap.
- **Wallet returns to the app.** Both TON Connect providers set `twaReturnUrl` to
  the Main Mini App, so Tonkeeper / Telegram Wallet bring the user back after
  signing instead of leaving them stranded in the wallet (`WalletPay`,
  `WalletStatus`) — fixes the "Tonkeeper opens but nothing comes back" stall.
- **Fragment-style blue theme.** An optional 4th dark shade (Settings → App):
  links `#60a6e2`, buttons `#2589db`, background `#1c1f24`, capsules `#2e3a48`
  (`DarkShade += 'fragment'`; `telegram.ts`, `index.css`, `import.js`/`legal.js`).
- **Circle coin icons.** One consistent family — GRAM (blue disc + diamond/sparkle),
  USDT (teal disc + ₮, TON/TRC20 badge), Stars (gold disc + star) — `assets/coins/`.
- **Payment history, Fragment-style.** Each row shows the amount with its coin
  icon (`CurrencyIcon`) over the date, with the tx link bottom-left.
- **Subscription richer for clients.** `connect` now reports the real `expire`
  (from `paid_until`) in `Subscription-Userinfo`, base64-encodes the body (the
  de-facto standard), and serves a placeholder to web-browser UAs (no device
  provisioned for a browser probe).
- **Static redirect page follows the theme.** `import.html` takes `?theme=` (like
  the legal pages) so it matches the app even in an external browser.
- **Bot.** The in-message launch button is a neutral **"Open"** (the green
  `style:'success'` experiment was reverted). The chat **menu** button is left to
  **BotFather** (Bot Settings → Menu Button) — the bot no longer sets it via the API
  on each deploy, which overrode that config and still wouldn't render the web_app
  label on every client. Commands are cleared so it stays a pure "Open", not a "Menu".
- Smaller: collapse-gated config note, chart y-axis padding.

## [1.8.0] — 2026-06-18

Telegram Stars payments, a one-screen payment flow, GDPR-aligned legal pages, and
auto-update-on-open. Notable changes:

### Infrastructure & tooling (2026-06-19)
- **Release-gated deploy.** Auto-deploy is now gated on a dedicated **`release`**
  branch instead of `main`: `scripts/pull-deploy.sh` does
  `git fetch origin release` + `git reset --hard origin/release`. Committing/pushing
  to `main` is safe (nothing deploys); production ships with
  `git push origin main:release`. (`scripts/deploy.sh` header + docs updated.)
- **Beta redesign at `/beta/`.** `scripts/deploy.sh` now builds the frontend **twice**:
  prod → `/var/www/mini-app-f7/` (served at `/v2/`) and a BETA variant
  (`VITE_BETA=1`, the bottom-tab-bar redesign) → `/var/www/mini-app-beta/` (served
  at `/beta/`).
- **Bot "Test" button.** When `TEST_MINI_APP_URL` is set, the bot adds a second
  inline web_app **Test** button that opens the `/beta/` build; unset (the default)
  hides it. The var is passed through by docker-compose.
- **Automated public-mirror sync.** New `make mirror` / `make mirror-dry`
  (`scripts/sync-mirror.sh`) rebuilds the public sanitized mirror from HEAD:
  archive → scrub wallets/origin-IP → leak-scan gate → force-push to
  `github.com/user666id/mvp-n`. Pushes only if the leak-scan is clean.
- **CI is manual now.** All four GitHub workflows
  (`.github/workflows/{build,lint,codeql,security}.yml`) are `on: workflow_dispatch`
  — they no longer auto-run on push/PR (intentional, to stop failure emails). Run
  them by hand from the Actions tab.

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
- **Consent lives in the Terms, not a per-payment checkbox.** The immediate-start +
  14-day withdrawal waiver is stated in the Usage Policy (accepted at sign-in); the
  short-lived per-payment `pay.withdrawalConsent` checkbox was removed from the
  confirm step.

### UI & assets
- **Payment-method picker is now an anchored dropdown** — the list unfolds from
  the selector row itself (absolute overlay + tap-outside backdrop) instead of a
  separate block that pushed the plans down (`SubscribeSheet`).
- **No method is preselected.** The selector starts on a "Choose payment"
  placeholder (`pay.choose`); the plan durations show immediately but each plan's
  **price is hidden until a method is chosen** (prices are currency-dependent).
- **Merged select + confirm into one screen.** The separate `confirm` step is
  gone: once a method is picked the Pay button(s) render inline under the plans
  (the highlighted plan shows the amount). Fewer taps; back from the QR/`pay`
  step returns straight to the picker.
- **Official payment icons.** GRAM now uses the official post-rebrand mark from
  ton.org brand assets (`assets/coins/gram.svg`); Telegram Stars uses the
  official telegram-tt star geometry recoloured to the Stars gold
  (`assets/coins/stars.svg`), rendered via `<img>` (replaces the hand-drawn SVG).
- **Sign-in consent is now implicit** — the `AuthScreen` checkbox is gone; the
  policy notice + links remain and "by signing in you agree" is the consent
  (`auth.agreePre/agreeAnd/agreePost`).

### Reliability (loading) — update delivery
- **Auto-update on open (the big one).** Telegram's WebView caches index.html and
  kept serving an OLD build across re-opens — why "my edits / theme don't update"
  and why the app felt stuck on a stale version. On boot `main.tsx` now compares
  the running bundle hash to the server's current one (fetched `no-store` +
  cache-busted) and, if stale, navigates once to a `?v=<hash>` URL to pull the
  latest. (The 7-day asset grace window stopped the 404-hang but also let stale
  indexes keep working silently — this closes that gap.)

### Misc (this batch)
- `frontend/package.json` version 1.7.0 → **1.8.0** (was out of sync with the tag).
- Admin panel: traffic is now a plain "Traffic" row (opens the by-day chart)
  instead of a totals card. Removed the chevron from the config card and the
  Settings "Reset configs" row.
- **TEST:** all `Button`s are now clay OUTLINE (transparent bg, clay border) like
  the "Install in app" button — `primary` is no longer a filled fill.

### Reliability (loading)
- **Global React error boundary** (`components/ErrorBoundary.tsx`, wraps `App` in
  `main.tsx`) — a render-phase throw now shows a recoverable "Reload" card instead
  of unmounting the whole tree to a blank white screen.
- **Stale-deploy self-heal.** A `vite:preloadError` listener + the error boundary
  detect a failed dynamic import (old index referencing a chunk a newer deploy
  replaced) and do ONE guarded `location.reload()` to fetch the fresh, no-store
  index. `initTelegram()` is now wrapped in try/catch so an init regression can't
  block the render.
- **Deploy grace window.** `scripts/deploy.sh` no longer `--delete`s hashed assets
  immediately; new chunks are added and old ones pruned after 7 days, so a client
  still holding an old `index.html` can fetch its chunk instead of 404-ing and
  hanging. (Root cause of "the app keeps getting stuck loading" after frequent
  deploys: zero-grace `rsync --delete` + any cached HTML.)
- **WalletPay tonapi lookup** now has a 10s AbortController timeout so a stalled
  jetton-wallet resolution rejects (cancel toast) instead of spinning the Pay
  button forever (`WalletPay.tsx`).
- _Not changed (advisory):_ origin nginx already serves `/v2/index.html` as
  `no-store` (correct); the residual risk is Cloudflare HTML edge-caching — add a
  Cache Rule to bypass cache for `app.mvp-n.net/v2/index.html` and the grace
  window covers any stale HTML regardless.

### Reliability & UI (cont.)
- **Skeletons now shimmer** — a soft light band sweeps across the sunken base
  (`.skeleton` in `index.css`, used by `Skeleton`) instead of an opacity pulse;
  respects reduced-motion.
- **Writes retry on a pure NETWORK error.** `client.ts` now retries a non-GET
  once when the connection never established (server didn't receive it, so no
  double-apply) — fixes "Couldn't start payment" (POST /orders) on a transient
  mobile drop. A write TIMEOUT is still not retried. (Doc fixed: timeout is 12s,
  not 20s.)
- _Note:_ the dominant cause of "everything loads slowly / payment won't start"
  on the owner's device is the client path — the host's anti-DDoS throttles the
  v2raytun VPN exit IP — not the app (origin TTFB ≈ 0.2s, bundle < 0.7s measured).

### UI
- **Subscription pane shows days left** ("N days left" + a faint "until <date>")
  instead of just the date (`SubscriptionSheet`, `sub.daysLeft`/`sub.untilShort`).
- **Unified, smaller buttons.** `Button` height 50→44px, text 15.5→15px; the
  `secondary` variant is now a clay outline (so a primary+secondary pair reads as
  one colour family). "I have a key" is a proper secondary button everywhere
  (`SubscriptionSheet`, `ConfigsScreen`); the unfinished-payment "Cancel" is red
  (danger), matching "Delete account".

### Legal
- Removed the "Legal basis (GDPR)" and "Your rights" sections from the Privacy
  policy; kept a short "Deletion & support" line (delete in-app + @mvp_n_net_bot).
  (RU + EN, `public/legal.js`.)

### Theme
- **Dropped the "Neutral" dark shade** — the dark background is now just Warm
  (default) and Black. `DarkShade` is `'warm' | 'black'`; a legacy saved
  `neutral` migrates to `warm` (`telegram.ts`, `index.css`, `SettingsScreen`).
- **Static pages follow the app theme.** The legal pages (`legal.js`) take a
  `?theme=light|warm|black` param (passed by the app via new `effectivePalette()`,
  added to `legalUrl` in `AboutSheet`/`AuthScreen`) and the open-app launch page
  (`import.js`) reads the saved theme from same-origin `localStorage`; both fall
  back to the OS colour scheme and re-theme themselves to match (light / warm /
  black), replacing the previously hard-coded dark.

### Pricing
- **Smoothed the tariff ladder (Option A).** 90 days $15 → **$12** ($0.167 → $0.133
  /day) and 1 year $45 → **$40** ($0.123 → $0.110/day) — the 90-day plan used to
  have the same per-day rate as 30 days (no incentive). 7d/30d unchanged. Stars
  re-pegged to match: 90d 990 → **800**, 365d 2900 → **2600** (7d=150, 30d=350
  unchanged). Updated in `api/.../plans.go`, the bot's `STARS_BY_DAYS`
  (`bot/src/index.ts`, must mirror the API for `pre_checkout`), and the mock.
- Added `brand/` with the bot avatar (`bot-avatar.jpg`, 1280×1280) + a README on
  where each brand asset is applied.

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

[1.9.0]: https://github.com/user666id/vpn-project/releases/tag/v1.9.0
[1.8.0]: https://github.com/user666id/vpn-project/releases/tag/v1.8.0
[1.7.0]: https://github.com/user666id/vpn-project/releases/tag/v1.7.0
[1.6.0]: https://github.com/user666id/vpn-project/releases/tag/v1.6.0
[1.5.0]: https://github.com/user666id/vpn-project/releases/tag/v1.5.0
[1.4.0]: https://github.com/user666id/vpn-project/releases/tag/v1.4.0
[1.3.0]: https://github.com/user666id/vpn-project/releases/tag/v1.3.0
[1.2.0]: https://github.com/user666id/vpn-project/releases/tag/v1.2.0
[1.1.0]: https://github.com/user666id/vpn-project/releases/tag/v1.1.0
[1.0.0]: https://github.com/user666id/vpn-project/releases/tag/v1.0.0
