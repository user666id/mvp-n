# Changelog

All notable changes to the project. Format — [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versions — [SemVer](https://semver.org/).

Capsules (`X.Y`) are feature updates; refinements (`X.Y.Z`) are fixes and small
tweaks shipped under a capsule. The user-facing copy of this history lives in
`frontend/src/lib/changelog.ts` (About → Changelog).

## [2.7] — 2026-06-28

Unified, stale-while-revalidate loading across the whole Mini App — the fix for the
long-standing "open a tab → stuck on a skeleton / re-enter → blank / close+reopen to
load it" inconsistency, plus the intermittent white flash on boot.

### Added
- **`frontend/src/lib/cache.ts`** — a tiny module-level SWR store every screen reads through `useCachedResource` (`lib/useForeground.ts`): returns last-known data instantly, revalidates in the background, NEVER resets to a skeleton on re-activation, de-dupes in-flight fetches, and guards optimistic writes with an epoch so a slow revalidate can't clobber them. A first load still shows a skeleton but can't hang (the 12s request timeout + retries surface error+retry). Safe display lists (`configs`, `devices`) are persisted to localStorage — namespaced by the Telegram user id — for an instant cold-boot paint.

### Changed
- **Global resume recovery** — one app-level `visibilitychange` / `pageshow` / `online` listener (App.tsx) revalidates EVERY active view at once, not just the visible tab (the old per-view foreground hook only healed the active one).
- **Single-source profile** — App, ConfigsScreen, DevicesSheet and the Account sheet all read the one `profile` cache key, so the home banner / Subscription tab / avatar / device count can't disagree. Profile is NOT persisted, so admin/access gating stays pessimistic (no flash of unlocked/admin UI from disk).
- Migrated the destructive null-reset screens (ServerStats, Devices, Usage, Traffic, PaymentHistory, admin DomainStatus) + Configs/Account onto the shared hook. Order/pending/invoice endpoints stay OUT of the cache (the pay-again guard must be fresh).
- Pre-warm the Payment (`SubscribeSheet`) chunk on idle.

### Fixed
- **White flash on open** — `main.tsx` no longer triggers an update-check `location.replace` / chunk `location.reload` after the app is live + visible (those started a fresh, splash-less document load). They now only fire pre-`ready()` (under the BotFather splash) or while hidden; a stale bundle is picked up on the next cold open instead.

## [2.6.2] — 2026-06-28

### Changed
- **VLESS Enhanced-only in the UI** — the Standard (Vision, `:43000`) mode is locked in the config Mode picker (greyed, like the roadmap protocols). The Vision server inbound stays up as a fallback, so existing Standard configs keep working; DB check confirmed 0 active configs on Standard at ship time. New configs already default to Enhanced.

## [2.6.1] — 2026-06-28

### Dependencies
- **Frontend build-tooling majors** (coupled): `vite 5 → 8` (now uses the rolldown bundler), `typescript 5 → 6`, `@vitejs/plugin-react 4 → 6`. Build + `tsc` + vitest + mock preview all green; main chunk shrank ~169 → ~155 KB.
- Deploy frontend build container bumped `node:20-alpine → node:22-alpine` (Vite 8's Node floor).

## [2.6] — 2026-06-28

_(2.5.6 is folded into this 2.6 — there is no separate 2.5.6 release.)_

### Security
- **USDT payments are matched by the jetton master contract**, not the jetton symbol — a look-alike scam jetton (e.g. `USDX`) with the right amount can no longer be credited as USDT (`payments_verify.go`). TRC20 re-checks the token contract too.

### Fixed
- **Atomic payment crediting** — claiming an order and extending the subscription now run in ONE DB transaction (`extendSubscriptionTx`), so a crash between them can't leave a renewing buyer paid-but-uncredited.
- Payment polling widened (TON 50→100, TRON 50→200 events) so a matching transfer in a burst isn't missed.

### Added
- **Telegram bot liveness** in the admin status panel — the bot serves a tiny `/health` on the compose network (`BOT_HEALTH_URL`, default `http://bot:8082/health`).
- Tests for the crypto-transfer parsers (real-vs-fake jetton, wallet/contract filtering).

### Changed
- Lazy-load the Payment (`SubscribeSheet`) and Usage sheets — smaller first paint (main chunk 180→169 KB).
- Local error boundary around the payment sheet so a crash there can't take down the whole app.
- Accessibility — `aria-label`s on the key/rename/search inputs; focus trap + focus-on-open in the modal `Sheet`.
- Changelog screen — refinements render inline inside each capsule (folds the earlier 2.5.6 change).

### Dependencies
- Runtime base `alpine:3.19 → 3.24` (api, connect) — 3.19 is EOL.
- `golang.org/x/crypto 0.49→0.53`, `golang.org/x/net 0.52→0.56` (+ transitive x/sys, x/text).

## [2.5] — 2026-06-26

### Added
- Home dashboard — at-a-glance Devices and Usage widgets on the main screen; tap either to open the full view.
- Pull to refresh — drag down on the home, Payment, Devices, Usage, history, server-stats and admin screens to reload, with a haptic tick.

### Changed
- Device limit moved onto the Devices screen — shown right above the device list.
- Clearer first run — the welcome and activation screens say it's a VPN and show the app's mark.
- Smoother loading — matching placeholders instead of a jump, and a slim boot progress bar instead of a spinner.

### Fixed
- TON-wallet sheet no longer shows its name twice.

### [2.5.5] — 2026-06-27
- **Changed** — Update history is now organized into capsules with their refinements; polished the dropdown selection (rounded pill, consistent everywhere).
- **Fixed** — Activating a key can no longer be submitted twice; payment polling now bails out cleanly instead of spinning forever.

### [2.5.4] — 2026-06-27
- **Changed** — A unified round-icon system across all list rows; Globe and Moon icons on the Language and Theme rows.

### [2.5.3] — 2026-06-27
- **Changed** — Sheet headers scroll with the content; refined true-black dark theme (iOS palette).
- **Fixed** — No more stuck loading skeletons (foreground refetch); dropdown menus are never clipped; no tab/navigation flicker.

### [2.5.2] — 2026-06-26
- **Added** — Pull to refresh on every screen and sheet, with an elastic bounce.
- **Changed** — Home skeleton and a slim boot progress bar; native two-way overscroll everywhere.

### [2.5.1] — 2026-06-26
- **Changed** — Refined home (brand mark as a clean circle, tidier hero icons, consistent spacing); compact inline device-limit wheel with auto-save above the device list; slimmer Settings.

## [2.4] — 2026-06-26

### Changed
- A unified "liquid glass" material across the tab bar, menus and notifications, with cleaner buttons and toggles.
- More tactile — buttons and list rows respond to touch with a gentle press and a light haptic tick.
- Smoother navigation — the active-tab highlight glides between tabs, and lists appear with a light cascade.
- Faster to open and quicker stats — the app is code-split and charts load on demand.
- The Payment and Admin screens match the new style; copying a link gives haptic feedback.

### [2.4.3] — 2026-06-26
- **Fixed** — More reliable loading across all screens (no stuck skeletons; Payment loads dependably).
- **Changed** — Smooth cross-fade between tabs and a stronger frosted-glass material.

### [2.4.2] — 2026-06-26
- **Changed** — Self-hosted fonts (faster, privacy-friendly, no third-party font CDN).
- **Fixed** — Security hardening.

### [2.4.1] — 2026-06-26
- **Changed** — Charts load on demand; a consistency pass across Payment and Admin; configs are no longer named (config names aren't stored).

## [2.3] — 2026-06-26

### Changed
- Cleaner header — avatar and wallet capsules scroll with the page, the divider line is gone, and the capsules are slightly larger.
- Pop-up windows sit still (no longer drag around) — close them with the ✕ or a tap on the dimmed area.
- Snappier, smoother sheet and screen transitions.

### Fixed
- Clearer Privacy Policy — corrected what is stored (no configuration names) and clarified that accounts are deleted in-app.

## [2.2] — 2026-06-26

### Changed
- Smoother interface — menus and expandable sections open with a gentle fade.
- A more consistent look — unified section headers, buttons and loading indicators.

### [2.2.1] — 2026-06-26
- **Changed** — Clearer payment — buttons say how you pay (in your wallet / directly), for both new and renewing subscriptions.
- **Fixed** — An expired subscription keeps your config and connection link (it just pauses; renewing revives the same link); steadier navigation (the top bar stays put, sheets close reliably from the avatar).

## [2.1] — 2026-06-25

### Changed
- Redesigned config screen — globe + country header, full protocol spec, one-tap "Add to app", with link/QR/formats/settings gathered into one card.
- Rebuilt install guide — pick OS and app by icon, with a clear 1·2·3 (install → add → connect).
- New Payment screen — pick plan and method there; key activation and payment history moved into the profile; a config now comes with the subscription (one per account).
- Refreshed Standard dark theme; wallet moved to a header capsule on every screen; new configs default to Enhanced mode.

### Fixed
- More reliable devices (blocking/deleting one no longer affects others; active devices don't disappear).
- Unified loading and refresh; no white flash on launch; more stable connection.

## [2.0] — 2026-06-23

### Added
- Usage — your own traffic by day, in the app.
- Connect a TON wallet from your profile.

### Changed
- A fresh iOS-style "liquid glass" look; new bottom-tab navigation (Configs · Subscription) with account behind the avatar.
- One-tap "Add subscription" works on desktop too; a branded loading screen and the native back button.

## [1.9] — 2026-06-20

### Changed
- A full visual refresh — one consistent style (green for status, orange for actions, neutral for info).
- Redesigned subscription — plans show their saving, prices in your currency, official coin icons; USDT network pick (TON or TRC20); admin panel as a top-level tab.

### Fixed
- Live, accurate GRAM price; the VPN app now shows when the subscription ends.

## [1.8] — 2026-06-18

### Added
- Pay with Telegram Stars; enter an access key when renewing too.

### Changed
- Fewer taps to pay (method, plan and Pay on one screen); cheaper 90-day and 1-year plans; the app auto-updates on open.

## [1.7] — 2026-06-16

### Added
- Pay from a TON wallet via TON Connect (Telegram Wallet, Tonkeeper) — GRAM and USDT-TON.

## [1.6] — 2026-06-16

### Added
- Access keys can grant a fixed term (7 / 30 / 90 / 365 days), not only lifetime.

### Changed
- Source code is now public (AGPL-3.0), linked under About; rewritten Help.

### Fixed
- AmneziaWG traffic is counted in usage stats (previously VLESS only).

## [1.5] — 2026-06-15

### Added
- Paid subscriptions — pay with crypto (GRAM or USDT on TON / TRC20) or activate a key for lifetime access; a Subscription section (status, renewal, payment history).

### Fixed
- Devices and profile no longer get stuck on a flaky connection.

## [1.4] — 2026-06-12

### Added
- Server status shows the IPv4 and a real availability check.

## [1.3] — 2026-06-11

### Added
- Daily traffic charts with a drag-to-inspect tooltip.

## [1.2] — 2026-06-10

### Fixed
- Switching tabs no longer reloads data from scratch.

## [1.1] — 2026-05-29

### Added
- Settings — profile, connected devices, device limit and language; per-device accounting and the admin panel.

## [1.0] — 2026-05-27

### Added
- Launch — VLESS + REALITY and AmneziaWG, the Mini App and a Telegram bot.
