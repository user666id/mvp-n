# bot — Telegram bot (@mvp_n_net_bot)

A deliberately tiny [grammY](https://grammy.dev) bot whose only job is to open
the Mini App. It runs on **long polling** — no inbound port, no webhook, no TLS
to terminate. ~150 lines, single file (`src/index.ts`).

It is **not** the brain of the product — all VPN logic lives in the API and the
Mini App. The bot is just the front door: it greets the user and hands them the
**web_app** button that launches the console.

---

## What it does

- **`/start` (or any plain text, treated as a restart)** → a short welcome
  message with a single inline **web_app** button that opens the Mini App.
  ```
  mvp-n

  Press the button below to open.        [ Open console ]
  ```
- **Private chats only.** Handlers are mounted under `bot.chatType('private')`,
  so if the bot is added to a group or channel it stays silent — no console
  spam, no attempts to delete other people's messages.
- **Bilingual, English by default** — Russian copy (message + button + `/start`
  command label) only for Russian-speaking users. No emoji on the button.
- **Language matches the Mini App.** The greeting language follows the user's
  in-app choice when they have made one (see *Language resolution* below);
  otherwise it falls back to the Telegram `language_code`.
- **Keeps the chat tidy.** It remembers the last console message per chat and,
  after posting a fresh one, deletes the previous console + the user's `/start`
  message (a full history wipe isn't possible via the Bot API).
- **On boot** it sets the bottom-left **menu button** to `commands` (so it
  exposes `/start` rather than launching the app directly) and registers the
  localized `/start` command (EN default, RU for `language_code = ru`).

---

## Language resolution

`langOf(ctx)` decides EN vs RU for every greeting:

1. **Cache hit** (`langCache`, 5-min TTL per user) → return immediately. This
   keeps the API call out of the reply's critical path so `/start` stays fast.
2. **Cache miss** → ask the API once:
   `GET {API_INTERNAL_URL}/internal/user-lang?tg_id=<id>`
   with header `X-Internal-Token: <ADMIN_TOKEN>` and a **2.5 s timeout**.
   - `lang = "en" | "ru"` → use it (the user picked this in the Mini App).
   - empty / error / timeout → fall back to the Telegram `language_code`.
3. The resolved value is cached for the TTL. A language change in the app
   therefore propagates to the bot within ≤5 min — fine for a greeting.

The reverse direction (app → DB) is handled by the API/Mini App: when the user
picks a language in Settings it is saved via `PATCH /profile/language`, which is
what `/internal/user-lang` later reads back.

If `API_INTERNAL_URL`/`ADMIN_TOKEN` are unset the lookup is skipped entirely and
the bot just uses `language_code` — so it degrades gracefully with no config.

---

## Performance & robustness notes

- **Reply first, clean up later** — the fresh console is sent before the old
  messages are deleted; the deletes run in the background, in parallel
  (fire-and-forget). Lower perceived latency.
- **Language cache** removes the per-`/start` API round-trip on the hot path.
- **Bounded maps** — `langCache` and `lastConsoleMsg` are capped (LRU, 10 000
  entries) via `boundedSet`, so long-lived per-user/per-chat state can't grow
  without bound over the bot's lifetime.
- **Startup** uses `drop_pending_updates: true` (skip the backlog queued while
  the bot was down) and `allowed_updates: ['message']` (only fetch what we
  handle) for lower startup lag and less wasted work.
- **Fail fast / shut down clean** — exits immediately if `BOT_TOKEN` is missing;
  handles `SIGINT`/`SIGTERM` so `docker stop` is graceful.

---

## Config (env)

| Var | Required | Purpose |
|-----|----------|---------|
| `BOT_TOKEN` | yes | Token from @BotFather — the **same** bot the API verifies `initData` against. |
| `MINI_APP_URL` | — | Mini App URL; must match what nginx serves (default `https://app.mvp-n.net/v2/`). |
| `API_INTERNAL_URL` | — | Internal API base for the language lookup (compose: `http://api:8081`). Unset → skip lookup. |
| `ADMIN_TOKEN` | — | Internal token for `/internal/user-lang` (compose: `${INTERNAL_TOKEN_BOT:-${CONNECT_ADMIN_TOKEN:-}}`). Unset → skip lookup. |

---

## Local dev

```bash
cd bot
npm install
cp .env.example .env   # fill BOT_TOKEN
npm run dev            # tsx watch
```

> Only one process may poll a given bot token at a time — stop other instances
> (including the docker `bot` service) before running `npm run dev`, or Telegram
> returns 409 Conflict.

---

## Production

Runs as the `bot` service in `docker-compose.yml`; the deploy workflow rebuilds
it whenever `bot/` changes. Build: `npm run build` (tsc → `dist/`) →
`node dist/index.js`. Node 20 (global `fetch` / `AbortSignal.timeout`).
