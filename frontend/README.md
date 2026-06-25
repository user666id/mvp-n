# frontend — Telegram Mini App

React 18 + TypeScript + Vite + Tailwind, in a **Claude-style** design (warm ivory
canvas, terracotta accent, flat hairline cards). Served as static files at
`https://app.mvp-n.net/v2/`.

## Highlights
- **Auth:** Telegram `initData` → `POST /auth/token` → JWT (stored locally).
  First-time users go through a one-time access key.
- **i18n (EN/RU), English by default.** Tiny context in [`src/lib/i18n.tsx`](./src/lib/i18n.tsx)
  (`useT()` → `t('key')`, dictionary `key → {en, ru}`). Choice persists in
  `localStorage`; switch under Settings → Language.
- **Mock mode** for browser/dev: built with `VITE_MOCK=1`, all API calls are
  served by [`src/api/mock.ts`](./src/api/mock.ts) — no backend needed.
- Tabs: **Configs**, Options (placeholder), **Settings** (profile, devices,
  subscription, admin panel for admins).

## Scripts
```bash
npm install
npm run dev      # vite dev server (uses .env.development → VITE_MOCK=1)
npm run build    # tsc --noEmit && vite build  → dist/
npm run preview  # serve the production build
```

## Env (build-time)
| Var | Default | Purpose |
|-----|---------|---------|
| `VITE_API_BASE` | `https://cdn.mvp-n.net` | REST API base (direct API subdomain) |
| `VITE_SUB_BASE` | `https://connect1.mvp-n.net/to/` | subscription link base |
| `VITE_MOCK` | unset | `1` → use the in-memory mock backend (dev/preview only) |

## Deploy
Production `vite build` (no mock) runs in CI and rsyncs `dist/` to
`/var/www/mini-app-f7/` (served at `/v2/`). See [`scripts/deploy.sh`](../scripts/deploy.sh).
