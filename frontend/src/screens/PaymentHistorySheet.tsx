import { useEffect, useState } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { ListSkeleton } from '../components/ui/Skeleton'
import { LoadError } from '../components/ui/LoadError'
import { Badge } from '../components/ui/Badge'
import { CurrencyIcon } from '../components/CurrencyIcon'
import { ExternalLink, Clock } from '../components/icons'
import { SheetHero } from '../components/ui/SheetHero'
import { openLink } from '../lib/telegram'
import { fmtSubDate, txExplorerUrl } from '../lib/subscription'
import { getOrderHistory, type Order } from '../api'
import { useT } from '../lib/i18n'

const planLabel = (days: number, t: ReturnType<typeof useT>['t']) =>
  ({ 7: t('pay.d7'), 30: t('pay.d30'), 90: t('pay.d90'), 365: t('pay.d365') } as Record<number, string>)[
    days
  ] || `${days} d`

/** Read-only list of the user's past payments (newest first). */
export function PaymentHistorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useT()
  const [items, setItems] = useState<Order[] | null>(null)
  const [failed, setFailed] = useState(false)

  // A failed fetch must NOT look like "no payments" — flag it so the UI shows a
  // Retry instead of the empty state.
  const load = () => {
    setFailed(false)
    setItems(null)
    getOrderHistory()
      .then(setItems)
      .catch(() => setFailed(true))
  }

  // Pull-to-refresh: re-fetch without blanking the list to a skeleton.
  const refresh = () => getOrderHistory().then(setItems).catch(() => {})

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const fmtWhen = (s?: string) => (s ? fmtSubDate(s, lang) : '')
  const assetLabel = (a: string) => (a === 'TON' ? 'GRAM' : 'USDT')

  return (
    <Sheet open={open} onClose={onClose} onBack={onClose} title={t('sub.history')} onRefresh={refresh}>
      <SheetHero icon={<Clock size={30} />} title={t('sub.history')} />
      {failed ? (
        <LoadError onRetry={load} />
      ) : !items ? (
        <ListSkeleton rows={3} avatar={false} card />
      ) : items.length === 0 ? (
        <div className="py-14 text-center text-[14px] text-muted">{t('sub.historyEmpty')}</div>
      ) : (
        <div className="animate-fade overflow-hidden rounded-3xl border border-border bg-surface">
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
                className={'tap flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface-sunken ' + border}
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
