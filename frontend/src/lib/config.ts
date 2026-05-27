/** Display brand shown in the header. */
export const BRAND = 'mvp-n'

/** Telegram bot handle (footer / links). */
export const BOT = '@mvp_n_net_bot'

/** REST API base — `gw.mvp-n.net` proxies to the API on :8081. Override with VITE_API_BASE. */
export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  'https://gw.mvp-n.net'

/** Subscription link base — what clients import (Happ / v2RayTun). */
export const SUB_BASE =
  (import.meta.env.VITE_SUB_BASE as string | undefined) ??
  'https://connect.mvp-n.net/to/'

/**
 * Mock mode — ONLY when explicitly built with VITE_MOCK=1 (dev/preview).
 * Production builds never mock: they always hit the real API. This prevents
 * the app from silently serving fake data inside Telegram.
 */
export const USE_MOCK = import.meta.env.VITE_MOCK === '1'

export const subLink = (shortId: string) => SUB_BASE + shortId
