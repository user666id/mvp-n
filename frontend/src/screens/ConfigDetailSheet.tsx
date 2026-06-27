import { useState } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Button } from '../components/ui/Button'
import { Dropdown } from '../components/ui/Dropdown'
import { Qr } from '../components/Qr'
import {
  Copy, QrCode, ChevronRight, ChevronDown, ExternalLink,
  Globe, Sliders, Download,
} from '../components/icons'
import { StatusDot } from '../components/StatusDot'
import { useToast } from '../components/ui/Toast'
import { copyText } from '../lib/clipboard'
import { subLink } from '../lib/config'
import { notify, openLink, effectivePalette } from '../lib/telegram'
import { useT } from '../lib/i18n'
import { configMeta, configSpecLine } from '../lib/configMeta'
import type { Config } from '../api'

// Launchers and where to get them, per OS. A missing OS means the launcher isn't
// available there: v2rayNG is Android-only; Happ & v2RayTun were both pulled from
// the Russian App Store, so the iOS button says just "App Store" but links Global.
type OSKey = 'ios' | 'android' | 'windows' | 'macos' | 'linux'
type StoreLink = { label: string; href: string }

const OS_OPTS: { key: OSKey; label: string }[] = [
  { key: 'ios', label: 'iOS' },
  { key: 'android', label: 'Android' },
  { key: 'windows', label: 'Windows' },
  { key: 'macos', label: 'macOS' },
  { key: 'linux', label: 'Linux' },
]

// Protocols offered. Only VLESS is live today; AmneziaWG and Hysteria are shown
// as the roadmap but locked (not selectable) until they're finished server-side.
const PROTOCOLS: { id: string; name: string; locked: boolean }[] = [
  { id: 'vless', name: 'VLESS', locked: false },
  { id: 'awg', name: 'AmneziaWG', locked: true },
  { id: 'hysteria', name: 'Hysteria', locked: true },
]

