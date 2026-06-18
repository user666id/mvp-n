// In-memory mock backend used when running outside Telegram (USE_MOCK).
// Mirrors the Go handlers' response data shapes so screens render realistically.
import type { Config, Device, Profile, ServerStats } from './types'

let activated = true // start activated so the configs list is visible in preview
let paidUntil: string | null = new Date(Date.now() + 25 * 86_400_000).toISOString() // null = key/lifetime
const uuid = () => crypto.randomUUID()
const short = () => Math.random().toString(16).slice(2, 14)

function buildUri(id: string, enhanced: boolean, game: boolean) {
  const port = enhanced ? 43001 : 43000
  const type = enhanced ? 'xhttp' : 'tcp'
  const xhttp = enhanced ? '&path=%2Fmvpn&mode=packet-up' : ''
  const flow = !enhanced && !game ? '&flow=xtls-rprx-vision' : ''
  return `vless://${id}@203.0.113.10:${port}?type=${type}&security=reality&pbk=demoPublicKeyXXXXXXXXXXXXXXXXXXXXXXXXXXXX&sid=ab12${xhttp}${flow}&fp=chrome#%F0%9F%87%B3%F0%9F%87%B1%20mvp-n`
}

function makeConfig(over: Partial<Config> = {}): Config {
  const id = uuid()
  const enhanced = over.enhanced ?? true
  const game = over.game_mode ?? false
  return {
    id,
    short_id: short(),
    name: '',
    protocol: 'vless',
    location: 'netherlands',
    enhanced,
    game_mode: game,
    vless_uri: buildUri(id, enhanced, game),
    is_active: true,
    server_online: true,
    ...over,
  }
}

const configs: Config[] = [makeConfig({ name: '' })]

function stats(): ServerStats {
  const n = 72 // 24h at ~20-min steps
  const now = Date.now()
  const ts: string[] = []
  const cpu: number[] = []
  const ram: number[] = []
  const netIn: number[] = []
  const netOut: number[] = []
  let c = 8,
    r = 40
  for (let i = 0; i < n; i++) {
    ts.push(new Date(now - (n - i) * 20 * 60_000).toISOString())
    c = Math.max(2, Math.min(60, c + (Math.random() - 0.45) * 6))
    r = Math.max(20, Math.min(85, r + (Math.random() - 0.5) * 4))
    cpu.push(+c.toFixed(1))
    ram.push(+r.toFixed(1))
    // bytes/s — skewed low (idle KB/s) with occasional MB/s spikes.
    netIn.push(Math.round(Math.random() ** 3 * 9_000_000 + 40_000))
    netOut.push(Math.round(Math.random() ** 3 * 6_000_000 + 30_000))
  }
  return {
    hostname: 'nl-1.mvp-n.network',
    server_ip: '203.0.113.10',
    cpu_model: 'AMD EPYC 7543 32-Core Processor',
    online: true,
    uptime_days: 10,
    timestamps: ts,
    cpu,
    ram,
    net_in: netIn,
    net_out: netOut,
  }
}

// ── profile + devices ────────────────────────────────────────────────────────
const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString()
let devices: Device[] = [
  { id: uuid(), name: 'iPhone 14 Pro Max', os: 'iOS', client: 'Happ', last_seen: ago(6), is_blocked: false },
  { id: uuid(), name: 'iPhone 14 Pro Max', os: 'iOS', client: 'v2RayTun', last_seen: ago(40), is_blocked: false },
  { id: uuid(), name: 'SM-A366B', os: 'Android', client: 'v2rayNG', last_seen: ago(1500), is_blocked: false },
  { id: uuid(), name: 'Windows', os: 'Windows', client: 'v2RayTun', last_seen: ago(4320), is_blocked: false },
]

let deviceLimit = 15

function profile(): Profile {
  return {
    id: 123456789,
    internal_id: 1,
    username: 'user666id',
    first_name: 'mvp-n',
    last_name: '',
    is_active: activated,
    is_admin: true,
    is_blocked: false,
    created_at: ago(60 * 24 * 30),
    traffic_used: 42_949_672_960, // ~40 GB
    traffic_limit: 0,
    devices_count: devices.filter((d) => !d.is_blocked).length,
    configs_count: configs.filter((c) => c.is_active).length,
    device_limit: deviceLimit,
    paid_until: activated ? paidUntil : null, // null = key/lifetime (or not-yet-activated)
    is_expired: false,
  }
}

