import type { ReactNode } from 'react'
import { Phone, Monitor, Pencil } from './icons'
import { relativeTime, isMobileDevice } from '../lib/format'
import { useT } from '../lib/i18n'
import type { Device } from '../api'

/** Known OS names auto-filled by the server (vs. a user-given custom name). */
const KNOWN_OS = new Set(['ios', 'ipados', 'android', 'windows', 'macos', 'mac', 'linux', 'harmonyos'])
export const isOSName = (s?: string) => !s || KNOWN_OS.has(s.trim().toLowerCase())

/**
 * Shared device row used identically in the user devices list and the admin
 * panel: icon + "Устройство N" (or custom name) + "{OS} · {launcher} · status".
 * Each caller supplies its own trailing control (chevron / delete) via `trailing`.
 */
export function DeviceRow({
  device: d,
  index: i,
  border,
  onRename,
  trailing,
}: {
  device: Device
  index: number
  border?: boolean
  onRename?: () => void
  trailing?: ReactNode
}) {
  const { t, lang } = useT()
  const Icon = isMobileDevice(d.name) ? Phone : Monitor
  const renamed = !isOSName(d.name)
  const primary = renamed ? d.name : `${t('common.device')} ${i + 1}`
  // Subtitle: "{OS} · {launcher}". Prefer the dedicated os field; fall back to
  // the name when it is itself an OS (legacy rows saved before os was stored
  // separately). The title is a model/custom name or "Устройство N" — never the
  // bare OS — so OS in the subtitle never duplicates it.
  const osLabel = d.os || (renamed ? '' : d.name)
  const meta = [osLabel, d.client].filter(Boolean).join(' · ')
  const online = !!d.online

  return (
    <div className={'flex min-h-[54px] items-center gap-3 px-4 py-2.5 ' + (border ? 'border-b border-border' : '')}>
      <Icon size={22} className={d.is_blocked ? 'text-faint' : 'text-muted'} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-medium text-ink">{primary}</span>
          {onRename && (
            <button
              onClick={onRename}
              className="shrink-0 text-accent active:opacity-60"
              aria-label={t('devices.rename')}
            >
              <Pencil size={15} />
            </button>
          )}
          {d.is_blocked && (
            <span className="shrink-0 text-[11px] text-danger">{t('devices.blockedShort')}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 truncate text-[12.5px] text-muted">
          {meta && <span className="truncate">{meta} ·</span>}
          {d.is_blocked ? (
            <span className="text-danger">{t('devices.blocked')}</span>
          ) : online ? (
            <span className="inline-flex items-center gap-1 text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {t('common.online')}
            </span>
          ) : (
            <span>{relativeTime(d.last_seen, lang)}</span>
          )}
        </div>
      </div>
      {trailing}
    </div>
  )
}
