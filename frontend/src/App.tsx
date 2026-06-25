import { useEffect, useState } from 'react'
import { ToastProvider } from './components/ui/Toast'
import { BottomTabs, type Tab } from './components/BottomTabs'
import { AuthScreen } from './screens/AuthScreen'
import { ConfigsScreen } from './screens/ConfigsScreen'
import { SubscriptionScreen } from './screens/SubscriptionScreen'
import { AccountSheet } from './screens/SettingsScreen'
import { AdminScreen } from './screens/AdminSheet'
import { Spinner } from './components/ui/Spinner'
import { ApiError, authTelegram, clearToken, getProfile, getToken, setLanguage, type Profile } from './api'
import { notify, signalReady } from './lib/telegram'
import { useT } from './lib/i18n'
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
  const [accountOpen, setAccountOpen] = useState(false)
  // Bumped when the Account sheet closes, so the screen behind it re-fetches
  // (e.g. after a reset that wiped configs) instead of showing stale data.
  const [revalidate, setRevalidate] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)

  const refreshProfile = () => getProfile().then(setProfile).catch(() => {})

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
    }
  }

  // Auto-login only RETURNING users (a saved token). First-time users still see
  // the welcome screen with the "Sign in with Telegram" button, then the key
  // screen — so the login step is never silently skipped.
  useEffect(() => {
    // React has mounted → tell Telegram we're ready so it dismisses its own
    // BotFather loading screen (there's no separate in-app splash anymore).
    signalReady()
    if (getToken()) {
      setPhase('loading')
      handleLogin()
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
    // Warm the heavy TON Connect chunk on idle, so the wallet capsule in the
    // payment pane appears instantly instead of popping in after a chunk fetch
    // when the user opens it. Idle → never competes with first paint.
    const warmWallet = () => void import('./screens/WalletStatus')
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(warmWallet)
    else setTimeout(warmWallet, 1500)
    // Surface the admin tab for admins, and seed the avatar/account data
    // (best-effort; a failed profile fetch just hides the admin tab).
    getProfile()
      .then((p) => {
        setIsAdmin(!!p.is_admin)
        setProfile(p)
      })
      .catch(() => {})
  }, [phase])

  const handleLogout = () => {
    clearToken()
    setTab('configs')
    setIsAdmin(false)
    setAccountOpen(false)
    setProfile(null)
    setError(null)
    setPhase('auth')
  }

  return (
    <TonConnectUIProvider manifestUrl={TON_MANIFEST} actionsConfiguration={{ twaReturnUrl: TON_TWA_RETURN }}>
    <ToastProvider>
      {phase === 'auth' && <AuthScreen onLogin={handleLogin} busy={busy} error={error} />}
      {phase === 'loading' && (
        <div className="grid min-h-screen place-items-center text-accent">
          <Spinner size={32} />
        </div>
      )}
      {phase === 'main' && (
        <HeaderCtx.Provider value={{ accountName: profile?.first_name ?? undefined, onAccount: () => setAccountOpen(true) }}>
          {/* Keep all tabs MOUNTED and just toggle visibility, so switching tabs
              doesn't unmount + reload a screen from a blank skeleton every time.
              Each screen refreshes itself in the background when it becomes active. */}
          <div className={tab === 'configs' ? '' : 'hidden'}>
            <ConfigsScreen
              active={tab === 'configs'}
              onAccount={() => setAccountOpen(true)}
              accountName={profile?.first_name ?? undefined}
              onGoSubscription={() => setTab('subscription')}
              revalidate={revalidate}
            />
          </div>
          <div className={tab === 'subscription' ? '' : 'hidden'}>
            <SubscriptionScreen
              active={tab === 'subscription'}
              profile={profile}
              onChanged={refreshProfile}
              onAccount={() => setAccountOpen(true)}
              accountName={profile?.first_name ?? undefined}
              revalidate={revalidate}
            />
          </div>
          {isAdmin && (
            <div className={tab === 'admin' ? '' : 'hidden'}>
              <AdminScreen
                active={tab === 'admin'}
                onAccount={() => setAccountOpen(true)}
                accountName={profile?.first_name ?? undefined}
                revalidate={revalidate}
              />
            </div>
          )}
          <BottomTabs active={tab} onSelect={setTab} isAdmin={isAdmin} />
          <AccountSheet
            open={accountOpen}
            onClose={() => {
              setAccountOpen(false)
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
