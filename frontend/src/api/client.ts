import { API_BASE, USE_MOCK } from '../lib/config'
import { mockRequest } from './mock'

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

/**
 * Single request entry point. In mock mode it hits the in-memory backend; in
 * Telegram it calls the real API, unwrapping the { status, data } envelope and
 * raising ApiError on a non-OK envelope.
 */
export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  if (USE_MOCK) return mockRequest(method, path, body) as Promise<T>

  let res: Response
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (e: any) {
    throw new ApiError('NETWORK', e?.message || 'network error')
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
