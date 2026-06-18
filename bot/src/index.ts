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
// The open-app console is ALWAYS English (product decision). One line + button —
// no greeting, no brand line, no value prop.
const WELCOME = 'Tap the button below to open.'
const BUTTON = 'Open'

// ── Telegram Stars ───────────────────────────────────────────────────────────
// Stars price per plan — MUST mirror api StarsByDays (plans.go). Used to validate
// the pre_checkout_query (raw Star count; XTR has no *100) in-memory so we answer
// within Telegram's hard 10s deadline without any network call.
const STARS_BY_DAYS: Record<number, number> = { 7: 150, 30: 350, 90: 800, 365: 2600 }

// invoice_payload is "uid:days:nonce", built server-side from the authed user.
function parsePayload(p: string): { uid: number; days: number } | null {
  const m = /^(\d+):(\d+):\d+$/.exec(p || '')
  if (!m) return null
  return { uid: Number(m[1]), days: Number(m[2]) }
}

// Insert into a Map capped at `cap` entries. Map keeps insertion order, so the
// first key is the oldest — drop it when over capacity. Re-inserting an existing
// key moves it to the most-recent slot (simple LRU). Keeps long-lived per-chat /
// per-user state from growing without bound over the bot's lifetime.
function boundedSet<K, V>(m: Map<K, V>, key: K, val: V, cap: number) {
  m.delete(key)
  m.set(key, val)
  if (m.size > cap) m.delete(m.keys().next().value as K)
}

// Inline button (inside the message) that launches the Mini App. No emoji.
const consoleKeyboard = {
  inline_keyboard: [[{ text: BUTTON, web_app: { url: MINI_APP_URL } }]],
}

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

  const sent = await ctx.reply(WELCOME, { reply_markup: consoleKeyboard })
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

// ── Telegram Stars payments ──────────────────────────────────────────────────
// pre_checkout_query has NO chat, so it must be on the TOP-LEVEL bot (not `pm`,
// which filters by chat type). Answer within 10s using only in-memory checks —
// never a network call here, or the deadline lapses and the charge auto-cancels.
bot.on('pre_checkout_query', async (ctx) => {
  const q = ctx.preCheckoutQuery
  const p = parsePayload(q.invoice_payload)
  const expected = p ? STARS_BY_DAYS[p.days] : undefined
  const ok = q.currency === 'XTR' && p != null && expected != null && q.total_amount === expected
  try {
    await ctx.answerPreCheckoutQuery(ok, ok ? undefined : { error_message: 'Payment could not be validated.' })
  } catch (e) {
    console.error('[bot] answerPreCheckoutQuery failed', e)
  }
})

// successful_payment is a service Message (no .text, so the text handler below
// won't swallow it). Fulfillment source of truth — credit via the internal API.
pm.on('message:successful_payment', async (ctx) => {
  const sp = ctx.message.successful_payment
  const p = parsePayload(sp.invoice_payload)
  // Cross-check the charged amount against the plan before crediting.
  if (!p || sp.total_amount !== STARS_BY_DAYS[p.days]) {
    console.error('[bot] successful_payment payload/amount mismatch', sp)
    return
  }
  if (!API_INTERNAL_URL || !ADMIN_TOKEN) {
    console.error('[bot] CREDIT IMPOSSIBLE — API_INTERNAL_URL/ADMIN_TOKEN unset; buyer charged', sp.telegram_payment_charge_id)
    return
  }
  try {
    const res = await fetch(`${API_INTERNAL_URL}/internal/credit-subscription`, {
      method: 'POST',
      headers: { 'X-Internal-Token': ADMIN_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tg_id: p.uid,
        plan_days: p.days,
        stars_amount: sp.total_amount,
        charge_id: sp.telegram_payment_charge_id, // dedup key + refund handle
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error('[bot] CREDIT FAILED — buyer charged, not credited', sp.telegram_payment_charge_id, res.status)
    }
  } catch (e) {
    console.error('[bot] CREDIT ERROR — buyer charged, not credited', sp.telegram_payment_charge_id, e)
  }
})

// Any plain text in a private chat → fresh console (kept LAST so the specific
// payment handler above takes precedence).
pm.on('message:text', sendConsole)

bot.catch((err) => {
  console.error('[bot] error while handling update', err.error)
})

// ── Bootstrap ──────────────────────────────────────────────────────────────────
async function main() {
  // The bottom-left menu button shows the commands menu (with /start) rather than
  // launching the Mini App directly — so tapping it lets the user restart the
  // console (/start) instead of opening a possibly-stale web view.
  await Promise.all([
    bot.api.setChatMenuButton({ menu_button: { type: 'commands' } }),
    bot.api.setMyCommands([{ command: 'start', description: 'Open mvp-n' }]),
    bot.api.setMyCommands([{ command: 'start', description: 'Открыть mvp-n' }], {
      language_code: 'ru',
    }),
  ])

  console.log(`[bot] starting; mini app = ${MINI_APP_URL}`)
  await bot.start({
    // Keep pending updates: a successful_payment queued during a deploy restart
    // must survive (Stars has no on-chain-style re-poll fallback). Crediting is
    // idempotent on telegram_payment_charge_id, so reprocessing is safe.
    drop_pending_updates: false,
    // Must include pre_checkout_query (else every Stars charge auto-cancels at
    // 10s) and message (carries successful_payment + /start text).
    allowed_updates: ['message', 'pre_checkout_query'],
    onStart: (me) =>
      console.log(`[bot] online as @${me.username} (allowed_updates: message, pre_checkout_query)`),
  })
}

// Graceful shutdown for docker stop.
process.once('SIGINT', () => bot.stop())
process.once('SIGTERM', () => bot.stop())

main().catch((e) => {
  console.error('[bot] fatal', e)
  process.exit(1)
})
