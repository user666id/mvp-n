// Thin wrapper over the Telegram WebApp SDK injected by telegram-web-app.js.
// Falls back gracefully to a no-op when running in a plain browser (dev/preview).

type HapticStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid'
type NotifyType = 'success' | 'error' | 'warning'

interface TgWebApp {
  initData: string
  colorScheme: 'light' | 'dark'
  ready: () => void
  expand: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  enableClosingConfirmation?: () => void
  onEvent?: (event: string, cb: () => void) => void
  showConfirm?: (message: string, cb: (ok: boolean) => void) => void
  HapticFeedback?: {
    impactOccurred: (style: HapticStyle) => void
    notificationOccurred: (type: NotifyType) => void
    selectionChanged: () => void
  }
}

export const tg: TgWebApp | undefined = (window as any).Telegram?.WebApp

/** True when launched as a real Telegram Mini App (signed initData present). */
export const inTelegram = Boolean(tg?.initData)

const CANVAS_LIGHT = '#faf9f5'
const CANVAS_DARK = '#0e0e0e'

export type ThemePref = 'system' | 'light' | 'dark'

/** User's theme choice; 'system' (default) follows the Telegram theme. */
export function getTheme(): ThemePref {
  const v = localStorage.getItem('mvpn_theme')
  return v === 'light' || v === 'dark' ? v : 'system'
}

export function setTheme(p: ThemePref) {
  localStorage.setItem('mvpn_theme', p)
  applyScheme()
}

/** Resolve to dark/light: honour the manual override, else follow Telegram. */
function applyScheme() {
  const pref = getTheme()
  const dark = pref === 'system' ? tg?.colorScheme === 'dark' : pref === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  try {
    tg?.setHeaderColor?.(dark ? CANVAS_DARK : CANVAS_LIGHT)
    tg?.setBackgroundColor?.(dark ? CANVAS_DARK : CANVAS_LIGHT)
  } catch {}
}

export function initTelegram() {
  applyScheme() // apply any saved override even outside Telegram (browser preview)

  // One global tap haptic for every button / role=button / link, so feedback is
  // consistent everywhere without wiring it into each component. Capture phase
  // so it fires even when a child stops propagation.
  document.addEventListener(
    'click',
    (e) => {
      const el = (e.target as Element | null)?.closest?.('button,[role="button"],a[href]')
      if (el && !(el as HTMLButtonElement).disabled) haptic('light')
    },
    true,
  )

  if (!tg) return
  tg.ready()
  tg.expand()
  // Re-apply on Telegram theme change — only matters while pref is 'system'.
  tg.onEvent?.('themeChanged', applyScheme)
}

/** User can mute haptics in Settings; default on. */
export function hapticsEnabled() {
  return localStorage.getItem('mvpn_haptics') !== '0'
}

export function haptic(style: HapticStyle = 'light') {
  if (!hapticsEnabled()) return
  try {
    tg?.HapticFeedback?.impactOccurred(style)
  } catch {}
}

export function notify(type: NotifyType = 'success') {
  if (!hapticsEnabled()) return
  try {
    tg?.HapticFeedback?.notificationOccurred(type)
  } catch {}
}

export function selection() {
  if (!hapticsEnabled()) return
  try {
    tg?.HapticFeedback?.selectionChanged()
  } catch {}
}

/** Native confirm dialog inside Telegram, browser confirm() otherwise. */
export function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (tg?.showConfirm) tg.showConfirm(message, resolve)
    else resolve(window.confirm(message))
  })
}

export function getInitData(): string {
  return tg?.initData ?? ''
}

/** Open an external link — via the Telegram client when available. */
export function openLink(url: string) {
  try {
    const w = tg as any
    const isHttp = /^https?:\/\//i.test(url)
    // Custom-scheme deeplinks (happ://, v2raytun://, …) — hand to the OS so it
    // opens the target app. Telegram's openLink only handles http(s).
    if (!isHttp) {
      window.location.href = url
      return
    }
    if (url.includes('t.me') && w?.openTelegramLink) w.openTelegramLink(url)
    else if (w?.openLink) w.openLink(url)
    else window.open(url, '_blank')
  } catch {
    window.open(url, '_blank')
  }
}
