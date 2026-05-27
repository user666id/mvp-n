import { Bot, type Context } from 'grammy'

// ── Config ───────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN
if (!BOT_TOKEN) {
  console.error('[bot] BOT_TOKEN is required')
  process.exit(1)
}

// URL of the Telegram Mini App. Must point at the path nginx serves it from
// (currently https://app.mvp-n.net/v2/).
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://app.mvp-n.net/v2/'

// Internal API (same docker network) used to read the UI language a user picked
// in the Mini App, so the bot greets them in the same language. Optional: if
// unset/unreachable the bot just falls back to the Telegram language_code.
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || ''
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''

const bot = new Bot(BOT_TOKEN)

// ── Texts ────────────────────────────────────────────────────────────────────
// Default language is English; Russian-speaking users get the Russian copy.
const WELCOME = {
  en: ['mvp-n', '', 'Press the button below to open.'].join('\n'),
  ru: ['mvp-n', '', 'Нажмите кнопку ниже, чтобы открыть.'].join('\n'),
}
const BUTTON = { en: 'Open console', ru: 'Открыть консоль' }

// Insert into a Map capped at `cap` entries. Map keeps insertion order, so the
// first key is the oldest — drop it when over capacity. Re-inserting an existing
// key moves it to the most-recent slot (simple LRU). Keeps long-lived per-chat /
// per-user state from growing without bound over the bot's lifetime.
function boundedSet<K, V>(m: Map<K, V>, key: K, val: V, cap: number) {
  m.delete(key)
  m.set(key, val)
  if (m.size > cap) m.delete(m.keys().next().value as K)
}

// Telegram client language — the fallback when the user hasn't chosen one in
// the Mini App yet.
const tgLang = (ctx: Context): 'en' | 'ru' =>
  (ctx.from?.language_code || '').toLowerCase().startsWith('ru') ? 'ru' : 'en'

// Short-lived per-user cache so we don't hit the API on every /start. A language
// change in the app propagates within TTL — fine for a greeting.
const LANG_TTL_MS = 5 * 60_000
const langCache = new Map<number, { lang: 'en' | 'ru'; exp: number }>()

// Resolve the language to greet in: the in-app choice (persisted via the API)
// wins; otherwise fall back to the Telegram language_code. Cached, never throws,
// and kept out of the reply's critical path on a cache hit.
async function langOf(ctx: Context): Promise<'en' | 'ru'> {
  const tgId = ctx.from?.id
  if (tgId == null) return tgLang(ctx)

  const hit = langCache.get(tgId)
  if (hit && hit.exp > Date.now()) return hit.lang

  let lang = tgLang(ctx)
  if (API_INTERNAL_URL && ADMIN_TOKEN) {
    try {
      const res = await fetch(`${API_INTERNAL_URL}/internal/user-lang?tg_id=${tgId}`, {
        headers: { 'X-Internal-Token': ADMIN_TOKEN },
        signal: AbortSignal.timeout(800),
      })
      if (res.ok) {
        const saved = (await res.json())?.data?.lang
        if (saved === 'en' || saved === 'ru') lang = saved
      }
    } catch {
      /* network/timeout — keep the Telegram language_code fallback */
    }
  }
  boundedSet(langCache, tgId, { lang, exp: Date.now() + LANG_TTL_MS }, 10_000)
  return lang
}

// Inline button (inside the message) that launches the Mini App. No emoji.
const keyboardFor = (lang: 'en' | 'ru') => ({
  inline_keyboard: [[{ text: BUTTON[lang], web_app: { url: MINI_APP_URL } }]],
})

// Track the last console message per chat so /start can tidy up before sending
// a fresh one (a full history wipe isn't possible via the Bot API).
const lastConsoleMsg = new Map<number, number>()

async function sendConsole(ctx: Context) {
  const chatId = ctx.chat?.id
  if (chatId == null) return

  // Grab the ids to clean up, then post the fresh console FIRST so it shows with
  // minimal latency (no waiting on the delete round-trips first).
  const stale = [ctx.message?.message_id, lastConsoleMsg.get(chatId)].filter(
    (id): id is number => typeof id === 'number',
  )

  const lang = await langOf(ctx)
  const sent = await ctx.reply(WELCOME[lang], { reply_markup: keyboardFor(lang) })
  boundedSet(lastConsoleMsg, chatId, sent.message_id, 10_000)

  // Tidy up the old /start message + previous console in the background, in
  // parallel — never blocks the reply, errors are harmless (already gone).
  for (const id of stale) ctx.api.deleteMessage(chatId, id).catch(() => {})
}

// ── Handlers ─────────────────────────────────────────────────────────────────
// Personal VPN console — only operate in private chats. Any group or channel the
// bot is added to is ignored (no console spam, no trying to delete others' msgs).
// /start, and any plain text treated as a restart, show a fresh console.
const pm = bot.chatType('private')
pm.command('start', sendConsole)
pm.on('message:text', sendConsole)

bot.catch((err) => {
  console.error('[bot] error while handling update', err.error)
})

// ── Bootstrap ──────────────────────────────────────────────────────────────────
async function main() {
  // The bottom-left "Меню" button just exposes /start (no direct app launch).
  // Localized command label: English by default, Russian for ru users.
  await Promise.all([
    bot.api.setChatMenuButton({ menu_button: { type: 'commands' } }),
    bot.api.setMyCommands([{ command: 'start', description: 'Restart' }]),
    bot.api.setMyCommands([{ command: 'start', description: 'Перезапустить' }], {
      language_code: 'ru',
    }),
  ])

  console.log(`[bot] starting; mini app = ${MINI_APP_URL}`)
  await bot.start({
    // Skip the backlog queued while the bot was down, and only fetch the update
    // type we actually handle — lower startup lag and less wasted work.
    drop_pending_updates: true,
    allowed_updates: ['message'],
    onStart: (me) => console.log(`[bot] online as @${me.username}`),
  })
}

// Graceful shutdown for docker stop.
process.once('SIGINT', () => bot.stop())
process.once('SIGTERM', () => bot.stop())

main().catch((e) => {
  console.error('[bot] fatal', e)
  process.exit(1)
})
