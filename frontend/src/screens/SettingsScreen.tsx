import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useForegroundRefetch } from '../lib/useForeground'
import { Section } from '../components/ui/Card'
import { Cell } from '../components/ui/Cell'
import { Switch } from '../components/ui/Switch'
import { Dropdown } from '../components/ui/Dropdown'
import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { BusyOverlay } from '../components/ui/BusyOverlay'
import { useToast } from '../components/ui/Toast'
import {
  Bell, Phone, Refresh, Info, ChevronRight, LogOut, Trash, Sliders, User, ChartLine, Vibrate,
  Monitor, Sun, Moon, Key, Clock,
} from '../components/icons'
import { ProfileDetails } from '../components/ProfileDetails'
import { DevicesSheet } from './DevicesSheet'
import { AboutSheet } from './AboutSheet'
import { UsageSheet } from './UsageSheet'
import { KeyEntrySheet } from './KeyEntrySheet'
import { PaymentHistorySheet } from './PaymentHistorySheet'
import {
  confirmDialog, notify, hapticsEnabled, getTheme, setTheme, getDarkShade, setDarkShade,
  isDarkActive, addToHomeScreen, canAddToHomeScreen, type ThemePref, type DarkShade,
} from '../lib/telegram'
import { plural } from '../lib/format'
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

export function AccountSheet({
  open,
  onClose,
  onLogout,
}: {
  open: boolean
  onClose: () => void
  onLogout: () => void
}) {
  const { t, lang, setLang } = useT()
  const toast = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [notify_, setNotify] = useState(localStorage.getItem(LS_NOTIFY) === '1')
  const [devicesOpen, setDevicesOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [subOpen, setSubOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const [keyOpen, setKeyOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [haptics, setHaptics] = useState(hapticsEnabled())
  const [canAddHome, setCanAddHome] = useState(canAddToHomeScreen())
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

  // Load/refresh when the sheet opens. It stays mounted across opens, so this is
  // a lazy first load + background refresh that keeps the current data on screen
  // (no blank flash on every open).
  useEffect(() => {
    if (open) load()
  }, [open, load])

  // Re-load when the app returns to the foreground (suspended WebView / stale data).
  useForegroundRefetch(open, load)

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
    <Sheet open={open} onClose={onClose} onBack={onClose} title={t('account.title')}>
      <div>
        {/* Account — profile, usage, devices, limit, reset (Claude style:
            the profile is a single row, not a big card; all in one group) */}
        <Section header={t('settings.account')}>
          <Cell
            before={<User size={20} />}
            after={<ChevronRight size={20} className="text-faint" />}
            title={t('settings.profile')}
            onClick={() => profile && setProfileOpen(true)}
          />
          <Cell
            before={<ChartLine size={20} />}
            after={<ChevronRight size={20} className="text-faint" />}
            title={t('settings.usage')}
            onClick={() => setUsageOpen(true)}
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
            title={t('settings.reset')}
            onClick={doReset}
            destructive
            last
          />
        </Section>

        {/* Subscription — key activation + payment history (moved here from Оплата) */}
        <Section>
          <Cell
            before={<Key size={20} />}
            after={<ChevronRight size={20} className="text-faint" />}
            title={t('sub.haveKey')}
            onClick={() => setKeyOpen(true)}
          />
          <Cell
            before={<Clock size={20} />}
            after={<ChevronRight size={20} className="text-faint" />}
            title={t('sub.history')}
            onClick={() => setHistoryOpen(true)}
            last
          />
        </Section>

        {/* App — add-to-home + notifications + haptics, then appearance */}
        <Section header={t('settings.appearance')}>
          {/* Add to home screen — an ACTION (no chevron), placed above notifications */}
          {canAddHome && (
            <Cell
              before={<Phone size={20} />}
              title={t('about.addHome')}
              onClick={() => {
                addToHomeScreen()
                setCanAddHome(false)
              }}
            />
          )}
          <Cell
            before={<Bell size={20} />}
            title={t('settings.notifyTitle')}
            after={<Switch checked={notify_} onChange={toggleNotify} />}
          />
          <Cell
            before={<Vibrate size={20} />}
            title={t('settings.haptics')}
            after={<Switch checked={haptics} onChange={toggleHaptics} />}
          />
          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2 text-[13px] text-muted">{t('settings.language')}</div>
            <Dropdown
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
          <div
            className={
              'flex items-center justify-between px-4 py-3.5' +
              (theme === 'dark' || (theme === 'system' && isDarkActive())
                ? ' border-b border-border'
                : '')
            }
          >
            <span className="text-[15px] text-ink">{t('settings.theme')}</span>
            <div className="flex items-center gap-1.5">
              {(
                [
                  ['system', Monitor, t('settings.themeSystem')],
                  ['light', Sun, t('settings.themeLight')],
                  ['dark', Moon, t('settings.themeDark')],
                ] as const
              ).map(([val, Icon, label]) => (
                <button
                  key={val}
                  onClick={() => changeTheme(val)}
                  aria-label={label}
                  title={label}
                  className={
                    'grid h-9 w-9 place-items-center rounded-2xl border transition-colors ' +
                    (theme === val
                      ? 'border-white/20 bg-accent text-white'
                      : 'border-border text-muted active:bg-surface-sunken')
                  }
                >
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </div>
          {/* Dark-theme shade (warm / black) as a dropdown — only when dark is in
              effect (hidden in light); it's the last row then, so no bottom divider. */}
          {(theme === 'dark' || (theme === 'system' && isDarkActive())) && (
            <div className="px-4 py-3.5">
              <div className="mb-2 text-[13px] text-muted">{t('settings.darkShade')}</div>
              <Dropdown
                value={shade}
                align="up"
                onChange={(v) => changeShade(v)}
                options={[
                  { value: 'warm', label: t('settings.shadeWarm') },
                  { value: 'black', label: t('settings.shadeBlack') },
                ]}
              />
            </div>
          )}
        </Section>

        {/* About — the Sheet header has no action slot, so About lives as a row */}
        <Section>
          <Cell
            before={<Info size={20} />}
            after={<ChevronRight size={20} className="text-faint" />}
            title={t('settings.about')}
            onClick={() => setAboutOpen(true)}
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
      <Sheet open={profileOpen} onClose={() => setProfileOpen(false)} title={t('settings.profile')}>
        {profile && (
          <>
            <ProfileDetails p={profile} showWallet />

            <Section>
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
      <Sheet
        open={subOpen}
        onClose={() => setSubOpen(false)}
        title={t('settings.subSettings')}
      >
        <label className="px-1 text-[12px] font-medium text-faint">
          {t('settings.deviceLimit')}
        </label>
        <input
          value={limit}
          onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ''))}
          inputMode="numeric"
          placeholder={t('settings.noLimit')}
          className="mb-4 mt-2 h-[52px] w-full rounded-3xl border border-transparent bg-surface-sunken px-4 text-[16px] text-ink outline-none placeholder:text-faint focus:border-accent"
        />
        <div className="pb-2">
          <Button stretched onClick={saveLimit}>
            {t('common.save')}
          </Button>
        </div>
      </Sheet>

      <AboutSheet open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <UsageSheet open={usageOpen} onClose={() => setUsageOpen(false)} />

      <KeyEntrySheet
        open={keyOpen}
        onClose={() => setKeyOpen(false)}
        onActivated={() => {
          setKeyOpen(false)
          load()
        }}
      />
      <PaymentHistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} />

      <BusyOverlay show={busy} />
    </Sheet>
  )
}
