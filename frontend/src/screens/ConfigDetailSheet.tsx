import React, { useState } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { Button } from '../components/ui/Button'
import { Section } from '../components/ui/Card'
import { Cell } from '../components/ui/Cell'
import { Collapse } from '../components/ui/Collapse'
import { Switch } from '../components/ui/Switch'
import { Spinner } from '../components/ui/Spinner'
import { Qr } from '../components/Qr'
import { Pencil, Copy, QrCode, ChevronRight, ChevronDown, ExternalLink, Trash } from '../components/icons'
import { StatusDot } from '../components/StatusDot'
import { useToast } from '../components/ui/Toast'
import { copyText } from '../lib/clipboard'
import { subLink } from '../lib/config'
import { confirmDialog, notify, openLink, effectivePalette } from '../lib/telegram'
import { useT } from '../lib/i18n'
import { configMeta, configSpecLine } from '../lib/configMeta'
import type { Config } from '../api'

// Clients that accept a one-tap VLESS-subscription import. The actual jump is
// done by a tiny web page (import.html) opened in the external browser, because
// custom-scheme deeplinks (happ://, …) are blocked inside Telegram's webview.
// One-tap import clients for VLESS subscriptions.
// Launchers and where to get them, per OS. A missing OS means the launcher isn't
// available there: v2rayNG is Android-only; v2RayTun is no longer in the Russian
// App Store, so its iOS list is Global-only. Happ & v2RayTun cover desktop too.
type OSKey = 'ios' | 'android' | 'windows' | 'macos' | 'linux'
type StoreLink = { label: string; href: string }

const OS_OPTS: { key: OSKey; label: string }[] = [
  { key: 'ios', label: 'iOS' },
  { key: 'android', label: 'Android' },
  { key: 'windows', label: 'Windows' },
  { key: 'macos', label: 'macOS' },
  { key: 'linux', label: 'Linux' },
]

const APPS: { id: string; name: string; stores: Partial<Record<OSKey, StoreLink[]>> }[] = [
  {
    id: 'happ',
    name: 'Happ',
    stores: {
      ios: [
        { label: 'App Store (RU)', href: 'https://apps.apple.com/ru/app/id6504287215' },
        { label: 'App Store (Global)', href: 'https://apps.apple.com/us/app/id6504287215' },
      ],
      android: [{ label: 'Google Play', href: 'https://play.google.com/store/apps/details?id=com.happproxy' }],
      windows: [{ label: 'happ.su', href: 'https://www.happ.su/main' }],
      macos: [{ label: 'happ.su', href: 'https://www.happ.su/main' }],
      linux: [{ label: 'happ.su', href: 'https://www.happ.su/main' }],
    },
  },
  {
    id: 'v2raytun',
    name: 'v2RayTun',
    stores: {
      ios: [{ label: 'App Store (Global)', href: 'https://apps.apple.com/us/app/id6476628951' }],
      android: [{ label: 'Google Play', href: 'https://play.google.com/store/apps/details?id=com.v2raytun.android' }],
      windows: [{ label: 'v2raytun.com', href: 'https://v2raytun.com/' }],
      macos: [{ label: 'v2raytun.com', href: 'https://v2raytun.com/' }],
      linux: [{ label: 'v2raytun.com', href: 'https://v2raytun.com/' }],
    },
  },
  {
    id: 'v2rayng',
    name: 'v2rayNG',
    stores: {
      android: [{ label: 'Google Play', href: 'https://play.google.com/store/apps/details?id=com.v2ray.ang' }],
    },
  },
]

const launchersFor = (os: OSKey) => APPS.filter((a) => a.stores[os])

/** Best-guess OS for the install guide — Telegram platform, else the UA. */
function detectOs(): OSKey {
  const p = (window as { Telegram?: { WebApp?: { platform?: string } } }).Telegram?.WebApp?.platform
  if (p === 'android') return 'android'
  if (p === 'ios') return 'ios'
  if (p === 'macos') return 'macos'
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/mac os x|macintosh/i.test(ua)) return 'macos'
  if (/linux/i.test(ua)) return 'linux'
  return 'windows'
}