const APPS: { id: string; name: string; stores: Partial<Record<OSKey, StoreLink[]>> }[] = [
  {
    id: 'happ',
    name: 'Happ',
    stores: {
      // App Store button is labelled plainly but the link is the Global store
      // (Happ/v2RayTun were pulled from the Russian App Store, Jun 2026).
      ios: [{ label: 'App Store', href: 'https://apps.apple.com/us/app/id6504287215' }],
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
      ios: [{ label: 'App Store', href: 'https://apps.apple.com/us/app/id6476628951' }],
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
  onOpenStats,
}: {
  config: Config | null
  open: boolean
  onClose: () => void
  onToggle: (key: 'enhanced' | 'game_mode', val: boolean) => void
  /** Kept for API compatibility with the parent; config delete is no longer
   *  exposed (the config comes with the subscription). */
  onDelete?: () => Promise<void>
  onOpenStats: () => void
}) {
  const { t, lang } = useT()
  const toast = useToast()
  const [showQr, setShowQr] = useState(false)
  const [showApps, setShowApps] = useState(false)
  const [os, setOs] = useState<OSKey>(detectOs)
  const [launcher, setLauncher] = useState<string>(() => launchersFor(detectOs())[0]?.id ?? 'happ')
  const [advOpen, setAdvOpen] = useState(false)

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

  return (
    <>
      <Sheet open={open} onClose={onClose} title={t('detail.title')} anim="center" pills>
        {/* identity — globe tile + name, with the protocol · transport · tech spec underneath. */}
        <div className="mb-6 mt-1 flex flex-col items-center text-center">
          <span className="grid h-[74px] w-[74px] place-items-center rounded-full bg-surface-sunken text-muted ring-1 ring-inset ring-border">
            <Globe size={30} />
          </span>
          <div className="font-display mt-3 text-[20px] font-semibold leading-tight text-ink">
            {t('detail.title')}
          </div>
          <div className="mt-0.5 text-[12.5px] text-faint">{configSpecLine(meta)}</div>
        </div>

        {/* connection: AmneziaWG .conf or VLESS "install to app" */}
        {isAwg ? (
          <div className="mb-5">
            <div className="mb-2.5 flex items-start gap-2 rounded-3xl border border-border bg-surface-sunken px-3 py-2.5">
              <pre className="no-scrollbar min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-[11.5px] leading-snug text-ink">
                {awgConf}
              </pre>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  onClick={() => setShowQr(true)}
                  className="tap grid h-9 w-9 place-items-center rounded-full text-ink active:bg-border"
                  aria-label={t('detail.qr')}
                >
                  <QrCode size={20} />
                </button>
                <button
                  onClick={() => copy(awgConf, t('detail.confCopied'))}
                  className="tap grid h-9 w-9 place-items-center rounded-full text-ink active:bg-border"
                  aria-label={t('common.copy')}
                >
                  <Copy size={20} />
                </button>
              </div>
            </div>
            <p className="text-[13px] leading-snug text-muted">{t('detail.awgImport')}</p>
          </div>
        ) : (
          <Button
            className="mb-3"
            stretched
            onClick={() => {
              const o = detectOs()
              setOs(o)
              setLauncher(launchersFor(o)[0]?.id ?? 'happ')
              setShowApps(true)
            }}
          >
            <Download size={20} /> {t('detail.installToApp')}
          </Button>
        )}

        {/* Subscription link — standalone capsule (copy / scan) */}
        {!isAwg && (
          <div className="mb-3 flex items-center gap-2 rounded-3xl border border-border bg-surface px-4 py-3">
            <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink">{link}</span>
            <button
              onClick={() => setShowQr(true)}
              className="tap grid h-9 w-9 shrink-0 place-items-center rounded-full text-accent active:bg-surface-sunken"
              aria-label={t('detail.qr')}
            >
              <QrCode size={20} />
            </button>
            <button
              onClick={() => copy(link, t('detail.linkCopied'))}
              className="tap grid h-9 w-9 shrink-0 place-items-center rounded-full text-accent active:bg-surface-sunken"
              aria-label={t('detail.copyLink')}
            >
              <Copy size={20} />
            </button>
          </div>
        )}

        {/* Settings — own capsule (protocol picker + mode picker, VLESS only) */}
        {!isAwg && (
          <div className="mb-3 overflow-hidden rounded-3xl border border-border bg-surface">
            <div>
              <button
                type="button"
                onClick={() => setAdvOpen((o) => !o)}
                className="tap flex min-h-[54px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-sunken"
              >
                <Sliders size={20} className="shrink-0 text-muted" />
                <span className="flex-1 text-[15px] text-ink">{t('create.advanced')}</span>
                <ChevronDown
                  size={20}
                  className={'text-muted transition-transform ' + (advOpen ? 'rotate-180' : '')}
                />
              </button>
              {advOpen && (
                <div className="border-t border-border">
                  {/* Protocol — VLESS live, others locked (roadmap) */}
                  <div className="px-4 pb-1.5 pt-3 text-[13px] text-muted">{t('create.protocol')}</div>
                  <div className="space-y-1.5 px-4">
                    {PROTOCOLS.map((p) => {
                      const selected = p.id === 'vless'
                      return (
                        <div
                          key={p.id}
                          className={
                            'flex w-full items-center gap-3 rounded-3xl border px-3 py-2.5 text-left ' +
                            (selected ? 'border-accent' : 'border-border') +
                            (p.locked ? ' opacity-50' : '')
                          }
                        >
                          <span
                            className={
                              'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ' +
                              (selected ? 'border-accent' : 'border-border')
                            }
                          >
                            {selected && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
                          </span>
                          <span className="flex-1 text-[15px] text-ink">{p.name}</span>
                          {p.locked && (
                            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-faint">
                              {t('create.soon')}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {/* Mode — Standard (Vision) / Enhanced (XHTTP) */}
                  <div className="px-4 pb-1.5 pt-3 text-[13px] text-muted">{t('create.mode')}</div>
                  <div className="flex gap-2 px-4">
                    {[
                      { v: false, label: t('create.standard') },
                      { v: true, label: t('create.enhanced') },
                    ].map((m) => (
                      <button
                        key={String(m.v)}
                        type="button"
                        onClick={() => onToggle('enhanced', m.v)}
                        className={
                          'h-10 flex-1 rounded-full border text-[14px] font-medium transition-colors ' +
                          (config.enhanced === m.v && !config.game_mode
                            ? 'border-accent text-ink'
                            : 'border-border text-ink active:bg-surface-sunken')
                        }
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 border-t border-border px-4 py-3 text-[13px] leading-snug text-muted">
                    {t('detail.afterChange')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Server status — own capsule */}
        <div className="mb-5 overflow-hidden rounded-3xl border border-border bg-surface">
          <button
            onClick={onOpenStats}
            className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left active:bg-surface-sunken"
          >
            <StatusDot ok={config.server_online} className="h-2 w-2" />
            <span className={'text-[15px] font-medium ' + (config.server_online ? 'text-success' : 'text-danger')}>
              {config.server_online ? t('server.online') : t('server.offline')}
            </span>
            <ChevronRight size={18} className="ml-auto text-faint" />
          </button>
        </div>
      </Sheet>

      {/* app chooser — OS tabs + launcher tabs + numbered install stepper */}
      <Sheet open={showApps} onClose={() => setShowApps(false)} onBack={() => setShowApps(false)} title={t('detail.chooseApp')} anim="center" pills>
        {/* OS — dropdown, same component as the language selector; each row its icon */}
        <div className="mb-3">
          <Dropdown
            value={os}
            onChange={(v) => {
              setOs(v)
              setLauncher(launchersFor(v)[0]?.id ?? 'happ')
            }}
            options={OS_OPTS.map((o) => ({
              value: o.key,
              label: o.label,
            }))}
          />
        </div>
        {/* launcher tabs — selecting one changes the guide below */}
        <div className="mb-4 flex gap-2">
          {launchersFor(os).map((app) => (
            <button
              key={app.id}
              onClick={() => setLauncher(app.id)}
              className={
                'tap h-9 flex-1 rounded-full border bg-surface text-[14px] font-medium text-ink transition-[transform,background-color,border-color] duration-150 ' +
                (launcher === app.id ? 'border-accent' : 'border-border active:bg-surface-sunken')
              }
            >
              {app.name}
            </button>
          ))}
        </div>
        {/* numbered stepper guide — ①②③ joined by a line, each step's action inline */}
        {(() => {
          const app = APPS.find((a) => a.id === launcher) ?? launchersFor(os)[0]
          if (!app) return null
          const store = (app.stores[os] ?? [])[0]
          const isMobile = os === 'ios' || os === 'android'
          return (
            <div key={launcher} className="animate-fade rounded-3xl border border-border bg-surface p-4">
              <div className="relative">
                {/* vertical line connecting the step numbers (centre to centre) */}
                <div className="absolute bottom-3.5 left-[13px] top-3.5 w-[2px] bg-border" />
              <div className="space-y-5">
                {/* step 1 — install */}
                <div className="relative flex gap-3.5">
                  <div className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-semibold text-white">1</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-ink">{t('detail.step1Title')}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">
                      {t(isMobile ? 'detail.step1Body' : 'detail.step1BodyDesktop')}
                    </p>
                    {store && (
                      <button
                        onClick={() => openLink(store.href)}
                        className="mt-2.5 inline-flex h-10 w-full items-center justify-center gap-1.5 tap rounded-full bg-accent/15 text-[13.5px] font-medium text-accent active:bg-accent/25"
                      >
                        <span className="truncate">{store.label}</span>
                        <ExternalLink size={14} className="shrink-0" />
                      </button>
                    )}
                  </div>
                </div>
                {/* step 2 — add subscription */}
                <div className="relative flex gap-3.5">
                  <div className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-semibold text-white">2</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-ink">{t('detail.step2Title')}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">{t('detail.step2Body')}</p>
                    <Button
                      stretched
                      className="mt-2.5"
                      onClick={() => {
                        openLink(importPage(app.id, link, lang))
                        setShowApps(false)
                      }}
                    >
                      {t('detail.addSub')}
                    </Button>
                    <button
                      onClick={() => copy(link, t('detail.linkCopied'))}
                      className="mt-2 inline-flex h-10 w-full items-center justify-center gap-1.5 tap rounded-full bg-accent/15 text-[13.5px] font-medium text-accent active:bg-accent/25"
                    >
                      <Copy size={14} className="shrink-0" /> {t('detail.copyLink')}
                    </button>
                  </div>
                </div>
                {/* step 3 — connect */}
                <div className="relative flex gap-3.5">
                  <div className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-semibold text-white">3</div>
                  <div className="min-w-0 flex-1 pb-1">
                    <p className="text-[14px] font-semibold text-ink">{t('detail.step3Title')}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">{t('detail.step3Body')}</p>
                  </div>
                </div>
              </div>
            </div>
            </div>
          )
        })()}
      </Sheet>

      {/* QR — bottom sheet that slides up from the bottom edge */}
      <BottomSheet open={showQr} onClose={() => setShowQr(false)} title={t('detail.qrTitle')}>
        <div className="flex justify-center">
          <Qr value={isAwg ? awgConf : link} />
        </div>
        <p className="mx-auto mt-4 max-w-[260px] text-center text-[13px] leading-snug text-muted">
          {isAwg ? t('detail.awgQrHint') : t('detail.qrHint')}
        </p>
      </BottomSheet>
    </>
  )
}
