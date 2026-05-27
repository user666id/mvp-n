import type { ReactNode } from 'react'
import { Avatar } from './ui/Avatar'
import { Badge } from './ui/Badge'
import { Copy, ExternalLink } from './icons'
import { useToast } from './ui/Toast'
import { copyText } from '../lib/clipboard'
import { openLink } from '../lib/telegram'
import { padId, formatBytes } from '../lib/format'
import { useT } from '../lib/i18n'

/** Common subset both the user `Profile` and admin `AdminProfile` satisfy. */
export interface ProfileDetailsData {
  id: number
  internal_id: number
  first_name?: string | null
  username?: string | null
  is_admin?: boolean
  is_blocked?: boolean
  traffic_used: number
}

/**
 * Unified profile header + info card. The single standard shared by the user's
 * own "Account" sheet and the admin "Profile" sheet, so both look identical.
 */
export function ProfileDetails({ p }: { p: ProfileDetailsData }) {
  const { t, lang } = useT()
  const toast = useToast()

  const Row = ({
    k,
    v,
    onClick,
    accent,
    icon,
  }: {
    k: string
    v: ReactNode
    onClick?: () => void
    accent?: boolean
    icon?: ReactNode
  }) => {
    const valCls = 'truncate text-[15px] font-medium ' + (accent ? 'text-accent' : 'text-ink')
    return (
      <div className="flex min-h-[54px] items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-0">
        <span className="text-[15px] text-muted">{k}</span>
        {onClick ? (
          <button onClick={onClick} className="flex min-w-0 items-center gap-1.5 active:opacity-60">
            <span className={valCls}>{v}</span>
            {icon}
          </button>
        ) : (
          <span className={valCls}>{v}</span>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="mb-5 flex items-center gap-3 px-1">
        <Avatar name={p.first_name ?? undefined} fallback={p.username ?? undefined} size={56} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[18px] font-semibold text-ink">
              {p.first_name || 'id' + p.id}
            </span>
            {p.is_admin && <Badge tone="accent">{t('settings.admin')}</Badge>}
            {p.is_blocked && <Badge>{t('devices.blockedShort')}</Badge>}
          </div>
          <div className="text-[13px] text-muted">
            {t('admin.profileFallback', { id: padId(p.internal_id) })}
          </div>
        </div>
      </div>

      <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-surface">
        <Row
          k="Telegram ID"
          v={String(p.id)}
          icon={<Copy size={14} className="shrink-0 text-faint" />}
          onClick={() => copyText(String(p.id)).then(() => toast(t('admin.idCopied')))}
        />
        {p.username ? (
          <Row
            k="Username"
            v={'@' + p.username}
            accent
            icon={<ExternalLink size={14} className="shrink-0 text-accent" />}
            onClick={() => openLink('https://t.me/' + p.username)}
          />
        ) : (
          <Row k="Username" v="—" />
        )}
        <Row k={t('admin.internalId')} v={padId(p.internal_id)} />
        <Row k={t('admin.traffic')} v={formatBytes(p.traffic_used, lang)} />
      </div>
    </>
  )
}
