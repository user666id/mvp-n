export type Protocol = 'vless' | 'awg'

/** A VPN config row as returned by GET /configs and friends. */
export interface Config {
  id: string
  short_id: string
  name: string
  protocol: string
  location: string
  enhanced: boolean
  game_mode: boolean
  vless_uri: string
  /** AmneziaWG client .conf (only for protocol === 'awg'). */
  awg_conf?: string
  is_active: boolean
  server_online: boolean
}

/** Live status of an AmneziaWG peer (GET /configs/{id}/awgStats). */
export interface AwgStats {
  online: boolean
  rx?: number
  tx?: number
  last_handshake?: number // unix seconds, 0 = never
  launcher?: string
}

export interface AuthResult {
  token: string
  user_exists: boolean
  needs_activation: boolean
  is_admin: boolean
  internal_id?: number
  is_active?: boolean
}

/** Account profile from GET /profile. */
export interface Profile {
  id: number
  internal_id: number
  username: string
  first_name: string
  last_name: string
  is_active: boolean
  is_admin: boolean
  is_blocked: boolean
  created_at: string
  traffic_used: number
  traffic_limit: number
  devices_count: number
  configs_count: number
  device_limit: number
}

/** A user row in the admin profiles list. */
export interface AdminProfile {
  id: number
  internal_id: number
  username: string
  first_name: string
  is_active: boolean
  is_blocked: boolean
  is_admin: boolean
  created_at: string
  traffic_used: number
  devices_count: number
  configs_count: number
}

/** A user's config row in the admin profile view (GET /admin/profiles/{id}/configs). */
export interface AdminConfig {
  id: string
  name: string
  protocol: string
  enhanced: boolean
  game_mode: boolean
  is_active: boolean
  created_at: string
}

/** Live reachability of a public domain (GET /admin/domains). */
export interface DomainStatus {
  name: string
  url: string
  ok: boolean
  status: number
  ms: number
  error?: string
}

/** A generated access key (POST /admin/keys response item). */
export interface AccessKey {
  key: string
  expires_at: string
}

/** An access key row from GET /admin/keys. */
export interface AccessKeyRow {
  id: string
  key: string
  comment: string
  used_by?: number
  used_by_internal?: number
  used_at?: string
  expires_at: string
  created_at: string
  is_valid: boolean
}

/** A connected device from GET /profile/devices. */
export interface Device {
  id: string
  name: string
  os?: string // OS only (iOS/Android/Windows…), separate from name (which may be a model)
  client: string // launcher: Happ / v2RayTun / v2rayNG / AmneziaVPN / ...
  ip: string
  last_seen: string
  is_blocked: boolean
  /** True when the device passed traffic through the VPN in the last few minutes. */
  online?: boolean
  /** "device" = VLESS device; "awg" = AmneziaWG config surfaced as a device. */
  kind?: 'device' | 'awg'
}

/** Payload behind GET /configs/{id}/serverStats — drives the stat charts. */
export interface ServerStats {
  hostname: string
  cpu_model: string
  online: boolean
  uptime_days: number
  timestamps: string[]
  cpu: number[]
  ram: number[]
  net_in: number[]
  net_out: number[]
}