/** URL of the redirect page next to the app (…/v2/import.html). */
function importPage(appId: string, target: string, lang: string): string {
  return new URL(
    `import.html?app=${appId}&u=${encodeURIComponent(target)}&lang=${lang}&theme=${effectivePalette()}`,
    location.href,
  ).href
}

export function ConfigDetailSheet({
  config,
  open,
  onClose,
  onToggle,
  onRename,
  onDelete,
  onOpenStats,
}: {
  config: Config | null
  open: boolean
  onClose: () => void
  onToggle: (key: 'enhanced' | 'game_mode', val: boolean) => void
  onRename: (name: string) => Promise<void>
  onDelete: () => Promise<void>
  onOpenStats: () => void
}) {
  const { t, lang } = useT()
  const toast = useToast()
  const [showQr, setShowQr] = useState(false)
  const [showApps, setShowApps] = useState(false)
  const [os, setOs] = useState<OSKey>(detectOs)
  const [launcher, setLauncher] = useState<string>(() => launchersFor(detectOs())[0]?.id ?? 'happ')
  const [osOpen, setOsOpen] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const [showRename, setShowRename] = useState(false)
  const [renameVal, setRenameVal] = useState('')
  const [busy, setBusy] = useState(false)

  if (!config) return null
  const isAwg = config.protocol === 'awg'
  const awgConf = config.awg_conf || ''
  const link = subLink(config.short_id)
  const meta = configMeta(config, t)

  const copy = async (text: string, msg: string) => {
    await copyText(text)
    notify('success')
    toast(msg)
  }

  const doDelete = async () => {
    if (!(await confirmDialog(t('detail.deleteConfirm')))) return
    setBusy(true)
    try {
      await onDelete()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const doRename = async () => {
    const name = renameVal.trim()
    if (!name) return
    setBusy(true)
    try {
      await onRename(name)
      setShowRename(false)
      toast(t('devices.renamed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title={t('detail.title')}>
        {/* identity */}
        <div className="mb-3 flex items-center gap-3">
          <span className="text-[26px]">🇳🇱</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[17px] font-semibold text-ink">
                {config.name || t('configs.country')}
              </span>
              <button
                onClick={() => {
                  setRenameVal(config.name || '')
                  setShowRename(true)
                }}
                className="text-accent active:opacity-60"
                aria-label={t('devices.rename')}
              >
                <Pencil size={17} />
              </button>
            </div>
          </div>
        </div>

        {/* about this config — protocol · transport · technology */}
        <div className="mb-5 text-[13px] leading-snug text-muted">{configSpecLine(meta)}</div>

        {/* connection: AmneziaWG .conf or VLESS subscription link */}
        {isAwg ? (
          <div className="mb-5">
            <div className="mb-2.5 flex items-start gap-2 rounded-2xl border border-border bg-surface-sunken px-3 py-2.5">
              <pre className="no-scrollbar min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-[11.5px] leading-snug text-ink">
                {awgConf}
              </pre>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  onClick={() => setShowQr(true)}
                  className="grid h-9 w-9 place-items-center rounded-xl text-ink active:bg-border"
                  aria-label={t('detail.qr')}
                >
                  <QrCode size={20} />
                </button>
                <button
                  onClick={() => copy(awgConf, t('detail.confCopied'))}
                  className="grid h-9 w-9 place-items-center rounded-xl text-ink active:bg-border"
                  aria-label={t('common.copy')}
                >
                  <Copy size={20} />
                </button>
              </div>
            </div>
            <p className="text-[13px] leading-snug text-muted">{t('detail.awgImport')}</p>
          </div>
        ) : (
          <div className="mb-5">
            <div className="mb-2.5 flex items-center gap-2 rounded-2xl border border-border bg-surface-sunken px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink">{link}</span>
              <button
                onClick={() => setShowQr(true)}
                className="grid h-9 w-9 place-items-center rounded-xl text-ink active:bg-border"
                aria-label={t('detail.qr')}
              >
                <QrCode size={20} />
              </button>
              <button
                onClick={() => copy(link, t('detail.linkCopied'))}
                className="grid h-9 w-9 place-items-center rounded-xl text-ink active:bg-border"
                aria-label={t('detail.copyLink')}
              >
                <Copy size={20} />
              </button>
            </div>
            <Button
              variant="secondary"
              stretched
              onClick={() => {
                const o = detectOs()
                setOs(o)
                setLauncher(launchersFor(o)[0]?.id ?? 'happ')
                setOsOpen(false)
                setShowApps(true)
              }}
            >
              {t('detail.installToApp')}
            </Button>
            <button
              onClick={() => setShowRaw(true)}
              className="mt-3 block w-full text-center text-[13px] font-medium text-accent active:opacity-60"
            >
              {t('detail.otherFormat')}
            </button>
          </div>
        )}

        {/* settings — collapsible accordion (VLESS only) */}
        {!isAwg && (
        <div className="mb-5">
          <Collapse
            title={t('create.advanced')}
            footer={
              <p className="px-3 pt-2 text-[13px] leading-snug text-muted">
                {t('detail.afterChange')}
              </p>
            }
          >
            <ToggleRow
              title={t('create.enhanced')}
              checked={config.enhanced}
              disabled={config.game_mode}
              onChange={(v) => onToggle('enhanced', v)}
            />
            <ToggleRow
              title={t('create.game')}
              checked={config.game_mode}
              disabled={config.enhanced}
              onChange={(v) => onToggle('game_mode', v)}
              last
            />
          </Collapse>
        </div>
        )}

        {/* server status → stats (reflects the real server_online flag) */}
        <button
          onClick={onOpenStats}
          className="mb-5 flex w-full items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3 text-left active:bg-surface-sunken"
        >
          <StatusDot ok={config.server_online} className="h-2 w-2" />
          <span className={'text-[15px] font-medium ' + (config.server_online ? 'text-success' : 'text-danger')}>
            {config.server_online ? t('server.online') : t('server.offline')}
          </span>
          <ChevronRight size={18} className="ml-auto text-faint" />
        </button>

        <Section>
          <Cell
            before={<Trash size={20} />}
            title={t('detail.delete')}
            onClick={doDelete}
            destructive
            last
          />
        </Section>

        {busy && (
          <div className="fixed inset-0 z-[55] grid place-items-center bg-black/20">
            <Spinner size={30} />
          </div>
        )}
      </Sheet>

      {/* app chooser — pick OS (dropdown) + launcher (tabs); the page updates */}
      <Sheet open={showApps} onClose={() => setShowApps(false)} onBack={() => setShowApps(false)} title={t('detail.chooseApp')}>
        {/* OS selector — a dropdown like the payment-network picker */}
        <div className="relative mb-3">
          <button
            onClick={() => setOsOpen((o) => !o)}
            className="flex h-11 w-full items-center justify-between rounded-2xl border border-border bg-surface px-4 text-left active:bg-surface-sunken"
          >
            <span className="text-[15px] font-medium text-ink">{OS_OPTS.find((o) => o.key === os)?.label}</span>
            <ChevronDown size={18} className={'text-muted transition-transform ' + (osOpen ? 'rotate-180' : '')} />
          </button>
          {osOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-2xl border border-border bg-surface shadow-sheet">
              {OS_OPTS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => {
                    setOs(o.key)
                    setLauncher(launchersFor(o.key)[0]?.id ?? 'happ')
                    setOsOpen(false)
                  }}
                  className={
                    'flex h-11 w-full items-center px-4 text-left text-[15px] ' +
                    (os === o.key ? 'bg-surface-sunken font-medium text-ink' : 'text-muted active:bg-surface-sunken')
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* launcher tabs — selecting one changes the page below */}
        <div className="mb-3 flex gap-2">
          {launchersFor(os).map((app) => (
            <button
              key={app.id}
              onClick={() => setLauncher(app.id)}
              className={
                'h-9 flex-1 rounded-full border bg-surface text-[14px] font-medium text-ink transition-colors ' +
                (launcher === app.id ? 'border-accent' : 'border-border active:bg-surface-sunken')
              }
            >
              {app.name}
            </button>
          ))}
        </div>
        {/* the chosen launcher's page: install → add subscription → connect */}
        {(() => {
          const app = APPS.find((a) => a.id === launcher) ?? launchersFor(os)[0]
          if (!app) return null
          const stores = app.stores[os] ?? []
          const isMobile = os === 'ios' || os === 'android'
          return (
            <div className="rounded-2xl border border-border bg-surface px-4 py-4 text-[13px] leading-relaxed text-muted">
              <p className="font-semibold text-ink">{t('detail.step1Title')}</p>
              <p className="mt-1">{t(isMobile ? 'detail.step1Body' : 'detail.step1BodyDesktop')}</p>
              <div className="mb-4 mt-2.5 flex flex-col gap-2">
                {stores.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => openLink(s.href)}
                    className="inline-flex h-9 items-center justify-center gap-1 rounded-full border border-accent/30 text-[13.5px] font-medium text-accent active:bg-accent-soft"
                  >
                    {s.label}
                    <ExternalLink size={13} />
                  </button>
                ))}
              </div>
              <p className="font-semibold text-ink">{t('detail.step2Title')}</p>
              <p className="mt-1">{t(isMobile ? 'detail.step2Body' : 'detail.step2BodyDesktop')}</p>
              {isMobile ? (
                <Button
                  stretched
                  className="mb-4 mt-2.5"
                  onClick={() => {
                    openLink(importPage(app.id, link, lang))
                    setShowApps(false)
                  }}
                >
                  {t('detail.addSub')}
                </Button>
              ) : (
                <button
                  onClick={() => copy(link, t('detail.linkCopied'))}
                  className="mb-4 mt-2.5 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-accent text-[14px] font-medium text-white active:bg-accent-hover"
                >
                  <Copy size={15} /> {t('detail.copyLink')}
                </button>
              )}
              <p className="font-semibold text-ink">{t('detail.step3Title')}</p>
              <p className="mt-1">{t('detail.step3Body')}</p>
            </div>
          )
        })()}
      </Sheet>

      {/* QR */}
      <Sheet open={showQr} onClose={() => setShowQr(false)} onBack={() => setShowQr(false)} title={t('detail.qrTitle')}>
        <Qr value={isAwg ? awgConf : link} />
        <p className="mx-auto mt-5 max-w-[300px] pb-2 text-center text-[13px] leading-snug text-muted">
          {isAwg ? t('detail.awgQrHint') : t('detail.qrHint')}
        </p>
      </Sheet>

      {/* raw VLESS */}
      <Sheet
        open={showRaw}
        onClose={() => setShowRaw(false)}
        onBack={() => setShowRaw(false)}
        title={t('detail.rawTitle')}
      >
        <p className="mb-3 px-1 text-[14px] leading-snug text-muted">
          {t('detail.rawHint')}
        </p>
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-sunken px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink">
            {config.vless_uri}
          </span>
          <button
            onClick={() => copy(config.vless_uri, t('detail.copied'))}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink active:bg-border"
            aria-label={t('common.copy')}
          >
            <Copy size={20} />
          </button>
        </div>
      </Sheet>

      {/* rename */}
      <Sheet open={showRename} onClose={() => setShowRename(false)} onBack={() => setShowRename(false)} title={t('detail.renameTitle')}>
        <label className="px-1 text-[12px] font-medium uppercase tracking-[0.06em] text-faint">
          {t('detail.name')}
        </label>
        <input
          value={renameVal}
          onChange={(e) => setRenameVal(e.target.value)}
          placeholder={t('detail.namePlaceholder')}
          className="mb-4 mt-2 h-[52px] w-full rounded-2xl border border-transparent bg-surface-sunken px-4 text-[16px] text-ink outline-none placeholder:text-faint focus:border-accent"
        />
        <div className="pb-2">
          <Button stretched loading={busy} disabled={!renameVal.trim()} onClick={doRename}>
            {t('devices.renameSave')}
          </Button>
        </div>
      </Sheet>
    </>
  )
}

function ToggleRow({
  title,
  subtitle,
  badge,
  checked,
  onChange,
  disabled,
  last,
}: {
  title: string
  subtitle?: string
  badge?: React.ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  last?: boolean
}) {
  return (
    <div
      className={
        'flex min-h-[54px] items-center gap-3 px-4 py-2.5 ' +
        (last ? '' : 'border-b border-border ') +
        (disabled ? 'opacity-50' : '')
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[16px] text-ink">{title}</span>
          {badge}
        </div>
        {subtitle && <div className="mt-0.5 text-[13px] leading-snug text-muted">{subtitle}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}
