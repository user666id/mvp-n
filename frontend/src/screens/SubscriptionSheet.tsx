import { useEffect, useState, lazy, Suspense } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { Section } from '../components/ui/Card'
import { Cell } from '../components/ui/Cell'
import { ListSkeleton } from '../components/ui/Skeleton'
import { Badge } from '../components/ui/Badge'
import { CurrencyIcon } from '../components/CurrencyIcon'
import { Dollar, Key, Clock, ChevronRight, ExternalLink } from '../components/icons'
import { SubscribeSheet } from './SubscribeSheet'
import { KeyEntrySheet } from './KeyEntrySheet'
import { openLink } from '../lib/telegram'
import { useT } from '../lib/i18n'
import { subState, fmtSubDate, txExplorerUrl } from '../lib/subscription'
import { getOrderHistory, type Profile, type Order } from '../api'

// Lazy: pulls in the @tonconnect/ui SDK only when the payment pane opens.
const WalletStatus = lazy(() => import('./WalletStatus'))

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
  const daysLeft =
    state === 'active' && profile?.paid_until
      ? Math.max(0, Math.ceil((new Date(profile.paid_until).getTime() - Date.now()) / 86_400_000))
      : 0

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
        ? t('sub.daysLeft', { n: daysLeft })
        : state === 'expired'
          ? t('sub.expiredHint')
          : t('sub.noneHint')

  const danger = state === 'expired'

  return (
    <Sheet open={open} onClose={onClose} title={t('sub.status')}>
      {/* status header — only states that prompt the user (expired / none);
          active and lifetime show a short line at the bottom instead. */}
      {state !== 'active' && state !== 'lifetime' && (
        <div className="px-1 pt-1">
          <h3
            className={
              'font-display text-[21px] font-semibold ' + (danger ? 'text-danger' : 'text-ink')
            }
          >
            {title}
          </h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{hint}</p>
        </div>
      )}

      {/* TON wallet at the top — link up-front (one-tap renewals); shows +
          disconnects once connected. Lazy: TON Connect SDK loads with this pane. */}
      <div className="mt-4">
        <Suspense fallback={null}>
          <WalletStatus />
        </Suspense>
      </div>

      {/* actions as plain grey rows (Claude "Billing" style — not coloured buttons) */}
      <div className="mt-4">
        <Section>
          {state !== 'lifetime' && (
            <Cell
              before={<Dollar size={20} />}
              after={<ChevronRight size={20} className="text-faint" />}
              title={state === 'none' ? t('sub.buy') : t('sub.renew')}
              onClick={() => setBuyOpen(true)}
            />
          )}
          {state !== 'lifetime' && (
            <Cell
              before={<Key size={20} />}
              after={<ChevronRight size={20} className="text-faint" />}
              title={t('sub.haveKey')}
              onClick={() => setKeyOpen(true)}
            />
          )}
          <Cell
            before={<Clock size={20} />}
            after={<ChevronRight size={20} className="text-faint" />}
            title={t('sub.history')}
            onClick={() => setHistoryOpen(true)}
            last
          />
        </Section>
      </div>

      {/* short status line at the bottom (active + lifetime) */}
      {state === 'active' && (
        <p className="mt-5 text-center text-[13px] text-muted">
          {t('sub.activeShort', { d: fmtSubDate(profile!.paid_until!, lang) })} · {t('sub.daysLeft', { n: daysLeft })}
        </p>
      )}
      {state === 'lifetime' && (
        <p className="mt-5 text-center text-[13px] text-muted">{t('sub.lifetimeBottom')}</p>
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
        <div className="animate-fade overflow-hidden rounded-2xl border border-border bg-surface">
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
                  {txUrl && (
                    <div className="mt-0.5 inline-flex items-center gap-0.5 text-[12.5px] text-accent">
                      {t('sub.viewTx')} <ExternalLink size={12} />
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <div className="flex items-center gap-1.5 text-[14px] font-medium tabular-nums text-ink">
                    <CurrencyIcon asset={o.asset} size={16} />
                    {o.amount} {assetLabel(o.asset)}
                  </div>
                  <div className="mt-0.5 text-[12.5px] tabular-nums text-muted">
                    {fmtWhen(o.paid_at || o.created_at)}
                  </div>
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
