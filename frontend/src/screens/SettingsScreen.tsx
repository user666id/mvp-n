import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useForegroundRefetch } from '../lib/useForeground'
import { PageHeader } from '../components/PageHeader'
import { Section } from '../components/ui/Card'
import { Cell } from '../components/ui/Cell'
import { Switch } from '../components/ui/Switch'
import { Segmented } from '../components/ui/Segmented'
import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { Spinner } from '../components/ui/Spinner'
import { Avatar } from '../components/ui/Avatar'
import { useToast } from '../components/ui/Toast'
import {
  Bell, Phone, Refresh, Info, ChevronRight, LogOut, Trash, Sliders, Star, ShieldCheck, Vibrate,
} from '../components/icons'
import { ProfileDetails } from '../components/ProfileDetails'
import { DevicesSheet } from './DevicesSheet'
import { AboutSheet } from './AboutSheet'
import { AdminSheet } from './AdminSheet'
import { SubscriptionSheet } from './SubscriptionSheet'
import {
  confirmDialog, notify, hapticsEnabled, getTheme, setTheme, getDarkShade, setDarkShade,
  isDarkActive, type ThemePref, type DarkShade,
} from '../lib/telegram'
import { padId, formatBytes, plural } from '../lib/format'
import { useT } from '../lib/i18n'
import { subLabel } from '../lib/subscription'
import {
  ApiError, deleteAccount, getProfile, resetSubscriptionLink, setDeviceLimit, setLanguage, type Profile,
} from '../api'

const LS_NOTIFY = 'mvpn_notify'

function deviceUnit(n: number, lang: 'en' | 'ru') {
  if (lang === 'ru') return plural(n, 'устройство', 'устройства', 'устройств')
  return n === 1 ? 'device' : 'devices'
}

/** Claude-style row trailing: current value (muted) + chevron. */
function ValueChevron({ value }: { value: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-[15px] text-muted">{value}</span>
      <ChevronRight size={20} className="text-faint" />
    </span>
  )
}