// ── admin mock data ──
const adminProfiles = [
  { id: 123456789, internal_id: 1, username: 'user666id', first_name: 'mvp-n', is_active: true, is_blocked: false, is_admin: true, created_at: ago(43200), traffic_used: 42_949_672_960, devices_count: 4, configs_count: 1, paid_until: null, is_expired: false }, // key/lifetime
  { id: 552310118, internal_id: 2, username: 'alex_k', first_name: 'Alex', is_active: true, is_blocked: false, is_admin: false, created_at: ago(20000), traffic_used: 8_589_934_592, devices_count: 2, configs_count: 1, paid_until: new Date(Date.now() + 12 * 86_400_000).toISOString(), is_expired: false }, // paid, active
  { id: 690221764, internal_id: 3, username: '', first_name: 'Иван', is_active: true, is_blocked: false, is_admin: false, created_at: ago(5000), traffic_used: 1_073_741_824, devices_count: 1, configs_count: 1, paid_until: new Date(Date.now() - 3 * 86_400_000).toISOString(), is_expired: true }, // paid, expired
]
let adminKeys: any[] = [
  { id: uuid(), key: 'A1B2-C3D4', comment: '', expires_at: ago(-600), created_at: ago(120), is_valid: true },
]

// Mock orders: pending → 'paid' ~6s after creation (simulates on-chain confirm).
const mockOrders: Record<string, { created: number; plan_days: number; asset: string; amount: string; address: string }> = {}
const cancelledOrders = new Set<string>()
const paidOrders = new Set<string>()
const USD_PRICE: Record<number, number> = { 7: 2, 30: 5, 90: 12, 365: 40 }
const GRAM_USD = 1.79 // demo live rate
const mockNet = (a: string) => (a === 'USDT_TRC20' ? 'TRC20' : 'TON')
const mockAddr = (a: string) =>
  a === 'USDT_TRC20' ? 'YOUR_TRON_WALLET_ADDRESS' : 'YOUR_TON_WALLET_ADDRESS'

const delay = (ms = 280) => new Promise((r) => setTimeout(r, ms))

