import React, { useState } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { Button } from '../components/ui/Button'
import { Section } from '../components/ui/Card'
import { Cell } from '../components/ui/Cell'
import { Collapse } from '../components/ui/Collapse'
import { Switch } from '../components/ui/Switch'
import { Spinner } from '../components/ui/Spinner'
import { Qr } from '../components/Qr'
import { Pencil, Copy, QrCode, ChevronRight, Check, X, Trash } from '../components/icons'
import { useToast } from '../components/ui/Toast'
import { copyText } from '../lib/clipboard'
import { subLink } from '../lib/config'
import { confirmDialog, notify, openLink } from '../lib/telegram'
import { useT } from '../lib/i18n'
import { configMeta, configSpecLine } from '../lib/configMeta'
import type { Config } from '../api'

// Clients that accept a one-tap VLESS-subscription import. The actual jump is
// done by a tiny web page (import.html) opened in the external browser, because
// custom-scheme deeplinks (happ://, …) are blocked inside Telegram's webview.
// One-tap import clients for VLESS subscriptions.
const APPS: { id: string; name: string }[] = [
  { id: 'v2raytun', name: 'v2RayTun' },
  { id: 'happ', name: 'Happ' },
  { id: 'v2rayng', name: 'v2rayNG' },
]

/** URL of the redirect page next to the app (…/v2/import.html). */
function importPage(appId: string, target: string, lang: string): string {
  return new URL(
    `import.html?app=${appId}&u=${encodeURIComponent(target)}&lang=${lang}`,
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
            <Button variant="secondary" stretched onClick={() => setShowApps(true)}>
              {t('detail.installToApp')}
            </Button>
            <button
              onClick={() => setShowRaw(true)}
              className="mt-3 block w-full text-center text-[13px] text-muted active:opacity-60"
            >
              {t('detail.otherFormat')}
            </button>
          </div>
        )}

        {/* settings — collapsible accordion (VLESS only) */}
        {!isAwg && (
        <div className="mb-5">
          <Collapse title={t('create.advanced')}>
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
          <p className="px-3 pt-2 text-[13px] leading-snug text-muted">
            {t('detail.afterChange')}
          </p>
        </div>
        )}

        {/* server status → stats (reflects the real server_online flag) */}
        <button
          onClick={onOpenStats}
          className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5 text-left active:bg-surface-sunken"
        >
          <span
            className={
              'grid h-6 w-6 shrink-0 place-items-center rounded-full ' +
              (config.server_online ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger')
            }
          >
            {config.server_online ? (
              <Check size={15} strokeWidth={2.5} />
            ) : (
              <X size={15} strokeWidth={2.5} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium text-ink">
              {config.server_online ? t('server.online') : t('server.offline')}
            </div>
            <div className="text-[13px] text-muted">{t('detail.serverOkSub')}</div>
          </div>
          <ChevronRight size={20} className="text-faint" />
        </button>

        <Section header={t('settings.danger')}>
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

      {/* app chooser — one-tap import into a client */}
      <Sheet open={showApps} onClose={() => setShowApps(false)} onBack={() => setShowApps(false)} title={t('detail.chooseApp')}>
        <Section>
          {APPS.map((app, i) => (
            <Cell
              key={app.id}
              title={app.name}
              after={<ChevronRight size={20} className="text-faint" />}
              onClick={() => {
                openLink(importPage(app.id, link, lang))
                setShowApps(false)
              }}
              last={i === APPS.length - 1}
            />
          ))}
        </Section>
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
        title={t('detail.title')}
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
        <p className="mb-4 px-1 text-[14px] leading-snug text-muted">
          {t('detail.renameHint')}
        </p>
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
