import { request, setToken } from './client'
import type {
  AccessKey, AccessKeyRow, AdminConfig, AdminProfile, AuthResult, AwgStats, Config, Device, DomainStatus, Order, PlansResponse, Profile, Protocol, ServerStats, StarsInvoice, TrafficDay,
} from './types'
import { getInitData } from '../lib/telegram'

export * from './types'
export { ApiError, clearToken, getToken } from './client'

export async function authTelegram(): Promise<AuthResult> {
  const res = await request<AuthResult>('POST', '/auth/token', {
    init_data: getInitData(),
  })
  if (res.token) setToken(res.token)
  return res
}

export function activateKey(key: string) {
  return request<{ activated: boolean; internal_id: number }>('POST', '/auth/key', {
    key: key.trim(),
  })
}

export function getConfigs() {
  return request<Config[]>('GET', '/configs')
}

export function createConfig(opts: {
  protocol: Protocol
  enhanced: boolean
  game_mode: boolean
}) {
  return request<Config>('POST', '/configs', {
    protocol: opts.protocol,
    location: 'netherlands',
    enhanced: opts.enhanced,
    game_mode: opts.game_mode,
  })
}

export function getConfig(id: string) {
  return request<Config>('GET', `/configs/${id}`)
}

export function renameConfig(id: string, name: string) {
  return request<{ renamed: boolean }>('PATCH', `/configs/${id}/title`, { name })
}

export function deleteConfig(id: string) {
  return request<{ deleted: boolean }>('DELETE', `/configs/${id}`)
}

export function updateSettings(
  id: string,
  patch: { enhanced?: boolean; game_mode?: boolean },
) {
  return request<Config>('PATCH', `/configs/${id}/settings`, patch)
}

export function getServerStats(id: string) {
  return request<ServerStats>('GET', `/configs/${id}/serverStats`)
}

export function getAwgStats(id: string) {
  return request<AwgStats>('GET', `/configs/${id}/awgStats`)
}

// ── profile / settings ───────────────────────────────────────────────────────

export function getProfile() {
  return request<Profile>('GET', '/profile')
}

export function getPlans() {
  return request<PlansResponse>('GET', '/plans')
}

export function createOrder(planDays: number, asset: string) {
  return request<Order>('POST', '/orders', { plan_days: planDays, asset })
}

export function createStarsInvoice(planDays: number) {
  return request<StarsInvoice>('POST', '/stars/invoice', { plan_days: planDays })
}

export function getOrder(id: string) {
  return request<Order>('GET', '/orders/' + id)
}

/** The caller's still-open orders (resume after a reload; list + cancel). */
export function getPendingOrders() {
  return request<Order[]>('GET', '/orders/pending')
}

/** Cancel one of the caller's pending orders. */
export function cancelOrder(id: string) {
  return request<{ cancelled: boolean }>('POST', `/orders/${id}/cancel`)
}

/** The caller's paid orders, newest first — for the payment-history view. */
export function getOrderHistory() {
  return request<Order[]>('GET', '/orders/history')
}

export function getDevices() {
  return request<Device[]>('GET', '/profile/devices')
}

export function renameDevice(id: string, name: string) {
  return request<unknown>('PATCH', `/profile/devices/${id}/name`, { name })
}

export function blockDevice(id: string) {
  return request<unknown>('POST', `/profile/devices/${id}/block`)
}

export function unblockDevice(id: string) {
  return request<unknown>('POST', `/profile/devices/${id}/unblock`)
}

export function deleteDevice(id: string) {
  return request<unknown>('DELETE', `/profile/devices/${id}`)
}

/** Resets the subscription link — server-side this wipes ALL devices. */
export function resetSubscriptionLink() {
  return request<unknown>('PATCH', '/profile/subscriptionLink')
}

export function setDeviceLimit(limit: number) {
  return request<{ device_limit: number }>('PATCH', '/profile/device-limit', { limit })
}

export function setLanguage(lang: 'en' | 'ru') {
  return request<{ lang: string }>('PATCH', '/profile/language', { lang })
}

export function deleteAccount() {
  return request<{ deleted: boolean }>('DELETE', '/profile')
}

// ── admin ────────────────────────────────────────────────────────────────────

export function adminCreateKeys(opts: {
  count?: number
  comment?: string
  ttl_hours?: number
  /** Subscription length the key grants. 0 = lifetime; N = N days. */
  plan_days?: number
}) {
  return request<{ count: number; expires_at: string; ttl_hours: number; keys: AccessKey[] }>(
    'POST',
    '/admin/keys',
    {
      count: opts.count ?? 1,
      comment: opts.comment ?? '',
      ttl_hours: opts.ttl_hours ?? 12,
      plan_days: opts.plan_days ?? 0,
    },
  )
}

export function adminListKeys() {
  return request<AccessKeyRow[]>('GET', '/admin/keys')
}

export function adminRevokeKey(id: string) {
  return request<unknown>('DELETE', `/admin/keys/${id}`)
}

export function adminListProfiles() {
  return request<{ total: number; profiles: AdminProfile[]; traffic_today: number }>(
    'GET',
    '/admin/profiles',
  )
}

export function adminGetDomains() {
  return request<DomainStatus[]>('GET', '/admin/domains')
}

export function adminGetTraffic(days = 30) {
  return request<{ days: TrafficDay[]; total: number }>('GET', `/admin/traffic?days=${days}`)
}

export function adminGetProfileDevices(id: number) {
  return request<Device[]>('GET', `/admin/profiles/${id}/devices`)
}

export function adminGetProfileConfigs(id: number) {
  return request<AdminConfig[]>('GET', `/admin/profiles/${id}/configs`)
}

export function adminResetProfile(id: number) {
  return request<unknown>('PATCH', `/admin/profiles/${id}/reset`)
}

export function adminDeleteProfileDevice(id: number, deviceId: string) {
  return request<unknown>('DELETE', `/admin/profiles/${id}/devices/${deviceId}`)
}

export function adminBlockProfileDevice(id: number, deviceId: string) {
  return request<unknown>('POST', `/admin/profiles/${id}/devices/${deviceId}/block`)
}

export function adminUnblockProfileDevice(id: number, deviceId: string) {
  return request<unknown>('POST', `/admin/profiles/${id}/devices/${deviceId}/unblock`)
}

export function adminBlockProfile(id: number) {
  return request<unknown>('POST', `/admin/profiles/${id}/block`)
}

export function adminDeleteProfile(id: number) {
  return request<unknown>('DELETE', `/admin/profiles/${id}`)
}
