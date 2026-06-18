import { useEffect, useState } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { Button } from '../components/ui/Button'
import { Section } from '../components/ui/Card'
import { Cell } from '../components/ui/Cell'
import { ListSkeleton } from '../components/ui/Skeleton'
import { Badge } from '../components/ui/Badge'
import { Star, Lock, Clock, ChevronRight, ExternalLink } from '../components/icons'
import { SubscribeSheet } from './SubscribeSheet'
import { KeyEntrySheet } from './KeyEntrySheet'
import { openLink } from '../lib/telegram'
import { useT } from '../lib/i18n'
import { subState, fmtSubDate, txExplorerUrl } from '../lib/subscription'
import { getOrderHistory, type Profile, type Order } from '../api'

const planLabel = (days: number, t: ReturnType<typeof useT>['t']) =>
  ({ 7: t('pay.d7'), 30: t('pay.d30'), 90: t('pay.d90'), 365: t('pay.d365') } as Record<number, string>)[
    days
  ] || `${days} d`

/** Dedicated "Subscription" pane (opened from Settings). Shows the current
 *  status — lifetime (key), active until a date, expired, or none — the
 *  buy/renew action, and payment history. Keeps the Configs screen clean.
 *  Neutral by design; only an expired subscription is highlighted (red). */
export function SubscriptionSheet({
  open,
  onClose,
  profile,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  profile: Profile | null
  onChanged: () => void
}) {
  const { t, lang } = useT()
  const [buyOpen, setBuyOpen] = useState(false)
  const [keyOpen, setKeyOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const state = profile ? subState(profile) : 'none'

  const title =
    state === 'lifetime'
      ? t('sub.lifetimeShort')
      : state === 'active'
        ? t('sub.activeTitle')
        : state === 'expired'
          ? t('sub.expired')
          : t('sub.none')

  const hint =
    state === 'lifetime'
      ? t('sub.lifetimeHint')
      : state === 'active'
        ? t('sub.until', { d: fmtSubDate(profile!.paid_until!, lang) })
        : state === 'expired'
          ? t('sub.expiredHint')
          : t('sub.noneHint')

  const danger = state === 'expired'

  return (
    <Sheet open={open} onClose={onClose} title={t('sub.status')}>
      {/* status */}
      <div className="flex flex-col items-center pt-3 text-center">
        <span
          className={
            'grid h-16 w-16 place-items-center rounded-3xl ' +
            (danger ? 'bg-danger/12 text-danger' : 'bg-surface-sunken text-muted')
          }
        >
          {danger ? <Lock size={28} /> : <Star size={28} />}
        </span>
        <h3
          className={
            'font-display mt-4 text-[20px] font-semibold ' + (danger ? 'text-danger' : 'text-ink')
          }
        >
          {title}
        </h3>
        <p className="mt-1.5 max-w-[300px] text-[14px] leading-relaxed text-muted">{hint}</p>
      </div>

      {/* primary action + "I have a key" — full width, lifetime/key has none.
          Key entry is available on renew too, not just first activation. */}
      {state !== 'lifetime' && (
        <>
          <Button stretched className="mt-6" onClick={() => setBuyOpen(true)}>
            {state === 'none' ? t('sub.buy') : t('sub.renew')}
          </Button>
          <button
            onClick={() => setKeyOpen(true)}
            className="mt-3 w-full text-center text-[14px] font-medium text-accent active:opacity-70"
          >
            {t('sub.haveKey')}
          </button>
        </>
      )}

      {/* payment history — key/lifetime users have no payments */}
      {state !== 'lifetime' && (
        <div className="mt-4">
          <Section>
            <Cell
              before={<Clock size={20} />}
              after={<ChevronRight size={20} className="text-faint" />}
              title={t('sub.history')}
              onClick={() => setHistoryOpen(true)}
              last
            />
          </Section>
        </div>
      )}

      <SubscribeSheet
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        onPaid={onChanged}
        renewing={state === 'active' || state === 'expired'}
      />
      <KeyEntrySheet
        open={keyOpen}
        onClose={() => setKeyOpen(false)}
        onActivated={() => {
          setKeyOpen(false)
          onChanged()
        }}
      />
      <PaymentHistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </Sheet>
  )
}

/** Read-only list of the user's past payments (newest first). */
function PaymentHistorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useT()
  const [items, setItems] = useState<Order[] | null>(null)

  useEffect(() => {
    if (!open) return
    setItems(null)
    getOrderHistory()
      .then(setItems)
      .catch(() => setItems([]))
  }, [open])

  const fmtWhen = (s?: string) =>
    s
      ? new Date(s).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : ''
  const assetLabel = (a: string) => (a === 'TON' ? 'GRAM' : 'USDT')

  return (
    <Sheet open={open} onClose={onClose} onBack={onClose} title={t('sub.history')}>
      {!items ? (
        <ListSkeleton rows={3} avatar={false} card />
      ) : items.length === 0 ? (
        <div className="py-14 text-center text-[14px] text-muted">{t('sub.historyEmpty')}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {items.map((o, i) => {
            const paid = o.status !== 'expired'
            const txUrl = paid ? txExplorerUrl(o.asset, o.tx_hash) : ''
            const border = i === items.length - 1 ? '' : 'border-b border-border'
            const body = (
              <>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-medium text-ink">{planLabel(o.plan_days, t)}</span>
                    <Badge tone={paid ? 'success' : 'neutral'}>
                      {paid ? t('sub.statusPaid') : t('sub.statusExpired')}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted">
                    {fmtWhen(o.paid_at || o.created_at)}
                    {txUrl && (
                      <>
                        <span className="text-faint">·</span>
                        <span className="inline-flex items-center gap-0.5 text-muted">
                          {t('sub.viewTx')} <ExternalLink size={12} className="text-faint" />
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-[14px] text-ink">
                  {o.amount} {assetLabel(o.asset)}
                </div>
              </>
            )
            return txUrl ? (
              <button
                key={o.id}
                onClick={() => openLink(txUrl)}
                className={'flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface-sunken ' + border}
              >
                {body}
              </button>
            ) : (
              <div key={o.id} className={'flex items-center gap-3 px-4 py-3.5 ' + border}>
                {body}
              </div>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}
