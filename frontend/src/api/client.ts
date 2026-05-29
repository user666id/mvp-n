import { API_BASE, USE_MOCK } from '../lib/config'
import { mockRequest } from './mock'
import { getInitData } from '../lib/telegram'

const TOKEN_KEY = 'mvpn_jwt'

export const getToken = () => localStorage.getItem(TOKEN_KEY) ?? ''
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status = 0) {
    super(message || code)
    this.code = code
    this.status = status
  }
}

// Hung requests in the Telegram WebView would otherwise spin forever — abort them.
const TIMEOUT_MS = 20000

async function rawFetch(
  method: string,
  path: string,
  body: unknown,
  withAuth: boolean,
): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(API_BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(withAuth && getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

// Silently re-mint a JWT from Telegram initData (always available in-app).
// Returns true if a fresh token was stored.
async function reauth(): Promise<boolean> {
  const initData = getInitData()
  if (!initData) return false
  try {
    const res = await rawFetch('POST', '/auth/token', { init_data: initData }, false)
    const json = await res.json().catch(() => null)
    const token = json?.data?.token ?? json?.token
    if (res.ok && token) {
      setToken(token)
      return true
    }
  } catch {
    /* ignore — caller surfaces the original error */
  }
  return false
}

/**
 * Single request entry point. In mock mode it hits the in-memory backend; in
 * Telegram it calls the real API, unwrapping the { status, data } envelope and
 * raising ApiError on a non-OK envelope.
 *
 * Resilience:
 *  - 20s timeout so a stalled WebView request fails instead of hanging forever.
 *  - On 401 (expired/invalid JWT) it re-authenticates once from initData and
 *    retries — so the app self-heals on token expiry instead of needing a restart.
 */
export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retried = false,
): Promise<T> {
  if (USE_MOCK) return mockRequest(method, path, body) as Promise<T>

  let res: Response
  try {
    res = await rawFetch(method, path, body, true)
  } catch (e: any) {
    const code = e?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK'
    throw new ApiError(code, e?.message || 'network error')
  }

  // JWT expired/invalid → re-auth once and replay the request.
  if (res.status === 401 && !retried && path !== '/auth/token') {
    if (await reauth()) return request<T>(method, path, body, true)
  }

  let json: any = null
  try {
    json = await res.json()
  } catch {
    /* empty / non-JSON body */
  }

  if (!res.ok || (json && json.status === false)) {
    throw new ApiError(
      json?.errorCode || 'HTTP_' + res.status,
      json?.message || res.statusText,
      res.status,
    )
  }
  return (json?.data ?? json) as T
}
