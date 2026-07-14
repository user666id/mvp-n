// Thin wrapper over the Telegram WebApp SDK injected by telegram-web-app.js.
// Falls back gracefully to a no-op when running in a plain browser (dev/preview).

type HapticStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid'
type NotifyType = 'success' | 'error' | 'warning'

interface TgWebApp {
  initData: string
  colorScheme: 'light' | 'dark'
  platform?: string
  ready: () => void
  expand: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  openInvoice?: (url: string, cb?: (status: string) => void) => void
  enableClosingConfirmation?: () => void
  onEvent?: (event: string, cb: () => void) => void
  showConfirm?: (message: string, cb: (ok: boolean) => void) => void
  HapticFeedback?: {
    impactOccurred: (style: HapticStyle) => void
    notificationOccurred: (type: NotifyType) => void
    selectionChanged: () => void
  }
  BackButton?: {
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick?: (cb: () => void) => void
  }
  addToHomeScreen?: () => void
  checkHomeScreenStatus?: (cb: (status: string) => void) => void
  exitFullscreen?: () => void
  disableVerticalSwipes?: () => void
  enableVerticalSwipes?: () => void
  isVersionAtLeast?: (version: string) => boolean
  safeAreaInset?: { top: number; bottom: number; left: number; right: number }
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number }
  initDataUnsafe?: {
    user?: {
      id?: number
      first_name?: string
      last_name?: string
      username?: string
      photo_url?: string
    }
  }
}

const tg: TgWebApp | undefined = (window as any).Telegram?.WebApp

/** True when launched as a real Telegram Mini App (signed initData present). */
export const inTelegram = Boolean(tg?.initData)

/** The user's real Telegram profile photo URL, when the client exposes one
 *  (often present on mobile). Undefined in a plain browser / when unset — the
 *  Avatar then falls back to the coloured letter. */
export const accountPhotoUrl: string | undefined = tg?.initDataUnsafe?.user?.photo_url

const CANVAS_LIGHT = '#faf9f5'
// Per-shade dark page colour (kept in sync with the .dark[data-shade] CSS so the
// Telegram header/background match the in-app canvas exactly).
const DARK_CANVAS: Record<DarkShade, string> = {
  warm: '#1c1c1c',
  black: '#000000',
}

export type ThemePref = 'system' | 'light' | 'dark'
/** Sub-choice for the dark theme: warm (default) or true black. */
export type DarkShade = 'warm' | 'black'

/** User's theme choice; 'system' (default) follows the Telegram theme. */
export function getTheme(): ThemePref {
  const v = localStorage.getItem('mvpn_theme')
  return v === 'light' || v === 'dark' ? v : 'system'
}

export function setTheme(p: ThemePref) {
  localStorage.setItem('mvpn_theme', p)
  applyScheme()
}

/** Dark-theme shade; defaults to 'warm' (the original Claude-matched palette).
 *  A legacy 'neutral' value (removed) falls back to 'warm'. */
export function getDarkShade(): DarkShade {
  const v = localStorage.getItem('mvpn_dark_shade')
  return v === 'black' ? 'black' : 'warm'
}

export function setDarkShade(s: DarkShade) {
  localStorage.setItem('mvpn_dark_shade', s)
  applyScheme()
}

/** Whether the dark scheme is currently in effect (manual dark, or system=dark).
 *  Used to hide the dark-shade picker when the UI is light. */
export function isDarkActive(): boolean {
  const pref = getTheme()
  return pref === 'system' ? tg?.colorScheme === 'dark' : pref === 'dark'
}

/** The effective page palette: 'light', or the dark shade ('warm' | 'black').
 *  Passed as ?theme= to the static pages (legal + the import/redirect page) so
 *  they match the in-app theme even when opened in an external browser, where the
 *  Mini App's localStorage isn't shared. */
export function effectivePalette(): 'light' | DarkShade {
  return isDarkActive() ? getDarkShade() : 'light'
}

