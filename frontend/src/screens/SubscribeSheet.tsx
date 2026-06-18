import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Qr } from '../components/Qr'
import { CurrencyIcon } from '../components/CurrencyIcon'
import { Check, Copy, QrCode, ChevronDown, Wallet } from '../components/icons'
import { useToast } from '../components/ui/Toast'
import { copyText } from '../lib/clipboard'
import { notify, confirmDialog, openInvoice } from '../lib/telegram'
import {
  getPlans,
  getProfile,
  createOrder,
  createStarsInvoice,
  getOrder,
  getPendingOrders,
  cancelOrder,
  type Plan,
  type Order,
} from '../api'
import { useT } from '../lib/i18n'

// Lazy: pulls in @tonconnect/ui only when the GRAM confirm step renders the
// wallet button, keeping the SDK out of the initial bundle.
const WalletPay = lazy(() => import('./WalletPay'))

type Step = 'select' | 'confirm' | 'pay' | 'done'
type Asset = { id: string; label: string; network: string }

/** Buy / renew a subscription. Pick plan + asset → get a unique-amount payment
 *  request (address + exact amount + QR) → poll the order until it's confirmed. */
export function SubscribeSheet({
  open,
  onClose,
  onPaid,
  renewing = false,
}: {
  open: boolean
  onClose: () => void
  onPaid: () => void
  /** true = the user already had a subscription (renew), false = first purchase. */
  renewing?: boolean
}) {
  const { t } = useT()
  const toast = useToast()
  const [plans, setPlans] = useState<Plan[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [gramUsd, setGramUsd] = useState(0)
  const [starsByDays, setStarsByDays] = useState<Record<number, number>>({})
  const [asset, setAsset] = useState('') // '' = no method chosen yet (prices hidden)
  const [days, setDays] = useState(7)
  const [step, setStep] = useState<Step>('select')
  const [order, setOrder] = useState<Order | null>(null)
  const [pending, setPending] = useState<Order[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
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
    setPickerOpen(false)
    setDays(7) // default to the first plan (7 days)
    setAsset('') // no method preselected — user picks one, then prices appear
    getPlans()
      .then((r) => {
        setPlans(r.plans)
        setAssets(r.assets)
        setGramUsd(r.gram_usd || 0)
        setStarsByDays(r.stars_by_days || {})
      })
      .catch(() => toast(t('pay.failed')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Always refresh the unfinished-payments list whenever we land on the select
  // step — covers EVERY path back here (‹ back from QR, an order expiring, the
  // initial open). Relying on the back handler alone missed cases (e.g. expiry),
  // which is why a freshly-created order sometimes didn't show until re-opening.
  useEffect(() => {
    if (open && step === 'select') loadPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step])

  const resume = (o: Order) => {
    setOrder(o)
    setStep('pay')
  }
  const cancel = async (o: Order) => {
    if (!(await confirmDialog(t('pay.cancelConfirm')))) return
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
  const isStars = asset === 'STARS'
  // TON-network assets can pay via TON Connect (native GRAM or USD₮ jetton);
  // USDT-TRC20 is TRON, so it stays manual-only.
  const isTonNet = asset === 'TON' || asset === 'USDT_TON'
  const priceNum = (p: Plan) => (isGram ? (gramUsd > 0 ? p.usd / gramUsd : 0) : p.usd)
  const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))
  // Stars: the integer Star count for the plan; otherwise the per-asset amount.
  const priceStr = (p: Plan) =>
    isStars ? `${starsByDays[p.days] ?? '—'} ⭐` : `${fmtNum(priceNum(p))} ${label}`
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

  // GRAM (native TON): create/reuse the order, hand its exact unique amount +
  // address to the connected wallet. The actual wallet call lives in the lazily
  // loaded WalletPay component; here we just own the order state.
  const makeWalletOrder = async () => {
    const o = order ?? (await createOrder(days, asset))
    setOrder(o)
    return o
  }

  // Poll the profile until paid_until advances past a captured baseline — confirms
  // the backend actually credited the Stars payment (the openInvoice callback is
  // a UI-only signal and must NOT be trusted for fulfillment). ~14s budget.
  const pollPaidUntilChanged = async (baseline: string | null) => {
    for (let i = 0; i < 9; i++) {
      await new Promise((r) => setTimeout(r, 1600))
      try {
        const p = await getProfile()
        if ((p.paid_until ?? null) !== baseline) return true
      } catch {
        /* keep polling */
      }
    }
    return false
  }

  // Telegram Stars: backend mints an invoice link bound to the authed user; the
  // Mini App opens it. Fulfillment is server-side (bot → credit), so on 'paid' we
  // POLL the profile to confirm the credit before showing success.
  const payStars = async () => {
    setBusy(true)
    let baseline: string | null = null
    try {
      baseline = (await getProfile().catch(() => null))?.paid_until ?? null
      const { url } = await createStarsInvoice(days)
      openInvoice(url, async (status) => {
        try {
          if (status === 'paid' || status === 'pending') {
            const credited = await pollPaidUntilChanged(baseline)
            if (credited) {
              notify('success')
              onPaid()
              setStep('done')
            } else {
              // Charged but not yet reflected — it'll land shortly; refresh + close.
              toast(t('pay.starsProcessing'))
              onPaid()
              onClose()
            }
          } else if (status === 'failed') {
            toast(t('pay.failed'))
          }
          // 'cancelled' → stay on the confirm step
        } finally {
          setBusy(false)
        }
      })
    } catch {
      toast(t('pay.failed'))
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
          ? () => setStep('select') // the step→select effect refreshes the pending list
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
                      className="shrink-0 px-2 py-1.5 text-[13px] font-medium text-danger active:opacity-70"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-2 px-1 text-[12px] font-medium uppercase tracking-[0.06em] text-faint">
            {t('pay.method')}
          </div>
          {/* Method dropdown — the list unfolds from the row itself (anchored
              overlay), not a separate block that pushes content down. */}
          <div className="relative mb-5">
            {/* Backdrop: tap outside closes the dropdown. */}
            {pickerOpen && (
              <button
                type="button"
                aria-label={t('common.close')}
                onClick={() => setPickerOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
            )}
            <button
              onClick={() => setPickerOpen((v) => !v)}
              className={
                'relative z-20 flex w-full items-center gap-3 border bg-surface px-4 py-3.5 text-left transition-colors active:bg-surface-sunken ' +
                (pickerOpen ? 'rounded-t-2xl border-accent' : 'rounded-2xl border-border')
              }
            >
              {asset ? (
                <CurrencyIcon asset={asset} size={28} />
              ) : (
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-sunken text-faint">
                  <Wallet size={16} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                {asset ? (
                  <>
                    <div className="text-[15px] font-medium text-ink">{cur?.label}</div>
                    <div className="text-[12px] text-faint">{cur?.network}</div>
                  </>
                ) : (
                  <div className="text-[15px] font-medium text-muted">{t('pay.choose')}</div>
                )}
              </div>
              <ChevronDown
                size={20}
                className={'shrink-0 text-faint transition-transform ' + (pickerOpen ? 'rotate-180' : '')}
              />
            </button>
            {pickerOpen && (
              <div className="absolute inset-x-0 top-full z-20 overflow-hidden rounded-b-2xl border border-t-0 border-accent bg-surface shadow-xl shadow-black/15">
                {assets.map((a, i) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setAsset(a.id)
                      setPickerOpen(false)
                    }}
                    className={
                      'flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-sunken ' +
                      (asset === a.id ? 'bg-surface-sunken ' : '') +
                      (i === assets.length - 1 ? '' : 'border-b border-border')
                    }
                  >
                    <CurrencyIcon asset={a.id} size={24} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium text-ink">{a.label}</div>
                      <div className="text-[11px] text-faint">{a.network}</div>
                    </div>
                    {asset === a.id && <Check size={18} className="shrink-0 text-accent" />}
                  </button>
                ))}
              </div>
            )}
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
                {/* Price depends on the chosen currency — shown only after a method is picked. */}
                {asset && <span className="text-[15px] text-ink">{priceStr(p)}</span>}
              </button>
            ))}
          </div>

          {/* Pay actions appear inline once a method is picked — no separate
              confirm screen. The highlighted plan row shows the amount; the
              immediate-start / 14-day-withdrawal waiver is covered by the Terms
              (accepted at sign-in), so no per-payment checkbox. */}
          {asset && (
            <div className="flex flex-col">
              {isGram && (
                <p className="mb-2 px-1 text-[12px] leading-snug text-faint">{t('pay.approxHint')}</p>
              )}
              {isStars ? (
                <Button onClick={payStars} loading={busy} stretched>
                  {t('pay.payStars', { n: starsByDays[days] ?? '' })}
                </Button>
              ) : isTonNet ? (
                <>
                  {/* TON-network (GRAM native / USD₮ jetton): pay via the connected
                      wallet. Lazy — the SDK loads only when a method is picked. */}
                  <Suspense
                    fallback={
                      <Button loading stretched>
                        {t('pay.payWallet')}
                      </Button>
                    }
                  >
                    <WalletPay
                      asset={asset}
                      makeOrder={makeWalletOrder}
                      onConfirmed={() => setStep('pay')}
                      onCancel={() => toast(t('pay.walletCancelled'))}
                    />
                  </Suspense>
                  <Button onClick={startPay} loading={busy} variant="secondary" stretched className="mt-3">
                    <QrCode size={18} /> {t('pay.payManual')}
                  </Button>
                </>
              ) : (
                <Button onClick={startPay} loading={busy} stretched>
                  {t('pay.toPayment')}
                </Button>
              )}
            </div>
          )}
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
          <p className="mt-1 text-[14px] text-muted">
            {renewing ? t('pay.doneRenewed') : t('pay.doneActivated')}
          </p>
          <Button onClick={onClose} stretched className="mt-6">
            {t('common.close')}
          </Button>
        </div>
      )}
    </Sheet>
  )
}
