// A tiny stale-while-revalidate (SWR) data cache shared by EVERY screen.
//
// Why: each screen used to own a private useState + load() that reset to a
// skeleton on every (re)activation and refetched from zero — so a dropped request
// in the Telegram WebView left a view stuck blank until a full app re-open. This
// store keeps last-known data, revalidates in the background, NEVER wipes to null
// on re-activation, and recovers globally on resume — the "instant + stable"
// loading the user wanted, modeled on how Telegram Wallet feels.
//
// Deliberate constraints (from the design review):
//  - Only safe DISPLAY lists are persisted to localStorage (configs, devices) for
//    an instant cold-boot paint. Profile/gating data is NEVER persisted, so an
//    expired/non-admin user can never get a flash of unlocked/admin UI from disk.
//  - Order/invoice/nonce endpoints are NOT cached (callers keep direct requests),
//    so the pay-again guard and payment status are always fresh.
//  - The whole cache is cleared on logout / token change (account switch), so one
//    account never sees another's data.

type Entry = {
  data?: unknown
  error?: unknown
  ts: number // last successful fetch (ms); 0 = stale
  promise?: Promise<void> // in-flight revalidate (de-dupe)
  fetcher?: () => Promise<unknown>
  active: number // how many mounted subscribers are currently active
  epoch: number // bumped on mutate/clear; a revalidate only commits if still current
  listeners: Set<() => void>
}

const store = new Map<string, Entry>()

// Skip a revalidate if fresh data was fetched within this window (avoids a
// thundering herd of refetches when Telegram resumes and fires several events).
// Error'd keys and forced revalidates bypass it, so a just-failed view always
// gets another chance on resume.
const THROTTLE_MS = 3000

// Only these (non-sensitive, user-scoped display lists) are mirrored to
// localStorage for an instant cold-boot paint. NOT profile (gating), NOT orders.
const PERSIST = new Set(['configs', 'devices'])
const LS_PREFIX = 'mvpn_c_'

// Persisted lists are namespaced by the Telegram user id (set in initTelegram), so
// a different account on the same device can never read the previous one's cold-boot
// data. Missing id (e.g. browser/mock) → 'anon'.
function lsKey(key: string): string {
  let uid = 'anon'
  try {
    uid = localStorage.getItem('mvpn_uid') || 'anon'
  } catch {
    /* ignore */
  }
  return LS_PREFIX + uid + '_' + key
}

function ent(key: string): Entry {
  let e = store.get(key)
  if (!e) {
    e = { ts: 0, active: 0, epoch: 0, listeners: new Set() }
    // Seed a persisted display list so a cold boot paints last-known data
    // immediately; ts stays 0 so it revalidates on first activation.
    if (PERSIST.has(key)) {
      try {
        const raw = localStorage.getItem(lsKey(key))
        if (raw) e.data = JSON.parse(raw)
      } catch {
        /* corrupt/absent — ignore */
      }
    }
    store.set(key, e)
  }
  return e
}

function notify(e: Entry) {
  e.listeners.forEach((l) => l())
}

function persist(key: string, data: unknown) {
  if (!PERSIST.has(key)) return
  try {
    localStorage.setItem(lsKey(key), JSON.stringify(data))
  } catch {
    /* quota/serialize — non-fatal */
  }
}

export function read(key: string): Entry {
  return ent(key)
}

export function subscribe(key: string, cb: () => void): () => void {
  const e = ent(key)
  e.listeners.add(cb)
  return () => e.listeners.delete(cb)
}

export function setFetcher(key: string, f: () => Promise<unknown>) {
  ent(key).fetcher = f
}

export function markActive(key: string, on: boolean) {
  const e = ent(key)
  e.active = Math.max(0, e.active + (on ? 1 : -1))
}

/** Fetch + commit, de-duped and throttled. Stale data is kept on failure. */
export function revalidate(key: string, opts: { force?: boolean } = {}): Promise<void> | void {
  const e = ent(key)
  if (!e.fetcher) return
  if (!opts.force) {
    if (e.promise) return e.promise // de-dupe concurrent (non-forced) revalidates
    const hasData = e.data !== undefined
    if (hasData && !e.error && Date.now() - e.ts < THROTTLE_MS) return // throttle
  } else if (e.promise) {
    // A FORCED revalidate (resume / retry / post-payment poll) must NOT ride a
    // slow in-flight fetch that may carry pre-action (e.g. pre-credit) data —
    // invalidate that result via the epoch and start a fresh fetch.
    e.epoch++
  }
  const epoch = e.epoch
  let current: Promise<void> | undefined
  const run = async () => {
    try {
      const data = await e.fetcher!()
      if (e.epoch === epoch) {
        // A stale result from before an optimistic mutate / forced refetch must
        // NOT clobber the newer state.
        e.data = data
        e.error = undefined
        e.ts = Date.now()
        persist(key, data)
      }
    } catch (err) {
      // Only surface an error when we have NOTHING to show; otherwise keep the
      // last-known data visible (a failed background refresh is invisible).
      if (e.epoch === epoch && e.data === undefined) e.error = err
    } finally {
      if (e.promise === current) e.promise = undefined // don't clear a newer fetch's promise
      notify(e)
    }
  }
  current = run()
  e.promise = current
  return current
}

/** Mark keys stale and refetch the ones with an active subscriber now. */
export function invalidate(...keys: string[]) {
  for (const key of keys) {
    const e = ent(key)
    e.ts = 0
    if (e.active > 0) revalidate(key, { force: true })
  }
}

/** Resume recovery: refresh every active view, mark the rest stale-on-next-open. */
export function invalidateAll() {
  for (const [key, e] of store) {
    e.ts = 0
    if (e.active > 0) revalidate(key, { force: true })
  }
}

/** Optimistic write: update now, bump epoch so an in-flight revalidate can't
 *  overwrite it. Returning undefined is a no-op (e.g. nothing cached yet).
 *  Callers should follow with the real request + invalidate(key) to reconcile. */
export function mutate<T>(key: string, updater: (prev: T | undefined) => T | undefined) {
  const e = ent(key)
  const next = updater(e.data as T | undefined)
  if (next === undefined) return
  e.data = next
  e.epoch++
  persist(key, e.data)
  notify(e)
}

/** Wipe everything (logout / account switch) so no account sees another's data. */
export function clearAll() {
  for (const e of store.values()) {
    e.epoch++ // invalidate any in-flight revalidate
    e.data = undefined
    e.error = undefined
    e.ts = 0
    e.promise = undefined
  }
  store.clear()
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(LS_PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}
