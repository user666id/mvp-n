import { lazy, Suspense, useEffect, useState } from 'react'
import { ToastProvider } from './components/ui/Toast'
import { BottomTabs, type Tab } from './components/BottomTabs'
import { AuthScreen } from './screens/AuthScreen'
import { ConfigsScreen } from './screens/ConfigsScreen'
import { SubscriptionScreen } from './screens/SubscriptionScreen'
import { AccountSheet } from './screens/SettingsScreen'
// Admin panel is admin-only — load it lazily so the bundle non-admins download
// stays small (it never ships in their first paint).
const AdminScreen = lazy(() => import('./screens/AdminSheet').then((m) => ({ default: m.AdminScreen })))
import { LoadingBar } from './components/ui/LoadingBar'
import { PullScroll } from './components/ui/PullScroll'
import { ApiError, authTelegram, clearToken, getProfile, getToken, setLanguage } from './api'
import { notify, signalReady, closeAllSheets } from './lib/telegram'
import { useT } from './lib/i18n'
import { useCachedResource } from './lib/useForeground'
import * as cache from './lib/cache'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { HeaderCtx } from './lib/headerCtx'

type Phase = 'auth' | 'loading' | 'main' | 'error'

// App-wide TON Connect — the header wallet capsule and the payment panes share
// one provider so the wallet connection is global (was per-pane + lazy before).
const TON_MANIFEST = 'https://app.mvp-n.net/v2/tonconnect-manifest.json'
const TON_TWA_RETURN = 'https://t.me/mvp_n_net_bot?startapp'

