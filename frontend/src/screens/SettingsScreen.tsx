import { useState } from 'react'
import { useCachedResource } from '../lib/useForeground'
import * as cache from '../lib/cache'
import { Section } from '../components/ui/Card'
import { Cell } from '../components/ui/Cell'
import { Switch } from '../components/ui/Switch'
import { Dropdown } from '../components/ui/Dropdown'
import { Sheet } from '../components/ui/Sheet'
import { BusyOverlay } from '../components/ui/BusyOverlay'
import { useToast } from '../components/ui/Toast'
import {
  Bell, Phone, Info, ChevronRight, LogOut, Trash, User, Vibrate,
  Monitor, Sun, Moon, Key, Clock, Globe,
} from '../components/icons'
import { ProfileDetails } from '../components/ProfileDetails'
import { AboutSheet } from './AboutSheet'
import { KeyEntrySheet } from './KeyEntrySheet'
import { PaymentHistorySheet } from './PaymentHistorySheet'
import {
  confirmDialog, notify, hapticsEnabled, getTheme, setTheme, getDarkShade, setDarkShade,
  isDarkActive, addToHomeScreen, canAddToHomeScreen, type ThemePref, type DarkShade,
} from '../lib/telegram'
import { useT } from '../lib/i18n'
import { subLabel } from '../lib/subscription'
import {
  ApiError, deleteAccount, getProfile, setLanguage,
} from '../api'

const LS_NOTIFY = 'mvpn_notify'

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
  // Single-sourced profile (shared cache) — the SAME value as the home banner, kept
  // and revalidated in the background (no blank flash on re-open; recovers on resume).
  const { data: profile } = useCachedResource('profile', getProfile, { active: open })
  const [notify_, setNotify] = useState(localStorage.getItem(LS_NOTIFY) === '1')
  const [profileOpen, setProfileOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [keyOpen, setKeyOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [haptics, setHaptics] = useState(hapticsEnabled())
  const [canAddHome, setCanAddHome] = useState(canAddToHomeScreen())
  const [theme, setThemeState] = useState<ThemePref>(getTheme())
  const [shade, setShadeState] = useState<DarkShade>(getDarkShade())

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

  const toggleNotify = (v: boolean) => {
    setNotify(v)
    localStorage.setItem(LS_NOTIFY, v ? '1' : '0')
  }

  const doLogout = async () => {
    if (!(await confirmDialog(t('settings.logoutConfirm')))) return
    onLogout()
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


  return (
    <Sheet open={open} onClose={onClose} onBack={onClose} title={t('account.title')}>
      <div>
        {/* Account — just the profile row now; devices + usage live on the home
            dashboard widgets, and "reset sessions" lives on the Devices screen. */}
        <Section header={t('settings.account')}>
          <Cell
            before={<User size={20} />}
            after={<ChevronRight size={20} className="text-faint" />}
            title={t('settings.profile')}
            onClick={() => profile && setProfileOpen(true)}
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
            <div className="mb-2.5 flex items-center gap-3">
              <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-surface-sunken text-muted">
                <Globe size={20} />
              </span>
              <span className="text-[15px] text-ink">{t('settings.language')}</span>
            </div>
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
              'flex items-center gap-3 px-4 py-3.5' +
              (theme === 'dark' || (theme === 'system' && isDarkActive())
                ? ' border-b border-border'
                : '')
            }
          >
            <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-surface-sunken text-muted">
              <Moon size={20} />
            </span>
            <span className="flex-1 text-[15px] text-ink">{t('settings.theme')}</span>
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
                    'grid h-9 w-9 place-items-center rounded-full border transition-colors ' +
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

      <AboutSheet open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <KeyEntrySheet
        open={keyOpen}
        onClose={() => setKeyOpen(false)}
        onActivated={() => {
          setKeyOpen(false)
          cache.invalidate('profile', 'configs')
        }}
      />
      <PaymentHistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} />

      <BusyOverlay show={busy} />
    </Sheet>
  )
}