/** Mini mockup preview for the theme cards (Claude style). */
function ThemePreview({ kind }: { kind: 'light' | 'dark' | 'system' }) {
  const dot = '#d97757'
  if (kind === 'system') {
    return (
      <div className="relative h-16 w-full">
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(120deg, #faf9f5 0 50%, #262624 50% 100%)' }}
        />
        <div className="relative p-2">
          <div className="h-1.5 w-3/4 rounded-full" style={{ background: 'rgba(128,128,128,.45)' }} />
          <div className="mt-1 h-1.5 w-1/2 rounded-full" style={{ background: 'rgba(128,128,128,.35)' }} />
          <div className="mt-2 h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
        </div>
      </div>
    )
  }
  const isLight = kind === 'light'
  return (
    <div className="h-16 w-full p-2" style={{ background: isLight ? '#faf9f5' : '#262624' }}>
      <div
        className="h-1.5 w-3/4 rounded-full"
        style={{ background: isLight ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.20)' }}
      />
      <div
        className="mt-1 h-1.5 w-1/2 rounded-full"
        style={{ background: isLight ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.12)' }}
      />
      <div className="mt-2 h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
    </div>
  )
}

export function SettingsScreen({
  active,
  onLogout,
  onMenu,
}: {
  active: boolean
  onLogout: () => void
  onMenu: () => void
}) {
  const { t, lang, setLang } = useT()
  const toast = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [notify_, setNotify] = useState(localStorage.getItem(LS_NOTIFY) === '1')
  const [devicesOpen, setDevicesOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [subOpen, setSubOpen] = useState(false)
  const [subscriptionOpen, setSubscriptionOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [haptics, setHaptics] = useState(hapticsEnabled())
  const [theme, setThemeState] = useState<ThemePref>(getTheme())
  const [shade, setShadeState] = useState<DarkShade>(getDarkShade())
  const [limit, setLimit] = useState('')

  const toggleHaptics = (v: boolean) => {
    setHaptics(v)
    localStorage.setItem('mvpn_haptics', v ? '1' : '0')
  }

  const changeTheme = (v: ThemePref) => {
    setThemeState(v)
    setTheme(v)
  }
  const changeShade = (s: DarkShade) => {
    setShadeState(s)
    setDarkShade(s)
  }
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const p = await getProfile()
      setProfile(p)
      setLimit(p.device_limit ? String(p.device_limit) : '')
    } catch {
      /* keep null; screen still renders shell */
    }
  }, [])

  // Load/refresh when this tab becomes active. The screen stays mounted across
  // tab switches, so this is a lazy first load + background refresh that keeps
  // the current data on screen (no blank flash on every switch).
  useEffect(() => {
    if (active) load()
  }, [active, load])

  // Re-load when the app returns to the foreground (suspended WebView / stale data).
  useForegroundRefetch(active, load)

  const toggleNotify = (v: boolean) => {
    setNotify(v)
    localStorage.setItem(LS_NOTIFY, v ? '1' : '0')
  }

  const saveLimit = async () => {
    setBusy(true)
    try {
      const lim = Number(limit) || 0
      await setDeviceLimit(lim)
      setProfile((p) => (p ? { ...p, device_limit: lim } : p))
      setSubOpen(false)
      toast(t('settings.subSaved'))
    } catch {
      toast(t('common.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  const doLogout = async () => {
    if (!(await confirmDialog(t('settings.logoutConfirm')))) return
    onLogout()
  }

  const doReset = async () => {
    if (!(await confirmDialog(t('settings.resetConfirm')))) return
    setBusy(true)
    try {
      await resetSubscriptionLink()
      notify('success')
      toast(t('settings.resetDone'))
      load()
    } catch {
      toast(t('settings.resetFailed'))
    } finally {
      setBusy(false)
    }
  }

  const doDeleteAccount = async () => {
    if (profile?.is_admin) {
      toast(t('settings.adminLocked'))
      return
    }
    // Warn that an active/lifetime subscription is lost on delete (non-refundable).
    const hasSub = profile && subLabel(profile, t, lang).tone === 'success'
    const msg = hasSub ? t('settings.deleteAccountConfirmSub') : t('settings.deleteAccountConfirm')
    if (!(await confirmDialog(msg))) return
    setBusy(true)
    try {
      await deleteAccount()
      notify('success')
      onLogout()
    } catch (e) {
      notify('error')
      toast(
        e instanceof ApiError && e.code === 'ADMIN_PROTECTED'
          ? t('settings.adminCantDelete')
          : t('settings.deleteAccountFailed'),
      )
    } finally {
      setBusy(false)
    }
  }

  const devCount = profile?.devices_count ?? 0

  return (
    <div className="min-h-screen pb-10">
      <PageHeader
        title={t('settings.title')}
        onMenu={onMenu}
        action={
          <button
            onClick={() => setAboutOpen(true)}
            aria-label={t('settings.about')}
            className="grid h-10 w-10 place-items-center rounded-full text-muted active:bg-surface-sunken"
          >
            <Info size={22} />
          </button>
        }
      />

      <div className="px-4">
        {/* profile — tap opens the account sheet (delete account lives there) */}
        <Section>
          <button
            onClick={() => profile && setProfileOpen(true)}
            className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors active:bg-surface-sunken"
          >
            <Avatar name={profile?.first_name} fallback={profile?.username} size={48} />
            <div className="min-w-0 flex-1">
              {profile ? (
                <>
                  <div className="text-[16px] font-semibold text-ink">id{profile.id}</div>
                  <div className="text-[13px] text-muted">
                    {t('settings.internalId')}: {padId(profile.internal_id)}
                    {profile.is_admin ? ` · ${t('settings.admin')}` : ''}
                  </div>
                  <div className="text-[13px] text-muted">
                    {t('settings.used')}: {formatBytes(profile.traffic_used, lang)}
                  </div>
                </>
              ) : (
                <Spinner size={18} />
              )}
            </div>
            {profile && <ChevronRight size={20} className="shrink-0 text-faint" />}
          </button>
        </Section>

        {/* admin entry (admins only) — kept at the top; About lives in the header ⓘ button */}
        {profile?.is_admin && (
          <Section>
            <Cell
              before={<ShieldCheck size={20} />}
              after={<ChevronRight size={20} />}
              title={t('settings.adminPanel')}
              onClick={() => setAdminOpen(true)}
              last
            />
          </Section>
        )}

        {/* Subscription + VPN connection — one group */}
        <Section header={t('settings.subscriptions')}>
          <Cell
            before={<Star size={20} />}
            after={<ValueChevron value={profile ? subLabel(profile, t, lang).text : ''} />}
            title={t('sub.status')}
            onClick={() => profile && setSubscriptionOpen(true)}
          />
          <Cell
            before={<Phone size={20} />}
            after={<ValueChevron value={`${devCount} ${deviceUnit(devCount, lang)}`} />}
            title={t('settings.devices')}
            onClick={() => setDevicesOpen(true)}
          />
          <Cell
            before={<Sliders size={20} />}
            after={
              <ValueChevron
                value={profile?.device_limit ? profile.device_limit : t('settings.noLimit')}
              />
            }
            title={t('settings.subSettings')}
            onClick={() => setSubOpen(true)}
          />
          <Cell
            before={<Refresh size={20} />}
            after={<ChevronRight size={20} />}
            title={t('settings.reset')}
            onClick={doReset}
            last
          />
        </Section>

        {/* App — notifications + appearance, near the bottom */}
        <Section header={t('settings.appearance')}>
          <Cell
            before={<Bell size={20} />}
            title={t('settings.notifyTitle')}
            after={<Switch checked={notify_} onChange={toggleNotify} />}
          />
          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2 text-[13px] text-muted">{t('settings.language')}</div>
            <Segmented
              block
              value={lang}
              onChange={(v) => {
                setLang(v)
                // Persist so the bot greets the user in this language too.
                setLanguage(v).catch(() => {})
              }}
              options={[
                { value: 'en', label: 'English' },
                { value: 'ru', label: 'Русский' },
              ]}
            />
          </div>
          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[13px] text-muted">{t('settings.theme')}</div>
            <div className="flex gap-2.5">
              {(
                [
                  ['light', t('settings.themeLight')],
                  ['dark', t('settings.themeDark')],
                  ['system', t('settings.themeSystem')],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => changeTheme(val)}
                  className="flex flex-1 flex-col items-center gap-1.5"
                >
                  <div
                    className={
                      'w-full overflow-hidden rounded-xl border-2 transition-colors ' +
                      (theme === val ? 'border-accent' : 'border-border')
                    }
                  >
                    <ThemePreview kind={val} />
                  </div>
                  <span
                    className={
                      'text-[12.5px] ' + (theme === val ? 'font-medium text-ink' : 'text-muted')
                    }
                  >
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {/* Dark-theme shade: warm (default) / neutral / true black.
              Only shown when dark is actually in effect (hidden in light). */}
          {(theme === 'dark' || (theme === 'system' && isDarkActive())) && (
          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[13px] text-muted">{t('settings.darkShade')}</div>
            <div className="flex gap-2.5">
              {(
                [
                  ['warm', t('settings.shadeWarm'), '#20201E', '#191917'],
                  ['neutral', t('settings.shadeNeutral'), '#0A0A0A', '#141414'],
                  ['black', t('settings.shadeBlack'), '#000000', '#0E0E0E'],
                ] as const
              ).map(([val, label, bg, card]) => (
                <button
                  key={val}
                  onClick={() => changeShade(val)}
                  className="flex flex-1 flex-col items-center gap-1.5"
                >
                  <div
                    className={
                      'flex h-12 w-full items-center justify-center overflow-hidden rounded-xl border-2 transition-colors ' +
                      (shade === val ? 'border-accent' : 'border-border')
                    }
                    style={{ background: bg }}
                  >
                    <span className="h-5 w-8 rounded-md" style={{ background: card }} />
                  </div>
                  <span
                    className={
                      'text-[12.5px] ' + (shade === val ? 'font-medium text-ink' : 'text-muted')
                    }
                  >
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
          )}
          <Cell
            before={<Vibrate size={20} />}
            title={t('settings.haptics')}
            after={<Switch checked={haptics} onChange={toggleHaptics} />}
            last
          />
        </Section>

        {/* log out — bottom of the list, left-aligned row (Claude) */}
        <Section>
          <Cell
            before={<LogOut size={20} />}
            title={t('settings.logout')}
            onClick={doLogout}
            last
          />
        </Section>
      </div>

      {/* account sheet — details + delete account (Claude: lives under the profile) */}
      <Sheet open={profileOpen} onClose={() => setProfileOpen(false)} title={t('settings.account')}>
        {profile && (
          <>
            <ProfileDetails p={profile} />

            <Section header={t('settings.danger')}>
              <Cell
                before={<Trash size={20} />}
                title={t('settings.deleteAccount')}
                onClick={doDeleteAccount}
                destructive
                last
              />
            </Section>
          </>
        )}
      </Sheet>

      <DevicesSheet open={devicesOpen} onClose={() => setDevicesOpen(false)} onChanged={load} />

      {/* subscription settings */}
      <Sheet open={subOpen} onClose={() => setSubOpen(false)} title={t('settings.subSettings')}>
        <p className="mb-4 px-1 text-[13.5px] leading-snug text-muted">
          {t('settings.subSettingsHint')}
        </p>
        <label className="px-1 text-[12px] font-medium uppercase tracking-[0.06em] text-faint">
          {t('settings.deviceLimit')}
        </label>
        <input
          value={limit}
          onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ''))}
          inputMode="numeric"
          placeholder={t('settings.noLimit')}
          className="mb-4 mt-2 h-[52px] w-full rounded-2xl border border-transparent bg-surface-sunken px-4 text-[16px] text-ink outline-none placeholder:text-faint focus:border-accent"
        />
        <div className="pb-2">
          <Button stretched onClick={saveLimit}>
            {t('common.save')}
          </Button>
        </div>
      </Sheet>

      <SubscriptionSheet
        open={subscriptionOpen}
        onClose={() => setSubscriptionOpen(false)}
        profile={profile}
        onChanged={load}
      />

      <AboutSheet open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <AdminSheet open={adminOpen} onClose={() => setAdminOpen(false)} />

      {busy && (
        <div className="fixed inset-0 z-[55] grid place-items-center bg-black/20">
          <Spinner size={30} />
        </div>
      )}
    </div>
  )
}
