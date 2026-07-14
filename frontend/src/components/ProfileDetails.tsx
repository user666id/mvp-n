import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Avatar } from './ui/Avatar'
import { Badge } from './ui/Badge'
import { BottomSheet } from './ui/BottomSheet'
import { Copy, ExternalLink } from './icons'
import { useToast } from './ui/Toast'
import { copyText } from '../lib/clipboard'
import { openLink } from '../lib/telegram'
import { padId, formatBytes } from '../lib/format'
import { useT } from '../lib/i18n'
import { subLabel } from '../lib/subscription'
import { WalletSkeleton } from './WalletSkeleton'

/** Common subset both the user `Profile` and admin `AdminProfile` satisfy. */
export interface ProfileDetailsData {
  id: number
  internal_id: number
  first_name?: string | null
  username?: string | null
  is_admin?: boolean
  is_blocked?: boolean
  is_active?: boolean
  paid_until?: string | null
  is_expired?: boolean
  traffic_used: number
}

/**
 * Unified profile header + info card. The single standard shared by the user's
 * own "Account" sheet and the admin "Profile" sheet, so both look identical.
 */
/** The TON wallet capsule — the SAME component used on the Subscription screen
 *  (lazy, its own TonConnectUIProvider). Shown at the bottom of the user's own
 *  profile; connects in place. */
const WalletStatus = lazy(() => import('../screens/WalletStatus'))

export function ProfileDetails({ p, showWallet }: { p: ProfileDetailsData; showWallet?: boolean }) {
  const { t, lang } = useT()
  const toast = useToast()
  const sub = subLabel(p, t, lang)
  const [blkOpen, setBlkOpen] = useState(false)

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
      <div className="mb-6 flex items-center gap-3 px-1">
        <Avatar name={p.first_name ?? undefined} fallback={p.username ?? undefined} size={56} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[17px] font-semibold text-ink">
              {p.first_name || 'id' + p.id}
            </span>
            {p.is_admin && <Badge tone="neutral">{t('settings.admin')}</Badge>}
          </div>
        </div>
      </div>

      {/* Wallet capsule — only on the user's OWN profile (admin view omits it).
          The same capsule as on the Subscription screen; connects in place. */}
      {showWallet && (
        <Suspense fallback={<div className="mb-6"><WalletSkeleton /></div>}>
          <div className="mb-6">
            <WalletStatus />
          </div>
        </Suspense>
      )}

      <div className="mb-6 overflow-hidden rounded-3xl border border-border bg-surface">
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
            icon={<ExternalLink size={15} className="shrink-0 text-faint" />}
            onClick={() => openLink('https://t.me/' + p.username)}
          />
        ) : (
          <Row k="Username" v="—" />
        )}
        <Row k={t('admin.internalId')} v={padId(p.internal_id)} />
        <Row
          k={t('sub.status')}
          v={
            <span
              className={
                sub.tone === 'success'
                  ? 'text-success'
                  : sub.tone === 'danger'
                    ? 'text-danger'
                    : 'text-muted'
              }
            >
              {sub.text}
            </span>
          }
          onClick={p.is_blocked ? () => setBlkOpen(true) : undefined}
          icon={
            p.is_blocked ? (
              <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-danger/15 text-[11px] font-bold leading-none text-danger">
                !
              </span>
            ) : undefined
          }
        />
        <Row k={t('admin.traffic')} v={formatBytes(p.traffic_used, lang)} />
      </div>

      <BottomSheet open={blkOpen} onClose={() => setBlkOpen(false)} title={t('sub.blocked')}>
        <p className="px-2 pb-2 text-center text-[14px] leading-relaxed text-muted">{t('admin.blockedBy')}</p>
      </BottomSheet>
    </>
  )
}