/** Resolve to dark/light: honour the manual override, else follow Telegram. */
function applyScheme() {
  const pref = getTheme()
  const dark = pref === 'system' ? tg?.colorScheme === 'dark' : pref === 'dark'
  const shade = getDarkShade()
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  // data-shade drives the .dark[data-shade] overrides; only meaningful in dark.
  if (dark) root.dataset.shade = shade
  else delete root.dataset.shade
  const canvas = dark ? DARK_CANVAS[shade] : CANVAS_LIGHT
  // Match the real page background to the selected shade. index.html's first-paint
  // style hardcodes one dark canvas, so under short content the body showed the
  // wrong shade (e.g. warm beneath the black theme — a visible seam). Inline style
  // on html/body overrides that stylesheet rule.
  root.style.backgroundColor = canvas
  if (document.body) document.body.style.backgroundColor = canvas
  try {
    tg?.setHeaderColor?.(canvas)
    tg?.setBackgroundColor?.(canvas)
  } catch {}
}

export function initTelegram() {
  applyScheme() // apply any saved override even outside Telegram (browser preview)

  // Namespace the data cache (lib/cache) by the Telegram user id, so a different
  // account on the same device can never read the previous one's persisted lists.
  try {
    localStorage.setItem('mvpn_uid', String(tg?.initDataUnsafe?.user?.id ?? 'anon'))
  } catch {}

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
  // ready() is deferred to signalReady() (called once React has mounted) so
  // Telegram keeps its own BotFather loading screen up through the whole load —
  // no blank flash, and no separate in-app splash needed.
  tg.expand()
  // Stop Telegram's swipe-down-to-minimize gesture from fighting the app's own
  // scrolling and the bottom-sheet drag — it made the whole webview rubber-band
  // (the "two windows moving" when swiping a sheet). position:fixed body-lock can't
  // touch this native gesture. 7.7+; a no-op on older clients.
  if (tg.isVersionAtLeast?.('7.7')) {
    try {
      tg.disableVerticalSwipes?.()
    } catch {}
  }
  // Defensive: an earlier build offered fullscreen (since removed — it covered the
  // app header and broke tab nav). Exit it on boot so anyone left stuck in
  // fullscreen by a cached old bundle is recovered. No-op when not fullscreen.
  // Gate on 8.0+ — that's when fullscreen exists; on older clients the call only
  // makes Telegram's SDK log an "unsupported in version 6.0" console error.
  if (tg.isVersionAtLeast?.('8.0')) {
    try {
      tg.exitFullscreen?.()
    } catch {}
  }
  // Re-apply on Telegram theme change — only matters while pref is 'system'.
  tg.onEvent?.('themeChanged', applyScheme)
  // Publish Telegram's safe-area insets as CSS vars + keep them current (used for
  // notch-safe top padding).
  applySafeArea()
  tg.onEvent?.('safeAreaChanged', applySafeArea)
  tg.onEvent?.('contentSafeAreaChanged', applySafeArea)
}

let readyCalled = false

/** True once signalReady() has run — i.e. Telegram's BotFather splash has been
 *  dismissed and the app is painted. main.tsx uses this to NEVER trigger a reload
 *  after the app is live (a fresh document load isn't re-covered by the splash and
 *  shows a white flash). */
export const isReady = () => readyCalled

/** Tell Telegram the Mini App is ready — call once React has mounted, so the
 *  BotFather loading screen stays visible through the entire load (the app has
 *  no in-app splash of its own). */