/** Routes a logical request to the in-memory store. Returns the `data` payload. */
export async function mockRequest(
  method: string,
  path: string,
  body?: any,
): Promise<any> {
  await delay()
  const m = method.toUpperCase()

  if (path === '/auth/token')
    return { token: 'mock-jwt', user_exists: activated, needs_activation: !activated, is_admin: true }

  if (path === '/auth/key') {
    if (!body?.key?.trim()) throw { errorCode: 'BAD_REQUEST', message: 'key required' }
    activated = true
    paidUntil = null // a key grants lifetime access (бессрочно)
    return { activated: true, internal_id: 1 }
  }

  if (path === '/plans')
    return {
      plans: [
        { days: 7, usd: 2 },
        { days: 30, usd: 5 },
        { days: 90, usd: 12 },
        { days: 365, usd: 40 },
      ],
      assets: [
        { id: 'TON', label: 'GRAM', network: 'TON' },
        { id: 'USDT_TON', label: 'USDT', network: 'TON' },
        { id: 'USDT_TRC20', label: 'USDT', network: 'TRC20' },
        { id: 'STARS', label: 'Stars', network: 'Telegram' },
      ],
      gram_usd: GRAM_USD,
      stars_by_days: { 7: 150, 30: 350, 90: 800, 365: 2600 },
    }

  if (path === '/stars/invoice' && m === 'POST') {
    const days = body?.plan_days || 30
    const stars = ({ 7: 150, 30: 350, 90: 800, 365: 2600 } as Record<number, number>)[days] ?? 350
    return { url: 'https://t.me/invoice/mock', stars, plan_days: days }
  }

  if (path === '/orders' && m === 'POST') {
    const id = uuid()
    const asset = body?.asset || 'TON'
    const days = body?.plan_days || 30
    const usd = USD_PRICE[days] ?? 5
    const base = asset === 'TON' ? usd / GRAM_USD : usd // GRAM at live rate, USDT 1:1
    const amount = (base + 0.0037).toFixed(4)
    mockOrders[id] = { created: Date.now(), plan_days: days, asset, amount, address: mockAddr(asset) }
    return {
      id, asset, network: mockNet(asset), address: mockAddr(asset), amount, plan_days: days,
      expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    }
  }

  if (path === '/orders/history' && m === 'GET') {
    // A couple of demo past payments + any session order that has been paid.
    const demo: any[] = [
      { id: 'h1', asset: 'TON', network: 'TON', amount: '2.7970', plan_days: 30, status: 'paid', paid_at: new Date(Date.now() - 20 * 86_400_000).toISOString(), created_at: new Date(Date.now() - 20 * 86_400_000).toISOString(), tx_hash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2:0' },
      { id: 'h2', asset: 'USDT_TON', network: 'TON', amount: '15.0000', plan_days: 90, status: 'paid', paid_at: new Date(Date.now() - 95 * 86_400_000).toISOString(), created_at: new Date(Date.now() - 95 * 86_400_000).toISOString(), tx_hash: 'f0e1d2c3b4a5968778695a4b3c2d1e0f' },
    ]
    const session = Object.entries(mockOrders)
      .filter(([, o]) => Date.now() - o.created > 6000)
      .map(([id, o]) => ({ id, asset: o.asset, network: mockNet(o.asset), amount: o.amount, plan_days: o.plan_days, status: 'paid', paid_at: new Date(o.created + 6000).toISOString(), created_at: new Date(o.created).toISOString(), tx_hash: 'deadbeef'.repeat(8) }))
    return [...session, ...demo].sort((a, b) => +new Date(b.paid_at || b.created_at) - +new Date(a.paid_at || a.created_at))
  }

  if (path === '/orders/pending' && m === 'GET') {
    // All still-open orders (not cancelled, not yet paid), newest first.
    return Object.entries(mockOrders)
      .filter(([id, o]) => !cancelledOrders.has(id) && !paidOrders.has(id) && Date.now() - o.created <= 30 * 60_000)
      .sort((a, b) => b[1].created - a[1].created)
      .map(([id, o]) => ({
        id, status: 'pending', asset: o.asset, network: mockNet(o.asset),
        amount: o.amount, address: o.address, plan_days: o.plan_days,
        expires_at: new Date(o.created + 30 * 60_000).toISOString(),
      }))
  }

  if (path.match(/^\/orders\/[^/]+\/cancel$/) && m === 'POST') {
    cancelledOrders.add(path.split('/')[2])
    return { cancelled: true }
  }

  if (path.startsWith('/orders/') && m === 'GET') {
    const o = mockOrders[path.split('/')[2]]
    if (!o) throw { errorCode: 'NOT_FOUND', message: 'order not found' }
    const paid = Date.now() - o.created > 6000
    if (paid) {
      paidOrders.add(path.split('/')[2])
      activated = true // a paid order activates a brand-new buyer
      paidUntil = new Date(Date.now() + o.plan_days * 86_400_000).toISOString() // term = plan length
    }
    return {
      id: path.split('/')[2], status: paid ? 'paid' : 'pending',
      asset: o.asset, network: mockNet(o.asset), amount: o.amount, address: o.address, plan_days: o.plan_days,
      ...(paid ? { paid_at: new Date().toISOString() } : {}),
    }
  }

  if (path === '/configs' && m === 'GET') return configs.filter((c) => c.is_active)

  if (path === '/configs' && m === 'POST') {
    const c = makeConfig({ enhanced: body?.enhanced ?? true, game_mode: body?.game_mode ?? false })
    configs.unshift(c)
    return c
  }

  const idMatch = path.match(/^\/configs\/([^/]+)(\/(settings|title))?$/)
  if (idMatch) {
    const c = configs.find((x) => x.id === idMatch[1])
    if (!c) throw { errorCode: 'NOT_FOUND', message: 'config not found' }
    const sub = idMatch[3]
    if (m === 'DELETE') {
      c.is_active = false
      return { deleted: true }
    }
    if (sub === 'title') {
      c.name = body?.name ?? c.name
      return { renamed: true }
    }
    if (sub === 'settings') {
      if (typeof body?.enhanced === 'boolean') c.enhanced = body.enhanced
      if (typeof body?.game_mode === 'boolean') c.game_mode = body.game_mode
      c.vless_uri = buildUri(c.id, c.enhanced, c.game_mode)
      return c
    }
    return c // GET /configs/{id}
  }

  if (path.endsWith('/serverStats')) return stats()

  // ── profile / devices ──
  if (path === '/profile' && m === 'GET') return profile()
  if (path === '/profile' && m === 'DELETE') {
    throw { errorCode: 'ADMIN_PROTECTED', message: 'admin account cannot be deleted' }
  }
  if (path === '/profile/devices') return devices
  if (path === '/profile/subscriptionLink') {
    devices = []
    return {}
  }
  if (path === '/profile/device-limit') {
    deviceLimit = Math.max(0, Number(body?.limit) || 0)
    return { device_limit: deviceLimit }
  }
  if (path === '/profile/language') {
    return { lang: body?.lang === 'ru' ? 'ru' : 'en' }
  }

  // ── admin ──
  if (path === '/admin/keys' && m === 'POST') {
    const n = Math.min(100, Math.max(1, Number(body?.count) || 1))
    const ttl = Number(body?.ttl_hours) || 12
    const planDays = Number(body?.plan_days) || 0 // 0 = lifetime
    const exp = new Date(Date.now() + ttl * 3600_000).toISOString()
    const hex = () => Math.random().toString(16).slice(2, 6).toUpperCase()
    const keys = Array.from({ length: n }, () => ({ key: `${hex()}-${hex()}`, expires_at: exp }))
    keys.forEach((k) =>
      adminKeys.unshift({
        id: uuid(), key: k.key, comment: '', expires_at: exp,
        created_at: new Date().toISOString(), is_valid: true,
        ...(planDays > 0 ? { plan_days: planDays } : {}),
      }),
    )
    return { count: n, expires_at: exp, ttl_hours: ttl, plan_days: planDays, keys }
  }
  if (path === '/admin/keys' && m === 'GET') return adminKeys
  const keyDel = path.match(/^\/admin\/keys\/([^/]+)$/)
  if (keyDel && m === 'DELETE') {
    adminKeys = adminKeys.filter((k) => k.id !== keyDel[1] || k.used_at)
    return {}
  }
  if (path === '/admin/domains' && m === 'GET') {
    return [
      { name: 'gw.mvp-n.net', kind: 'web', ok: true, status: 200, ms: 42 },
      { name: 'app.mvp-n.net', kind: 'web', ok: true, status: 301, ms: 35 },
      { name: 'connect.mvp-n.net', kind: 'web', ok: true, status: 200, ms: 51 },
      { name: 'VLESS Vision · 43000', kind: 'vpn', ok: true, status: 0, ms: 3 },
      { name: 'VLESS XHTTP · 43001', kind: 'vpn', ok: true, status: 0, ms: 4 },
      { name: 'AmneziaWG · 51820', kind: 'vpn', ok: true, status: 0, ms: 6 },
      { name: 'PostgreSQL', kind: 'svc', ok: true, status: 0, ms: 2 },
      { name: 'xray API · 10085', kind: 'svc', ok: true, status: 0, ms: 1 },
    ]
  }
  if (path === '/admin/profiles' && m === 'GET') {
    return { total: adminProfiles.length, profiles: adminProfiles, traffic_today: 2_400_000_000 }
  }
  if (path.startsWith('/admin/traffic') && m === 'GET') {
    const n = 30
    const days = Array.from({ length: n }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (n - 1 - i))
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      // last day (today) lower — still counting; deterministic-ish sample data
      const base = 6_000_000_000 + ((i * 37) % 9) * 800_000_000
      return { day: iso, bytes: i === n - 1 ? 3_900_000_000 : base }
    })
    return { days, total: days.reduce((s, d) => s + d.bytes, 0) }
  }
  const apCfg = path.match(/^\/admin\/profiles\/([^/]+)\/configs$/)
  if (apCfg) {
    return configs
      .filter((c) => c.is_active)
      .map((c) => ({
        id: c.id, name: c.name, protocol: c.protocol,
        enhanced: c.enhanced, game_mode: c.game_mode,
        is_active: c.is_active, created_at: new Date().toISOString(),
      }))
  }
  if (path.match(/^\/admin\/profiles\/([^/]+)\/reset$/)) return {}
  const apDevAct = path.match(/^\/admin\/profiles\/([^/]+)\/devices\/([^/]+)\/(block|unblock)$/)
  if (apDevAct) {
    const d = devices.find((x) => x.id === apDevAct[2])
    if (d) d.is_blocked = apDevAct[3] === 'block'
    return {}
  }
  const apDev = path.match(/^\/admin\/profiles\/([^/]+)\/devices(\/([^/]+))?$/)
  if (apDev) {
    if (m === 'DELETE') return {}
    return devices // reuse current device set for the demo
  }
  const apBlock = path.match(/^\/admin\/profiles\/([^/]+)\/block$/)
  if (apBlock) return {}
  const apDel = path.match(/^\/admin\/profiles\/([^/]+)$/)
  if (apDel && m === 'DELETE') return {}
  const devMatch = path.match(/^\/profile\/devices\/([^/]+)(\/(name|block))?$/)
  if (devMatch) {
    const d = devices.find((x) => x.id === devMatch[1])
    if (!d) throw { errorCode: 'NOT_FOUND', message: 'device not found' }
    if (m === 'DELETE') {
      devices = devices.filter((x) => x.id !== d.id)
      return {}
    }
    if (devMatch[3] === 'name') {
      d.name = body?.name ?? d.name
      return {}
    }
    if (devMatch[3] === 'block') {
      d.is_blocked = true
      return {}
    }
  }

  throw { errorCode: 'NOT_FOUND', message: `mock: ${m} ${path}` }
}
