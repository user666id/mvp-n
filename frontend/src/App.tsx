import { useEffect, useState } from 'react'
import { ToastProvider } from './components/ui/Toast'
import { type Tab } from './components/TabBar'
import { Drawer } from './components/Drawer'
import { AuthScreen } from './screens/AuthScreen'
import { KeyScreen } from './screens/KeyScreen'
import { ConfigsScreen } from './screens/ConfigsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { PlaceholderScreen } from './screens/PlaceholderScreen'
import { Spinner } from './components/ui/Spinner'
import { Sliders } from './components/icons'
import { ApiError, activateKey, authTelegram, clearToken, getToken, setLanguage } from './api'
import { notify } from './lib/telegram'
import { useT } from './lib/i18n'

type Phase = 'auth' | 'key' | 'loading' | 'main' | 'error'

export default function App() {
  const { t } = useT()
  const [phase, setPhase] = useState<Phase>('auth')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('configs')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleLogin = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await authTelegram()
      notify('success')
      setPhase(res.needs_activation ? 'key' : 'main')
    } catch (e) {
      notify('error')
      setError(e instanceof ApiError ? e.message : t('auth.loginFailed'))
      setPhase('auth')
    } finally {
      setBusy(false)
    }
  }

  // Auto-login only RETURNING users (a saved token). First-time users still see
  // the welcome screen with the "Войти через Telegram" button, then the key
  // screen — so the login step is never silently skipped.
  useEffect(() => {
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
  }, [phase])

  const handleLogout = () => {
    clearToken()
    setTab('configs')
    setError(null)
    setPhase('auth')
  }

  const handleActivate = async (key: string) => {
    setBusy(true)
    setError(null)
    try {
      await activateKey(key)
      notify('success')
      setPhase('main')
    } catch (e) {
      notify('error')
      setError(e instanceof ApiError ? e.message : t('key.invalid'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToastProvider>
      {phase === 'auth' && <AuthScreen onLogin={handleLogin} busy={busy} error={error} />}
      {phase === 'key' && <KeyScreen onActivate={handleActivate} busy={busy} error={error} />}
      {phase === 'loading' && (
        <div className="grid min-h-screen place-items-center text-accent">
          <Spinner size={32} />
        </div>
      )}
      {phase === 'main' && (
        <>
          {tab === 'configs' && <ConfigsScreen onMenu={() => setDrawerOpen(true)} />}
          {tab === 'options' && (
            <PlaceholderScreen
              title={t('tab.options')}
              icon={<Sliders size={40} />}
              text={t('options.soon')}
              onMenu={() => setDrawerOpen(true)}
            />
          )}
          {tab === 'settings' && (
            <SettingsScreen onLogout={handleLogout} onMenu={() => setDrawerOpen(true)} />
          )}
          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            active={tab}
            onSelect={setTab}
          />
        </>
      )}
    </ToastProvider>
  )
}
