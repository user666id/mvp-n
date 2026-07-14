# Changelog

All notable changes to the project. Format — [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versions — [SemVer](https://semver.org/).

Capsules (`X.Y`) are feature updates; refinements (`X.Y.Z`) are fixes and small
tweaks shipped under a capsule. The user-facing copy of this history lives in
`frontend/src/lib/changelog.ts` (About → Changelog).

## [2.9.3] — 2026-07-13

### Changed
- **8px spacing system** (all screens) — block rhythm on the 8 grid: 16px base gaps between capsules (was 12/20), 24px between sections (`Section` mb-4→mb-6), 32px for the largest breaks; unified icon-text row gap. Type scale loses half-pixel sizes (12.5/13.5/11.5/14.5/19/21/18 → 13/14/12/15/20/22/17): the scale is now 11/12/13/14/15/16/17/20/22/34.
- **44px compact rows** — ad-hoc list rows (info/key/history rows) drop to 12px vertical padding (~44px, the iOS list-row height); `Cell` primary rows keep their 54px Telegram-like height.
- **Liquid-glass bottom sheets** (`ui/BottomSheet.tsx`) — QR/confirmation/picker panels render on the shared `glass-thin` material; floating chrome (tab bar, footers, menus, toasts, bottom sheets) is now consistently glassy. The QR keeps its solid white card. Hierarchy, single-accent color and standard components already followed the five-principles instruction; content surfaces stay opaque by design.

## [2.9.2] — 2026-07-12

### Added
- **Admin: apply an access key to a profile** (`POST /admin/profiles/{id}/apply-key`, `AdminSheet.tsx`) — the admin redeems a key from the pool FOR a profile: same validate/burn semantics as `/auth/key` (single-use, TTL, timed days stack, lifetime clears the expiry), the target must exist, and a timed key on a lifetime profile is rejected without burning. `used_by` points at the receiving profile for the audit trail. UI: a "Key activation" row on the admin profile sheet, full-screen, mirroring the user's own activation sheet.

### Changed
- **Official OS logos in the guide picker** (`components/icons.tsx`) — solid Apple (iOS), Finder face (macOS), " tv" mark (Apple TV), Android bugdroid (+bugdroid tv for Android TV), solid Windows panes, Tux (Linux). The key icon is redrawn as the Apple passkey glyph; the admin Devices row got the phone icon.
- **One name for key activation** — settings row, user sheet and the admin profile flow all say "Key activation" / «Активация ключа»; the admin flow lost its explanatory copy and bottom-window layout.
- **Dead code swept (knip)** — 9 unused API client wrappers, 11 unused icons, the unused `Card` component, orphaned types (`Protocol`, `AwgStats`, `AdminConfig`), internalized `SUB_BASE`/`plural`/`tg`/`PatchNote`, and the `postcss` devDependency (Tailwind 4 runs via its Vite plugin). `npm run deadcode` (knip) is the new scanner; README features refreshed (TV platforms, admin key activation).

## [2.9.1] — 2026-07-11

### Added
- **Apple TV / Android TV in the install guide** (`ConfigDetailSheet.tsx`) — two new OS entries with store links (Happ for TV on tvOS, Happ/v2RayTun on Android TV) and TV-specific step texts: no deep-link import on TV, the subscription is added on the TV itself (manual link entry or QR scan). The OS dropdown rows now carry platform icons.

### Changed
- **Icon refinements** (`components/icons.tsx`, screens) — the key is redrawn (vertical, iOS-style), the Theme row uses a half-shaded contrast circle (№308 of the pack), the Android glyph is the pack's robot (№063), the server-stats IP row uses a location pin (№301) instead of a monitor, and the stats sheet dropped its hero header. The key-entry sheet title now matches its entry button ("Activate key"). `ExternalLink` briefly became the pack compass and was reverted to the ↗-in-square arrow on request.
- **TEMP: recovery step in `scripts/deploy.sh`** — one-off self-heal for the 2026-07-11 outage (bring the compose stack up, restart nginx if :80 is silent, log service state to the journal). Remove after the incident.

## [2.9] — 2026-07-11

### Changed
- **Configure opens the install guide directly** (`ConfigDetailSheet.tsx`) — the intermediate "Add to app" button and the separate app-chooser sheet are gone. The config sheet now leads with the subscription-link capsule (QR / copy), then the OS + launcher install stepper in one capsule, with Server status and Advanced settings at the bottom. The OS is re-detected each time the sheet opens.
- **Icon set traced from the tgiosicons Telegram pack** (`components/icons.tsx`) — 31 glyphs (wallet, globe, gear, bell, clock, lock, trash, copy, QR, info, logout, shield, dollar, chart, people, sun/moon, haptics, …) are vector-traced 1:1 from t.me/addemoji/tgiosicons (the Telegram-iOS interface icons), rendered as filled outlines in a 108-crop of the 128 canvas so their optical size matches the remaining thin-stroke glyphs (chevrons, plus/x/check, brand logos, device icons — no pack counterpart).

### Fixed
- **Duplicate copy-link button removed** from install step 2 — the link capsule on top already covers copying.

## [2.8.7] — 2026-07-03

### Fixed
- **PullScroll hijacked nested scrollers (device-limit wheel)** (`ui/PullScroll.tsx`) — when a sheet's content fits the screen, `PullScroll` is both at-top and at-bottom, so any vertical drag engaged its rubber-band and translated the whole content — including a drag meant for the nested `WheelPicker`, so the device-limit wheel couldn't be spun. `begin()` now walks from the touch target up to the scroll container and, if the gesture started inside a nested vertical scroller (`overflow-y: auto/scroll` with `scrollHeight > clientHeight`), leaves the gesture entirely to that element. Verified: a drag on the wheel no longer translates the sheet, while a drag elsewhere still pulls.

## [2.8.6] — 2026-07-03

### Changed
- **Shared `EmptyState` component + dead-code cleanup** (`ui/EmptyState.tsx`, screens) — the plain "nothing here" placeholders were copy-pasted with drifting styles (`py-8`/`py-10`/`py-14`, `text-[14px]`/`[15px]`); replaced all 7 (Traffic, Usage, Devices, PaymentHistory, Admin keys/matches/devices) with one `<EmptyState>`. Removed the now-dead `anim` prop from `Sheet` (transitions are off, so it drove nothing) and the two `anim="center"` call-sites in `ConfigDetailSheet`, plus the stale slide/animation comments. Left the per-content `animate-fade`/`animate-rise` micro-animations (data appearing inside a screen) — they don't cause the navigation lag. Note: the `Spinner` on Configs is the payment-processing indicator, not a loading placeholder (loading already uses `HomeSkeleton`), so it's correct as-is.

## [2.8.5] — 2026-07-03

### Changed
- **All navigation transitions removed** (`ui/Sheet.tsx`) — reverted the 2.8.4 sheet slide back to the 2.8.3 instant behaviour on request: `bodyStyle` is `{}`, the sheet mounts `shown` and unmounts immediately, no `translate3d`/`willChange`/rAF. Combined with the already-instant tabs (2.8.4), the whole in-app navigation is now transition-free, so nothing can drop frames. Unchanged: `PullScroll` drag-to-scroll and the `BottomSheet` bottom slide-up.

## [2.8.4] — 2026-07-03

### Changed
- **iOS/Telegram navigation model** (`ui/Sheet.tsx`, `App.tsx`) — per the platform convention: **tabs switch instantly** (no cross-fade, like a native tab bar) and **drill-down sheets slide in from the right** (`push`) / scale-pop (`center`). The slide was rebuilt to avoid the earlier jank: `translate3d` (forces a GPU layer) + `willChange` only while mounted, double-rAF so it animates from a painted frame, and the competing per-content `animate-fade` removed so the panel moves as one piece. Note: transforming a full-screen scrollable panel still triggers some per-frame raster in the webview (unlike native iOS compositing) — if it stutters on a given device, the sheet slide can be turned off in one line (`bodyStyle` → `{}`), which is the 2.8.3 instant behaviour.

## [2.8.3] — 2026-07-03

### Changed
- **Disabled the sheet open/close transition** (`ui/Sheet.tsx`) — the push slide (left/right) and the center scale-in were the source of the animation stutter the user was hitting on every sheet open (profile, admin sections, back). They're now off: the sheet mounts `shown` and unmounts immediately, `bodyStyle` carries no transform/transition, so panels appear and dismiss instantly with no motion to drop frames. `PullScroll` drag-scroll, the tab cross-fade, and the `BottomSheet` bottom-slide are unchanged. The `anim` prop is retained on the API but no longer drives motion.

## [2.8.2] — 2026-07-03

### Changed
- **Unified the interface system** — audited every surface and codified one set of rules:
  - **Motion** — extracted the shared easing + duration into `lib/motion.ts` (single source), so `Sheet`, `PullScroll` and `BottomSheet` can't drift apart. No behaviour change, just deduplicated the constants that were copied into all three.
  - **Two consistent surface tiers.** Full-screen surfaces (the Configs/Subscription/Admin tabs and every drill-down `Sheet`) all share the avatar+wallet header and the `PullScroll` drag-to-scroll. Compact popups all use `BottomSheet` (immovable, ✕-close). The TON Connect wallet dialog is the vendor's own modal and is intentionally left as-is.
  - **BottomSheet reachability** (`ui/BottomSheet.tsx`) — capped at `92vh` with an inner `overflow-y-auto`, so a popup taller than the screen (small device / large font) scrolls instead of clipping, matching the "all content is reachable" rule the full-screen surfaces already follow. Short popups are visually unchanged; the ✕ stays pinned.

## [2.8.1] — 2026-07-03

### Changed
- **Unified drag-to-scroll on the bottom-tab screens** (`ui/PullScroll.tsx`, `ui/Sheet.tsx`, `App.tsx`) — the drill-down sheets already scrolled as one piece (header pulls with the content); the tab screens (Configs / Subscription / Admin) used plain native scroll, so they didn't move when the content fit. Extracted the scroll surface into a shared `PullScroll` and used it for the tab panes too, so every screen pulls up/down with the avatar+wallet header the same way. `PullScroll` uses **passive** touch listeners and writes the rubber-band transform straight to the DOM (no per-move React re-render), keeping scrolling on the native fast path. Tab cross-fade and the sheet open/close animation are unchanged from the 2.8 baseline.

## [2.8] — 2026-07-03

### Security
- **`BOT_TOKEN` is now required at startup** (`config.go`) and `verifyTelegramInitData` refuses an empty token. An empty bot token collapses the Telegram initData HMAC secret to a public constant (`HMAC("WebAppData","")`), which would let anyone forge a signed login for any user id — including an admin. Config now fails fast instead of booting into that state.
- **`GET /to/{short_id}` now enforces the subscription gate** (`configs.go`) — the public subscription URL joins `users` and returns 404 when the account is blocked, soft-deleted, or its paid subscription has expired (NULL `paid_until` = unlimited key still allowed). Previously it served the config (disclosing the origin server IP/UUID) for any active config regardless of account state; the tunnel was already cut server-side, this closes the info-disclosure.

### Fixed
- **Drill-down sheets now scroll as one piece** (`ui/Sheet.tsx`) — the avatar + wallet header was pinned outside the scroll surface, so on tall sheets (Traffic, Devices, Server stats, …) the content scrolled while the header stayed put. The header now lives inside `SheetScroll` and moves together with the content, with the same two-way elastic bounce — matching the tab screens, whose `PageHeader` already scrolls with content. Content top-padding is unchanged so spacing matches the tabs.

### Added
- **CI mirror-sync workflow** (`.github/workflows/mirror-sync.yml`) — on push to `main`, runs `go test` (api/connect/awg-server) + the frontend build, and only on success syncs the public sanitized mirror via `scripts/sync-mirror.sh` (leak-scan gate unchanged). Manual `workflow_dispatch` + a `concurrency` guard so two force-pushes can't race. Requires a `MIRROR_TOKEN` repo secret.
- **Tests** for previously uncovered paths: `BOT_TOKEN` config validation, empty-token initData rejection, `AdminByTGID` authz (admin / non-admin / no-auth), and the rate limiter (token-bucket burst + `clientKey` header precedence).

### Known / not yet addressed (from the security review)
- Rate limiter (`middleware/ratelimit.go`) trusts client-supplied `CF-Connecting-IP` / `X-Forwarded-For`, so per-IP throttling on `/auth/key` and `/auth/token` is bypassable. Proper fix needs a trusted-proxy allow-list (Cloudflare ranges) — deferred as a deploy decision.
- Access-key entropy ~40 bits; no per-user cap on pending orders. Both Low severity.

## [2.7.1] — 2026-06-28

### Changed
- **Admin panel onto the shared cache** — `adminProfiles` / `adminKeys` are now `useCachedResource` keys (AdminSheet.tsx), so the admin tab shows instantly on re-open and is healed by the app-wide resume recovery (a dropped first fetch no longer leaves it stuck on a skeleton). Key generate/revoke and profile block/delete now invalidate/mutate those keys.
- **Smooth tab cross-fade** — the bottom-tab content is now stacked fixed panes that cross-fade on switch (App.tsx `tabPane`), instead of a hard `hidden` cut. Viable now that 2.7's cache makes the incoming tab render its content instantly (no blank-at-opacity-0 flash that forced the old hard cut). Each pane keeps its own scroll position.

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
