import { useEffect, useRef, useState } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Qr } from '../components/Qr'
import { CurrencyIcon } from '../components/CurrencyIcon'
import { Check, Copy } from '../components/icons'
import { useToast } from '../components/ui/Toast'
import { copyText } from '../lib/clipboard'
import { notify } from '../lib/telegram'
import {
  getPlans,
  createOrder,
  getOrder,
  getPendingOrders,
  cancelOrder,
  type Plan,
  type Order,
} from '../api'
import { useT } from '../lib/i18n'

type Step = 'select' | 'pay' | 'done'
type Asset = { id: string; label: string; network: string }

/** Buy / renew a subscription. Pick plan + asset → get a unique-amount payment
 *  request (address + exact amount + QR) → poll the order until it's confirmed. */
export function SubscribeSheet({
  open,
  onClose,
  onPaid,
}: {
  open: boolean
  onClose: () => void
  onPaid: () => void
}) {
  const { t } = useT()
  const toast = useToast()
  const [plans, setPlans] = useState<Plan[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [gramUsd, setGramUsd] = useState(0)
  const [asset, setAsset] = useState('TON')
  const [days, setDays] = useState(7)
  const [step, setStep] = useState<Step>('select')
  const [order, setOrder] = useState<Order | null>(null)
  const [pending, setPending] = useState<Order[]>([])
  const [busy, setBusy] = useState(false)
  const poll = useRef<number | undefined>(undefined)

  const loadPending = () =>
    getPendingOrders()
      .then((list) => setPending(Array.isArray(list) ? list : []))
      .catch(() => {})

  useEffect(() => {
    if (!open) return
    setStep('select')
    setOrder(null)
    setPending([])
    setDays(7) // default to the first plan (7 days)
    getPlans()
      .then((r) => {
        setPlans(r.plans)
        setAssets(r.assets)
        setGramUsd(r.gram_usd || 0)
        if (r.assets[0]) setAsset(r.assets[0].id)
      })
      .catch(() => toast(t('pay.failed')))
    // Unfinished payments are listed on the select step (continue / cancel) —
    // we never force the QR screen, so "Renew" still lets the user pick a plan.
    loadPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const resume = (o: Order) => {
    setOrder(o)
    setStep('pay')
  }
  const cancel = async (o: Order) => {
    setPending((prev) => prev.filter((x) => x.id !== o.id))
    try {
      await cancelOrder(o.id)
    } catch {
      loadPending()
    }
  }

  useEffect(() => {
    if (step !== 'pay' || !order) return
    const tick = async () => {
      try {
        const o = await getOrder(order.id)
        if (o.status === 'paid') {
          window.clearInterval(poll.current)
          notify('success')
          onPaid()
          setStep('done')
        } else if (o.status === 'expired') {
          window.clearInterval(poll.current)
          toast(t('pay.expired'))
          setStep('select')
        }
      } catch {
        /* keep polling */
      }
    }
    poll.current = window.setInterval(tick, 4000)
    return () => window.clearInterval(poll.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, order])

  const cur = assets.find((a) => a.id === asset)
  const label = cur?.label ?? asset
  const network = cur?.network ?? 'TON'
  // Prices are pegged to USD. USDT is 1:1; GRAM is converted at the live rate
  // (approximate here — the exact amount is locked when the order is created).
  const isGram = asset === 'TON'
  const priceNum = (p: Plan) => (isGram ? (gramUsd > 0 ? p.usd / gramUsd : 0) : p.usd)
  const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))
  const priceStr = (p: Plan) => `${fmtNum(priceNum(p))} ${label}`
  const dayName = (d: number) =>
    ({ 7: t('pay.d7'), 30: t('pay.d30'), 90: t('pay.d90'), 365: t('pay.d365') } as Record<number, string>)[d] ||
    String(d)

  const startPay = async () => {
    setBusy(true)
    try {
      setOrder(await createOrder(days, asset))
      setStep('pay')
    } catch {
      toast(t('pay.failed'))
    } finally {
      setBusy(false)
    }
  }

  const copy = (s: string) => copyText(s).then(() => toast(t('common.copied')))

  // QR: prefill amount for native GRAM; plain address otherwise (jetton/TRC20).
  const qrValue =
    order && order.asset === 'TON'
      ? `ton://transfer/${order.address}?amount=${Math.round(parseFloat(order.amount) * 1e9)}`
      : order?.address ?? ''

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onBack={
        step !== 'select'
          ? () => {
              setStep('select')
              loadPending() // surface the just-created order in the list
            }
          : undefined
      }
      title={t('pay.title')}
    >
      {step === 'select' && (
        <>
          {pending.length > 0 && (
            <div className="mb-5">
              <div className="mb-2 px-1 text-[12px] font-medium uppercase tracking-[0.06em] text-faint">
                {t('pay.resumeTitle')}
              </div>
              <div className="overflow-hidden rounded-2xl border border-border bg-surface">
                {pending.map((o, i) => (
                  <div
                    key={o.id}
                    className={
                      'flex items-center gap-2 px-4 py-3 ' +
                      (i === pending.length - 1 ? '' : 'border-b border-border')
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium text-ink">
                        {o.amount} {assets.find((a) => a.id === o.asset)?.label ?? o.asset}
                      </div>
                      <div className="text-[12px] text-faint">{dayName(o.plan_days)}</div>
                    </div>
                    <button
                      onClick={() => resume(o)}
                      className="shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-medium text-white active:bg-accent-hover"
                    >
                      {t('pay.resumeBtn')}
                    </button>
                    <button
                      onClick={() => cancel(o)}
                      className="shrink-0 px-2 py-1.5 text-[13px] font-medium text-muted active:text-danger"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-2 px-1 text-[12px] font-medium uppercase tracking-[0.06em] text-faint">
            {t('pay.currency')}
          </div>
          <div className="mb-5 flex gap-2">
            {assets.map((a) => (
              <button
                key={a.id}
                onClick={() => setAsset(a.id)}
                className={
                  'flex flex-1 flex-col items-center gap-1 rounded-2xl border px-2 py-2.5 text-center ' +
                  (asset === a.id ? 'border-accent bg-accent-soft' : 'border-border bg-surface')
                }
              >
                <CurrencyIcon asset={a.id} size={26} />
                <div className="text-[14px] font-medium text-ink">{a.label}</div>
                <div className="text-[11px] text-faint">{a.network}</div>
              </button>
            ))}
          </div>

          <div className="mb-2 px-1 text-[12px] font-medium uppercase tracking-[0.06em] text-faint">
            {t('pay.plan')}
          </div>
          <div className="mb-5 flex flex-col gap-2">
            {plans.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className={
                  'flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left ' +
                  (days === p.days ? 'border-accent bg-accent-soft' : 'border-border bg-surface')
                }
              >
                <span className="text-[15px] font-medium text-ink">{dayName(p.days)}</span>
                <span className="text-[15px] text-ink">{priceStr(p)}</span>
              </button>
            ))}
          </div>

          <Button onClick={startPay} loading={busy} stretched>
            {t('pay.pay', { a: priceStr(plans.find((p) => p.days === days) || ({ usd: 0 } as Plan)) })}
          </Button>
        </>
      )}

      {step === 'pay' && order && (
        <div className="flex flex-col items-center text-center">
          <p className="mb-3 max-w-[300px] text-[14px] leading-relaxed text-muted">
            {t('pay.sendExactly')} <span className="font-semibold text-ink">{order.amount} {label}</span>{' '}
            ({t('pay.network')} {network})
          </p>
          <Qr value={qrValue} size={196} />

          <button
            onClick={() => copy(order.amount)}
            className="mt-4 flex w-full items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-left"
          >
            <span className="text-[12px] text-faint">{t('pay.amount')}</span>
            <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              {order.amount} {label} <Copy size={16} className="text-faint" />
            </span>
          </button>
          <button
            onClick={() => copy(order.address)}
            className="mt-2 flex w-full items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-left"
          >
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink">{order.address}</span>
            <Copy size={16} className="shrink-0 text-faint" />
          </button>

          <div className="mt-5 flex items-center gap-2 text-[13px] text-muted">
            <Spinner size={16} /> {t('pay.waiting')}
          </div>
          <p className="mt-2 px-2 text-[12px] leading-snug text-faint">{t('pay.exactHint')}</p>
          <p className="mt-3 rounded-xl bg-surface-sunken px-3 py-2.5 text-[12px] leading-snug text-muted">
            {t('pay.autoHint')}
          </p>
        </div>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center py-10 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
            <Check size={32} strokeWidth={2.5} />
          </span>
          <h3 className="font-display mt-4 text-[20px] font-semibold text-ink">{t('pay.done')}</h3>
          <p className="mt-1 text-[14px] text-muted">{t('pay.doneHint')}</p>
          <Button onClick={onClose} stretched className="mt-6">
            {t('common.close')}
          </Button>
        </div>
      )}
    </Sheet>
  )
}
