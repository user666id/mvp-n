import { describe, it, expect, beforeEach, vi } from 'vitest'
import { request, ApiError, getToken, clearToken } from './client'

// Fake fetch Response with just the bits client.ts touches.
const resp = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: 'x',
  json: async () => body,
})

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  clearToken()
  fetchMock = vi.fn()
  ;(globalThis as Record<string, unknown>).fetch = fetchMock
})

describe('request envelope', () => {
  it('unwraps { status, data } to data', async () => {
    fetchMock.mockResolvedValueOnce(resp(200, { status: true, statusCode: 200, data: { x: 1 } }))
    await expect(request('GET', '/profile')).resolves.toEqual({ x: 1 })
  })

  it('throws ApiError with errorCode when status:false', async () => {
    fetchMock.mockResolvedValueOnce(resp(200, { status: false, errorCode: 'KEY_EXPIRED', message: 'no' }))
    await expect(request('POST', '/auth/key', {})).rejects.toMatchObject({
      name: 'ApiError',
      code: 'KEY_EXPIRED',
    })
  })

  it('throws ApiError on an HTTP error (carries the errorCode + status)', async () => {
    fetchMock.mockResolvedValueOnce(resp(500, { status: false, errorCode: 'DB_ERROR', message: 'internal server error' }))
    const err = (await request('GET', '/configs').catch((e) => e)) as ApiError
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('DB_ERROR')
    expect(err.status).toBe(500)
  })
})

describe('request resilience', () => {
  it('retries a GET after a transient network error', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(resp(200, { status: true, data: { y: 2 } }))
    await expect(request('GET', '/configs')).resolves.toEqual({ y: 2 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('on 401 re-auths from initData once and replays', async () => {
    fetchMock
      .mockResolvedValueOnce(resp(401, {})) // original → unauthorized
      .mockResolvedValueOnce(resp(200, { data: { token: 'fresh-jwt' } })) // POST /auth/token
      .mockResolvedValueOnce(resp(200, { status: true, data: { ok: 1 } })) // replay
    await expect(request('GET', '/profile')).resolves.toEqual({ ok: 1 })
    expect(getToken()).toBe('fresh-jwt')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