export function signalReady() {
  readyCalled = true
  try {
    tg?.ready()
  } catch {}
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

/** Open a Telegram Stars invoice (WebApp.openInvoice). The callback gets the
 *  status: 'paid' | 'cancelled' | 'failed' | 'pending'. Outside Telegram (browser
 *  preview) there's no invoice UI, so we report 'failed'. */
export function openInvoice(url: string, cb: (status: string) => void) {
  if (tg?.openInvoice) tg.openInvoice(url, cb)
  else cb('failed')
}

/** Open an external link — via the Telegram client when available. */
export function openLink(url: string) {
  const isHttp = /^https?:\/\//i.test(url)
  // Custom-scheme deeplinks (happ://, v2raytun://, …) open the target APP, not a
  // website — hand straight to the OS, no prompt. Telegram's openLink only does http(s).
  if (!isHttp) {
    window.location.href = url
    return
  }
  const open = () => {
    try {
      const w = tg as any
      if (url.includes('t.me') && w?.openTelegramLink) w.openTelegramLink(url)
      else if (w?.openLink) w.openLink(url)
      else window.open(url, '_blank')
    } catch {
      window.open(url, '_blank')
    }
  }
  // Warn before leaving the app for a THIRD-PARTY website (launcher download sites,
  // GitHub, …). Our own pages (mvp-n.net) and Telegram links open without a prompt.
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {}
  const trusted =
    /(^|\.)mvp-n\.net$/i.test(host) || /(^|\.)t\.me$/i.test(host) || /(^|\.)telegram\.org$/i.test(host)
  if (trusted) {
    open()
    return
  }
  const ru = (localStorage.getItem('mvpn_lang') ?? 'ru') === 'ru'
  const msg = ru
    ? `Вы покидаете приложение и открываете внешний сайт:\n${host}\n\nПродолжить?`
    : `You're leaving the app to open an external site:\n${host}\n\nContinue?`
  confirmDialog(msg).then((ok) => {
    if (ok) open()
  })
}

// ── Native BackButton ────────────────────────────────────────────────────────
// Telegram's top-left back button, shared across nested sheets via a handler
// stack: the top-most open sheet owns the back action; closing it falls back to
// the sheet beneath, and the button hides when the last sheet closes. One
// dispatcher is registered with Telegram and always invokes the current top.
// No-op outside Telegram (the in-app ‹ button still works there).
const backStack: Array<() => void> = []
let backWired = false

export function pushBackHandler(fn: () => void) {
  backStack.push(fn)
  const bb = tg?.BackButton
  if (!bb) return
  if (!backWired) {
    bb.onClick(() => backStack[backStack.length - 1]?.())
    backWired = true
  }
  bb.show()
}

export function popBackHandler(fn: () => void) {
  const i = backStack.lastIndexOf(fn)
  if (i >= 0) backStack.splice(i, 1)
  if (backStack.length === 0) tg?.BackButton?.hide()
}

/** Close EVERY open sheet by firing each back handler. Used by the avatar "go
 *  home" to collapse the whole drill-down stack at once. Iterates a snapshot since
 *  each handler's sheet pops itself from the stack as it closes. */
export function closeAllSheets() {
  for (const fn of [...backStack]) fn()
}

/** Offer to add the Mini App to the device home screen (Telegram Mini Apps 2.0).
 *  No-op where unsupported. */
export function addToHomeScreen() {
  try {
    tg?.addToHomeScreen?.()
  } catch {}
}

/** Whether this client supports adding to the home screen (Bot API 8.0+). Gate the
 *  button on this CAPABILITY, not on the status probe (checkHomeScreenStatus) — the
 *  probe is flaky across launches and made the button blink in and out. */
export function canAddToHomeScreen(): boolean {
  return typeof tg?.addToHomeScreen === 'function'
}

// Publishes Telegram's safe-area insets as CSS vars (--tg-safe-top / -bottom) for
// notch-safe padding. NB: Telegram fullscreen mode was removed — its overlay
// controls (close / ⋯) sit on top of the app's own header and covered the menu
// button, breaking tab navigation. Fullscreen targets games/media without a top bar.
function applySafeArea() {
  const sa = tg?.safeAreaInset
  const csa = tg?.contentSafeAreaInset
  const top = Math.max(sa?.top ?? 0, csa?.top ?? 0)
  const bottom = Math.max(sa?.bottom ?? 0, csa?.bottom ?? 0)
  const root = document.documentElement.style
  root.setProperty('--tg-safe-top', top + 'px')
  root.setProperty('--tg-safe-bottom', bottom + 'px')
}