export default function App() {
  const { t } = useT()
  const [phase, setPhase] = useState<Phase>('auth')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('configs')
  // True when the Subscription tab was opened via a Renew/Buy button (not the
  // bottom nav) — shows a back arrow there to return to Configs.
  const [subBack, setSubBack] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  // Bumped when the Account sheet closes, so the screen behind it re-fetches
  // (e.g. after a reset that wiped configs) instead of showing stale data.
  const [revalidate, setRevalidate] = useState(0)

  // Profile is the SINGLE source of truth (cache key 'profile') — ConfigsScreen and
  // SubscriptionScreen read the SAME key, so the home banner, the Subscription tab
  // and the avatar can never disagree. It is NOT persisted to disk, so admin/access
  // gating stays pessimistic (false / locked) until the first LIVE fetch resolves —
  // a stale or foreign profile can never flash an unlocked or admin UI.
  const { data: profile } = useCachedResource('profile', getProfile, {
    active: phase === 'main',
    revalidate,
  })
  const isAdmin = !!profile?.is_admin

  const handleLogin = async () => {
    setBusy(true)
    setError(null)
    try {
      await authTelegram()
      notify('success')
      setPhase('main') // always enter the app; activation (key/payment) happens in-app
    } catch (e) {
      notify('error')
      setError(e instanceof ApiError ? e.message : t('auth.loginFailed'))
      setPhase('auth')
    } finally {
      setBusy(false)
      // Auth resolved (main on success / auth on failure) → now dismiss Telegram's
      // native splash. For returning users this is the FIRST signalReady, so they
      // never see the in-app spinner; idempotent for first-timers who already did.
      signalReady()
    }
  }

  // Auto-login only RETURNING users (a saved token). First-time users still see
  // the welcome screen with the "Sign in with Telegram" button, then the key
  // screen — so the login step is never silently skipped.
  useEffect(() => {
    if (getToken()) {
      // Returning user: KEEP Telegram's native loading screen up through the auth
      // round-trip (don't signalReady yet) — handleLogin() calls signalReady() once
      // it resolves, so the app appears directly with NO flash of a second in-app
      // spinner. (Telegram keeps its splash until ready() is called.)
      setPhase('loading')
      handleLogin()
    } else {
      // First-time user: nothing to wait for — reveal the welcome screen now.
      signalReady()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Once in the app, propagate an EXPLICIT in-app language choice to the backend
  // so the bot greets the user the same way. Only when the user actually picked
  // one (localStorage set) — never the default, or we'd override the bot's
  // natural language_code fallback for users who never chose.
  useEffect(() => {
    if (phase !== 'main') return
    const saved = localStorage.getItem('mvpn_lang')
    if (saved === 'en' || saved === 'ru') setLanguage(saved).catch(() => {})
    // Warm the heavy lazy chunks on idle so the wallet capsule AND the Payment
    // screen appear instantly instead of popping in after a chunk fetch on first
    // open. Idle → never competes with first paint.
    const warm = () => {
      void import('./screens/WalletStatus')
      void import('./screens/SubscribeSheet')
    }
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(warm)
    else setTimeout(warm, 1500)
  }, [phase])

  // Global resume recovery: when Telegram brings the Mini App back to the
  // foreground (or the network returns), revalidate EVERY active view at once — not
  // just the visible tab — so re-entering ANY tab shows fresh data without a full
  // app re-open. Listens across the events different TG clients fire on resume.
  useEffect(() => {
    if (phase !== 'main') return
    const onResume = () => {
      if (document.visibilityState === 'visible') cache.invalidateAll()
    }
    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('pageshow', onResume)
    window.addEventListener('online', onResume)
    return () => {
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('pageshow', onResume)
      window.removeEventListener('online', onResume)
    }
  }, [phase])

  const handleLogout = () => {
    clearToken()
    cache.clearAll() // drop every cached + persisted value so the next account is clean
    setTab('configs')
    setAccountOpen(false)
    setError(null)
    setPhase('auth')
  }

  // The account avatar in any sheet returns to the home (Configs) tab — collapse
  // the whole sheet stack and switch tabs. Uniform "go home" from anywhere.
  const goHome = () => {
    closeAllSheets()
    setAccountOpen(false)
    setSubBack(false)
    setTab('configs')
  }

  // Tab panes are STACKED (each a fixed, full-screen viewport). Switching is INSTANT
  // (no cross-fade), like the native iOS / Telegram tab bar — content already renders
  // from cache, so there's nothing to fade in and no transition to drop frames.
  // Inactive panes stay mounted (non-interactive) and keep their own scroll position.
  // The pane is a flex column so the PullScroll inside owns the scroll — giving the
  // same pull-up/down elastic drag as the sheets, even when content fits the screen.
  const tabPane = (on: boolean) =>
    'fixed inset-0 flex flex-col overflow-hidden bg-canvas ' +
    (on ? 'opacity-100' : 'pointer-events-none opacity-0')

  return (
    <TonConnectUIProvider manifestUrl={TON_MANIFEST} actionsConfiguration={{ twaReturnUrl: TON_TWA_RETURN }}>
    <ToastProvider>
      {phase === 'auth' && <AuthScreen onLogin={handleLogin} busy={busy} error={error} />}
      {phase === 'loading' && (
        <div className="min-h-screen bg-canvas">
          <LoadingBar />
        </div>
      )}
      {phase === 'main' && (
        <HeaderCtx.Provider value={{ accountName: profile?.first_name ?? undefined, onAccount: () => setAccountOpen(true), accountOpen, goHome }}>
          {/* Keep all tabs MOUNTED and just toggle visibility, so switching tabs
              doesn't unmount + reload a screen from a blank skeleton every time.
              Each screen refreshes itself in the background when it becomes active.
              Switch is INSTANT (no fade) — like the iOS/Telegram tab bar. A fade-in
              started the incoming tab at opacity 0 while the outgoing one was cut
              instantly, so there was a one-frame blank flash (the "flicker"). */}
          <div className={tabPane(tab === 'configs')}>
            <PullScroll>
              <ConfigsScreen
                active={tab === 'configs'}
                onAccount={() => setAccountOpen(true)}
                accountName={profile?.first_name ?? undefined}
                onGoSubscription={() => {
                  setSubBack(true)
                  setTab('subscription')
                }}
                revalidate={revalidate}
              />
            </PullScroll>
          </div>
          <div className={tabPane(tab === 'subscription')}>
            <PullScroll>
              <SubscriptionScreen
                active={tab === 'subscription'}
                profile={profile ?? null}
                onChanged={() => cache.invalidate('profile')}
                onAccount={() => setAccountOpen(true)}
                onBack={subBack ? () => { setSubBack(false); setTab('configs') } : undefined}
                accountName={profile?.first_name ?? undefined}
                revalidate={revalidate}
              />
            </PullScroll>
          </div>
          {isAdmin && (
            <div className={tabPane(tab === 'admin')}>
              <PullScroll>
                <Suspense fallback={<div className="min-h-screen bg-canvas"><LoadingBar /></div>}>
                  <AdminScreen
                    active={tab === 'admin'}
                    onAccount={() => setAccountOpen(true)}
                    accountName={profile?.first_name ?? undefined}
                    revalidate={revalidate}
                  />
                </Suspense>
              </PullScroll>
            </div>
          )}
          <BottomTabs active={tab} onSelect={(tb) => { setSubBack(false); setTab(tb) }} isAdmin={isAdmin} />
          <AccountSheet
            open={accountOpen}
            onClose={() => {
              setAccountOpen(false)
              // Leaving Settings always lands on the home (Configs) tab — the avatar
              // there returns to the start, not "back" to wherever you opened it from.
              setSubBack(false)
              setTab('configs')
              setRevalidate((v) => v + 1)
            }}
            onLogout={handleLogout}
          />
        </HeaderCtx.Provider>
      )}
    </ToastProvider>
    </TonConnectUIProvider>
  )
}
