import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { LoadError } from '../components/ui/LoadError'
import { Qr } from '../components/Qr'
import { CurrencyIcon } from '../components/CurrencyIcon'
import { Check, Copy, Dollar } from '../components/icons'
import { SheetHero } from '../components/ui/SheetHero'
import { useToast } from '../components/ui/Toast'
import { useForegroundRefetch } from '../lib/useForeground'
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
  wasExpired = false,
  inline = false,
}: {
  open: boolean
  onClose: () => void
  onPaid: () => void
  /** true = the user already had a subscription (renew), false = first purchase. */
  renewing?: boolean
  /** True when paying from an EXPIRED subscription — the done view then tells the
   *  user to refresh the subscription in their VPN app to bring the link back. */
  wasExpired?: boolean
  /** Render in-screen (Оплата tab) instead of a modal sheet. The pay/done steps
   *  replace the plan list, with a "back to plans" affordance. */
  inline?: boolean
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
  const [busy, setBusy] = useState(false)
  const [plansFailed, setPlansFailed] = useState(false)
  const [usdtMenuOpen, setUsdtMenuOpen] = useState(false)
  const [usdtNetId, setUsdtNetId] = useState('') // remembered USDT network (persists across method switches)
  const poll = useRef<number | undefined>(undefined)

  const loadPending = () =>
    getPendingOrders()
      .then((list) => setPending(Array.isArray(list) ? list : []))
      .catch(() => {})

  // Load plans + payment methods. On failure we DON'T blank the screen — we flag it
  // so the UI shows a skeleton (first load) or an inline Retry, instead of empty
  // "Plan"/"Method" headers (the "loads every other time" bug). Cached plans from a
  // previous successful load survive a failed refetch.
  const loadPlans = () => {
    setPlansFailed(false)
    return getPlans()
      .then((r) => {
        setPlans(r.plans)
        setAssets(r.assets)
        setGramUsd(r.gram_usd || 0)
        setStarsByDays(r.stars_by_days || {})
      })
      .catch(() => setPlansFailed(true))
  }

  useEffect(() => {
    if (!open) return
    setStep('select')
    setOrder(null)
    setPending([])
    setDays(7) // default to the first plan (7 days)
    setAsset('') // no method preselected — Buy stays disabled until one is picked
    setUsdtMenuOpen(false)
    setUsdtNetId('')
    loadPlans()
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

  // Recover on foreground: Telegram suspends the WebView in the background and an
  // in-flight plans fetch can hang there forever (its abort timer is throttled),
  // leaving the screen stuck on a skeleton. Re-fetch on resume so it self-heals
  // without leaving + re-entering the tab — same recovery every other screen has.
  useForegroundRefetch(open, () => {
    loadPlans()
    if (step === 'select') loadPending()
  })

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
    let fails = 0
    const tick = async () => {
      try {
        const o = await getOrder(order.id)
        fails = 0
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
        // Tolerate transient blips, but don't poll a dead/deleted order forever
        // (e.g. a 404 would otherwise keep the user stuck on the QR screen).
        if (++fails >= 8) {
          window.clearInterval(poll.current)
          toast(t('common.loadError'))
          setStep('select')
        }
      }
    }
    poll.current = window.setInterval(tick, 4000)
    return () => window.clearInterval(poll.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, order])

  const cur = assets.find((a) => a.id === asset)
  const label = cur?.label ?? asset
  const network = cur?.network ?? 'TON'
  // "Продлить" when an active sub is being extended, else "Купить" (none / expired).
  const buyLabel = renewing ? t('pay.renewDirect') : t('pay.payDirect')
  const isStars = asset === 'STARS'
  const isUsdt = asset.startsWith('USDT_')
  // TON-network assets can pay via TON Connect (native GRAM or USD₮ jetton);
  // USDT-TRC20 is TRON, so it stays manual-only.
  const isTonNet = asset === 'TON' || asset === 'USDT_TON'
  // The method starts unpicked (asset === '') so the Buy button is disabled until
  // chosen — but prices still render from the start, defaulting to GRAM. The card
  // amount currency follows `displayAsset`, which switches once a method is set.
  const displayAsset = asset || 'TON'
  const dIsGram = displayAsset === 'TON'
  const dIsStars = displayAsset === 'STARS'
  // Prices are pegged to USD. USDT is 1:1; GRAM is converted at the live rate
  // (approximate here — the exact amount is locked when the order is created).
  const priceNum = (p: Plan) => (dIsGram ? (gramUsd > 0 ? p.usd / gramUsd : 0) : p.usd)
  const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))
  // Amount shown next to the coin icon (Stars = integer count, else per-asset).
  const priceMain = (p: Plan) => (dIsStars ? String(starsByDays[p.days] ?? '—') : fmtNum(priceNum(p)))
  // Longer plans are cheaper per day — show the saving vs the priciest (shortest) plan.
  const perDay = (p: Plan) => (p.days > 0 ? p.usd / p.days : 0)
  const basePerDay = plans.length ? Math.max(...plans.map(perDay)) : 0
  const discountPct = (p: Plan) => (basePerDay > 0 ? Math.round((1 - perDay(p) / basePerDay) * 100) : 0)
  const dayName = (d: number) =>
    ({ 7: t('pay.d7'), 30: t('pay.d30'), 90: t('pay.d90'), 365: t('pay.d365') } as Record<number, string>)[d] ||
    String(d)

  // Payment-method chips (Fragment layout: icon left, 3 across): GRAM, a single
  // grouped USDT (its network — TON / TRC20 — is chosen just below), and Stars.
  const usdts = assets.filter((a) => a.id.startsWith('USDT_'))
  // Remember the chosen USDT network so it persists when switching methods away
  // and back — the chip keeps showing e.g. "USDT TON", not a bare "USDT".
  const usdtNetLabel = usdtNetId ? assets.find((a) => a.id === usdtNetId)?.network ?? '' : ''
  type Chip = { key: string; label: string; iconId: string; net: string; group?: boolean; targetId?: string }
  const gramAsset = assets.find((a) => a.id === 'TON')
  const starsAsset = assets.find((a) => a.id === 'STARS')
  const methodChips: Chip[] = []
  if (gramAsset) methodChips.push({ key: 'TON', label: gramAsset.label, iconId: 'TON', net: gramAsset.network, targetId: 'TON' })
  if (usdts.length) methodChips.push({ key: 'USDT', label: 'USDT', iconId: 'USDT', net: usdtNetLabel, group: true })
  if (starsAsset) methodChips.push({ key: 'STARS', label: starsAsset.label, iconId: 'STARS', net: '', targetId: 'STARS' })
  const selectMethod = (m: Chip) => {
    if (m.group) {
      const id = usdtNetId || usdts.find((u) => u.network === 'TON')?.id || usdts[0]?.id || ''
      setUsdtNetId(id)
      setAsset(id)
    } else if (m.targetId) {
      setAsset(m.targetId)
    }
  }
  const chipCls = (on: boolean) =>
    'flex w-full items-center gap-2 rounded-3xl border bg-surface px-3 py-3 text-left transition-[transform,background-color,border-color] duration-150 active:scale-[0.98] ' +
    (on ? 'border-accent' : 'border-border active:bg-surface-sunken')

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

  // Inline mode (in the Оплата tab) resets to the plan list instead of closing.
  const finish = inline ? () => setStep('select') : onClose

  // Pay (QR + exact amount) and done views — shown in a BottomSheet window over
  // the plan list when inline (the Оплата tab), or inline in the Sheet otherwise.
  const payDoneView = (
    <>
      {step === 'pay' && order && (
        <div className="flex flex-col items-center text-center">
          <p className="mb-3 max-w-[300px] text-[14px] leading-relaxed text-muted">
            {t('pay.sendExactly')} <span className="font-semibold text-ink">{order.amount} {label}</span>{' '}
            ({t('pay.network')} {network})
          </p>
          <Qr value={qrValue} size={196} />

          <button
            onClick={() => copy(order.amount)}
            className="mt-4 flex w-full items-center justify-between rounded-3xl border border-border bg-surface px-4 py-3 text-left"
          >
            <span className="text-[12px] text-faint">{t('pay.amount')}</span>
            <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              {order.amount} {label} <Copy size={16} className="text-faint" />
            </span>
          </button>
          <button
            onClick={() => copy(order.address)}
            className="mt-2 flex w-full items-center gap-2 rounded-3xl border border-border bg-surface px-4 py-3 text-left"
          >
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink">{order.address}</span>
            <Copy size={16} className="shrink-0 text-faint" />
          </button>

          <div className="mt-5 flex items-center gap-2 text-[13px] text-muted">
            <Spinner size={16} /> {t('pay.waiting')}
          </div>
          <p className="mt-2 px-2 text-[12px] leading-snug text-faint">{t('pay.exactHint')}</p>
          <p className="mt-3 rounded-2xl bg-surface-sunken px-3 py-2.5 text-[12px] leading-snug text-muted">
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
            {renewing || wasExpired ? t('pay.doneRenewed') : t('pay.doneActivated')}
          </p>
          {wasExpired && (
            <p className="mt-2 max-w-[280px] text-[13px] leading-snug text-success">{t('pay.refreshLauncher')}</p>
          )}
          <Button onClick={finish} stretched className="mt-6">
            {t('common.close')}
          </Button>
        </div>
      )}
    </>
  )

  const content = (
    <>
      {(inline || step === 'select') && (
        <>
          <SheetHero icon={<Dollar size={30} />} title={t('tab.subscription')} />
          {pending.length > 0 && (
            <div className="mb-5">
              <div className="mb-2 px-1 text-[13px] font-semibold text-faint">
                {t('pay.resumeTitle')}
              </div>
              <div className="overflow-hidden rounded-3xl border border-border bg-surface">
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
                    <Button size="sm" className="shrink-0" onClick={() => resume(o)}>
                      {t('pay.resumeBtn')}
                    </Button>
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

          {/* No plans yet: first-load failure → inline Retry, otherwise a skeleton.
              Never show empty "Plan"/"Method" headers (the "loads every other time"
              bug). Once loaded, a failed background refetch keeps the cached plans. */}
          {plans.length === 0 ? (
            plansFailed ? (
              <div className="mt-6">
                <LoadError onRetry={loadPlans} />
              </div>
            ) : (
              <div className="animate-fade">
                <div className="mb-2 px-1 text-[13px] font-semibold text-faint">{t('pay.plan')}</div>
                <div className="mb-5 flex flex-col gap-2">
                  <div className="skeleton h-[62px] rounded-3xl" />
                  <div className="skeleton h-[62px] rounded-3xl" />
                  <div className="skeleton h-[62px] rounded-3xl" />
                </div>
                <div className="mb-2 px-1 text-[13px] font-semibold text-faint">{t('pay.method')}</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="skeleton h-[58px] rounded-3xl" />
                  <div className="skeleton h-[58px] rounded-3xl" />
                  <div className="skeleton h-[58px] rounded-3xl" />
                </div>
              </div>
            )
          ) : (
          <>
          {/* Plan first (Fragment order: packages, then payment method, then Buy).
              Each card: radio + name + orange saving badge, and on the right the
              amount (coin icon + value) with the USD price in grey beside it. */}
          <div className="mb-2 px-1 text-[13px] font-semibold text-faint">{t('pay.plan')}</div>
          <div className="mb-5 flex flex-col gap-2">
            {plans.map((p) => {
              const selected = days === p.days
              const disc = discountPct(p)
              return (
                <button
                  key={p.days}
                  onClick={() => setDays(p.days)}
                  className={
                    'flex items-center gap-3 rounded-3xl border bg-surface px-4 py-3.5 text-left transition-[transform,background-color,border-color] duration-150 active:scale-[0.99] ' +
                    (selected ? 'border-accent' : 'border-border active:bg-surface-sunken')
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
                  <span className="text-[15px] font-medium text-ink">{dayName(p.days)}</span>
                  {disc > 0 && (
                    <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
                      −{disc}%
                    </span>
                  )}
                  {/* price row: coin icon + amount, then USD in grey. tabular-nums
                      + fixed-width columns keep amounts and USD aligned across
                      cards (same treatment for GRAM, USDT and Stars). */}
                  <span className="ml-auto flex items-center gap-2.5 tabular-nums">
                    <span className="flex items-center gap-1.5 text-[15px] font-medium text-ink">
                      <CurrencyIcon asset={displayAsset} size={16} />
                      {priceMain(p)}
                    </span>
                    <span className="w-12 text-right text-[13px] text-faint">${fmtNum(p.usd)}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* Payment method — a horizontal row of chips (icon left). USDT groups
              both networks under one chip; the network is chosen just below. */}
          <div className="mb-2 px-1 text-[13px] font-semibold text-faint">{t('pay.method')}</div>
          <div className="mb-5">
            <div className="grid grid-cols-3 gap-2">
              {methodChips.map((m) => {
                const active = m.group ? isUsdt : asset === m.targetId
                if (m.group) {
                  // USDT groups its networks under one chip; tapping it opens a
                  // dropdown below the chip, over the Buy button (Fragment style).
                  return (
                    <div key={m.key} className="relative">
                      <button
                        onClick={() => {
                          selectMethod(m)
                          setUsdtMenuOpen((o) => !o)
                        }}
                        className={chipCls(active)}
                      >
                        <CurrencyIcon asset={m.iconId} size={22} />
                        <span className="flex min-w-0 items-baseline gap-1">
                          <span className="truncate text-[14px] font-medium leading-tight text-ink">{m.label}</span>
                          {m.net && <span className="text-[11px] leading-tight text-muted">{m.net}</span>}
                        </span>
                      </button>
                      {usdtMenuOpen && usdts.length > 1 && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setUsdtMenuOpen(false)} />
                          <div className="glass-thin absolute left-1/2 top-[calc(100%+8px)] z-40 flex w-[210px] -translate-x-1/2 flex-col gap-0.5 rounded-3xl p-1.5">
                            {usdts.map((u) => (
                              <button
                                key={u.id}
                                onClick={() => {
                                  setAsset(u.id)
                                  setUsdtNetId(u.id)
                                  setUsdtMenuOpen(false)
                                }}
                                className={
                                  // Inset oval pill — doesn't touch the menu walls.
                                  'flex h-11 w-full items-center gap-2.5 rounded-full px-3 text-left text-[15px] transition-colors ' +
                                  (asset === u.id
                                    ? 'bg-surface-sunken font-medium text-ink'
                                    : 'text-muted active:bg-surface-sunken')
                                }
                              >
                                <CurrencyIcon asset={u.id} size={22} />
                                <span className="flex items-baseline gap-1.5">
                                  <span className="font-medium">USDT</span>
                                  <span className="text-[12px] uppercase tracking-wide text-muted">{u.network}</span>
                                </span>
                                {asset === u.id && <Check size={16} className="ml-auto text-accent" />}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )
                }
                return (
                  <button
                    key={m.key}
                    onClick={() => {
                      setUsdtMenuOpen(false)
                      selectMethod(m)
                    }}
                    className={chipCls(active)}
                  >
                    <CurrencyIcon asset={m.iconId} size={22} />
                    <span className="flex min-w-0 items-baseline gap-1">
                      <span className="truncate text-[14px] font-medium leading-tight text-ink">{m.label}</span>
                      {m.net && <span className="text-[11px] leading-tight text-muted">{m.net}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          </>
          )}

          {/* Buy — single primary CTA (a manual fallback stays for the TON wallet
              flow). The immediate-start / 14-day-withdrawal waiver is covered by
              the Terms accepted at sign-in, so no per-payment checkbox. */}
          {plans.length > 0 && (
            <div className="flex flex-col">
              {!asset ? (
                // No method picked yet → dim, disabled Buy (lights up on select).
                <Button disabled stretched>
                  {buyLabel}
                </Button>
              ) : isStars ? (
                <Button onClick={payStars} loading={busy} stretched>
                  {buyLabel}
                </Button>
              ) : isTonNet ? (
                <>
                  {/* TON Connect wallet is the primary action here (connect → pay):
                      solid clay, white label. Lazy: the SDK loads only when a
                      TON-net method is picked. Label is dynamic: "Connect wallet"
                      until linked, "Pay in wallet" once connected. */}
                  <Suspense
                    fallback={
                      <Button variant="primary" loading stretched>
                        {t('pay.connectWallet')}
                      </Button>
                    }
                  >
                    <WalletPay
                      asset={asset}
                      variant="primary"
                      renewing={renewing}
                      makeOrder={makeWalletOrder}
                      onConfirmed={() => setStep('pay')}
                      onCancel={() => toast(t('pay.walletCancelled'))}
                    />
                  </Suspense>
                  {/* Manual payment (QR + exact amount) — de-emphasized ghost link. */}
                  <Button variant="ghost" onClick={startPay} loading={busy} stretched className="mt-1">
                    {buyLabel}
                  </Button>
                </>
              ) : (
                <Button onClick={startPay} loading={busy} stretched>
                  {buyLabel}
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {!inline && payDoneView}
    </>
  )

  if (inline)
    return (
      <div className="animate-fade">
        {content}
        <BottomSheet open={step !== 'select'} onClose={() => setStep('select')} title={t('pay.title')}>
          {payDoneView}
        </BottomSheet>
      </div>
    )
  return (
    <Sheet
      open={open}
      onClose={onClose}
      onBack={step !== 'select' ? () => setStep('select') : undefined}
      title={t('pay.title')}
    >
      {content}
    </Sheet>
  )
}
