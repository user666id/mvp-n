# Bot and Mini App

Description of the user-facing part: the Telegram bot and the Mini App screens (the console).
Technical details of the bot — [`bot/README.md`](../bot/README.md), of the frontend —
[`frontend/README.md`](../frontend/README.md).

## Bot

`@mvp_n_net_bot` is intentionally minimal: `/start` (or any text) → a short
greeting with a single inline **web_app** button that opens the Mini App. It works
only in private chats, over long polling. The greeting language is synced with the choice
in the app (EN by default). Details — [`bot/README.md`](../bot/README.md).

## Mini App navigation

- Side menu (drawer) at the top left: **Configs**, **Options** (placeholder) and **Settings**.
- Screens open as push panels (sliding in from the right) with a "‹ Back" button.
- Large headings, Claude-style design, EN/RU, theme follows the system.

## Configs

**List.** Config cards (country, spec, server status), a counter,
a floating "+" button. The first entry requires activating a one-time key.

**Creation.** Location (Netherlands), protocol — VLESS or AmneziaWG, for VLESS
the modes: Normal / Enhanced / Gaming.

**Config card.** Subscription link (or `.conf` for AmneziaWG), QR, an
"install into app" button (client choice — Happ / v2RayTun / v2rayNG — via
web-redirect), mode switching, renaming, server status → charts,
deletion.

**Server charts.** CPU and RAM on a 0–100% scale, network in auto units (B/s → KB/s →
MB/s), read from the host NIC.

**Devices.** List (VLESS + AmneziaWG) with the real device model;
renaming, block/unblock, deletion; stable numbering by date added.

## Settings

- **Profile card** (tap → the "Account" sheet): Telegram ID, username, internal
  ID, traffic; at the bottom — account deletion.
- **Appearance:** language (EN / RU), theme (Light / Dark / System), haptic
  feedback.
- **Notifications:** toggle for Telegram notifications.
- **Subscription:** devices, subscription settings (device limit), config reset.
- **Log out** — a row at the bottom.
- **About** (the "ⓘ" button in the header): a short description + FAQ.

## Admin panel (admins only)

Accessed from the main menu (the left drawer, pinned at the bottom — admins only).
Sections:

- **Traffic** — a "total / today" card (the day boundary is 00:00 MSK).
- **Profiles** — search, a profile card (Telegram ID, username, traffic), a list
  of configs and devices, actions: subscription reset, block/unblock, deletion. For
  your own admin profile reset works, but block/delete return "not allowed".
- **Keys** — issue N keys, a list (unused / used), revocation.
- **Domains** — statuses of the web domains (availability, code, latency).
