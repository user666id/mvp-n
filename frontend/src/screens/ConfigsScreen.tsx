import { useCallback, useEffect, useState } from 'react'
import { useActiveRefresh } from '../lib/useForeground'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { HomeSkeleton } from '../components/ui/Skeleton'
import { LoadError } from '../components/ui/LoadError'
import { Spinner } from '../components/ui/Spinner'
import { Layers, Globe, Phone, ChartLine } from '../components/icons'
import brandMark from '../assets/brand-mark.png'
import { StatusDot } from '../components/StatusDot'
import { useToast } from '../components/ui/Toast'
import { ConfigDetailSheet } from './ConfigDetailSheet'
import { ServerStatsSheet } from './ServerStatsSheet'
import { KeyEntrySheet } from './KeyEntrySheet'
import { DevicesSheet } from './DevicesSheet'
import { UsageSheet } from './UsageSheet'
import {
  deleteConfig,
  getConfigs,
  getProfile,
  getPendingOrders,
  getDevices,
  getProfileTraffic,
  updateSettings,
  type Config,
  type Order,
  type Profile,
} from '../api'
import { notify } from '../lib/telegram'
import { useT } from '../lib/i18n'
import { fmtSubDate } from '../lib/subscription'
import { formatBytes } from '../lib/format'

export function ConfigsScreen({
  active,
  onAccount,
  accountName,
  onGoSubscription,
  revalidate,
}: {
  active: boolean
  onAccount: () => void
  accountName?: string
  onGoSubscription: () => void
  revalidate?: number
}) {
  const { t, lang } = useT()
  const toast = useToast()
  const [configs, setConfigs] = useState<Config[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [statsOpen, setStatsOpen] = useState(false)
  const [keyOpen, setKeyOpen] = useState(false)
  const [pending, setPending] = useState<Order[]>([])
  // Home dashboard widgets (devices + usage). Best-effort: a failed widget fetch
  // shows "—" and never fails the main configs load.
  const [devCount, setDevCount] = useState<number | null>(null)
  const [trafficTotal, setTrafficTotal] = useState<number | null>(null)
  const [devOpen, setDevOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const [cfgs, prof, pend, devs, traffic] = await Promise.all([
        getConfigs(),
        getProfile().catch(() => null),
        getPendingOrders().catch(() => []),
        getDevices().catch(() => null),
        getProfileTraffic().catch(() => null),
      ])
      setConfigs(cfgs)
      if (prof) setProfile(prof)
      setPending(pend)
      if (devs) setDevCount(devs.length)
      if (traffic) setTrafficTotal(traffic.total)
    } catch {
      // First load with nothing yet → show a Retry (handled in render). A failed
      // background refresh keeps the existing list (gated on no data below).
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // Refresh on tab-active, on revalidate (Account sheet closed), and on app
  // foreground — one shared hook so every screen loads/refreshes identically.
  useActiveRefresh(active, revalidate, load)

  // While a payment is pending, poll so access flips on automatically once the
  // on-chain check credits it (cron runs ~every minute) — no manual refresh.
  useEffect(() => {
    if (!active || pending.length === 0) return
    const id = window.setInterval(load, 8000)
    return () => window.clearInterval(id)
  }, [active, pending, load])

  const detail = configs.find((c) => c.id === detailId) ?? null
  const expired = !!profile?.is_expired
  // VPN access is gated behind a key/payment. We only LOCK when we have a profile
  // that says so — a transient profile-fetch failure (null) keeps the normal UI
  // rather than falsely locking out a paid user.
  const hasAccess = profile ? profile.is_active && !expired : true
  const handleToggle = async (key: 'enhanced' | 'game_mode', val: boolean) => {
    if (!detailId) return
    // Picking a mode (Standard/Enhanced) also clears game_mode — the detail Mode
    // switcher only exposes those two, so a config is never left hidden-"gaming".
    const patch = key === 'enhanced' ? { enhanced: val, game_mode: false } : { [key]: val }
    setConfigs((prev) => prev.map((c) => (c.id === detailId ? { ...c, ...patch } : c)))
    try {
      const updated = await updateSettings(detailId, patch)
      setConfigs((prev) => prev.map((c) => (c.id === detailId ? updated : c)))
    } catch {
      toast(t('common.saveFailed'))
      load()
    }
  }

  const handleDelete = async () => {
    if (!detailId) return
    await deleteConfig(detailId)
    setConfigs((prev) => prev.filter((c) => c.id !== detailId))
    notify('success')
    toast(t('configs.deleted'))
  }

  return (
    <div className="animate-fade min-h-screen pb-24">
      <PageHeader title={t('configs.title')} onAccount={onAccount} accountName={accountName} />

      <div className="px-4 pt-4">
        {loading ? (
          <HomeSkeleton />
        ) : failed && !profile && configs.length === 0 ? (
          <LoadError onRetry={load} />
        ) : !hasAccess && pending.length > 0 ? (
          /* ── A payment is in flight: don't tempt the user to pay again. Show a
                "processing" state that resolves automatically (we poll). ── */
          <div className="flex flex-col items-center px-6 pt-[14vh] text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-surface-sunken text-accent">
              <Spinner size={28} />
            </span>
            <h2 className="font-display mt-5 text-[21px] font-semibold leading-tight text-ink">
              {t('pay.pendingTitle')}
            </h2>
            <p className="mb-7 mt-2 max-w-[290px] text-[14px] leading-relaxed text-muted">
              {t('pay.pendingHint')}
            </p>
            <Button stretched variant="secondary" onClick={onGoSubscription}>
              {t('pay.pendingView')}
            </Button>
          </div>
        ) : !hasAccess && !expired ? (
          /* ── Not activated / expired: prominent activate block in place of the
                configs list. Buy a subscription OR enter an access key. ── */
          <div className="flex flex-col items-center px-6 pt-[12vh] text-center">
            <span className="block overflow-hidden rounded-full shadow-pop" style={{ width: 84, height: 84 }}>
              <img src={brandMark} alt="" className="h-full w-full object-cover" />
            </span>
            <h2 className="font-display mt-5 text-[21px] font-semibold leading-tight text-ink">
              {expired ? t('sub.expired') : t('sub.connectTitle')}
            </h2>
            <p className="mb-7 mt-2 max-w-[290px] text-[14px] leading-relaxed text-muted">
              {expired ? t('sub.expiredHint') : t('sub.connectHint')}
            </p>
            <Button stretched onClick={onGoSubscription}>
              {expired ? t('sub.renew') : t('sub.buy')}
            </Button>
            <Button stretched className="mt-3" onClick={() => setKeyOpen(true)}>
              {t('sub.haveKey')}
            </Button>
          </div>
        ) : (
          // One uniform vertical rhythm (16px) between the stacked blocks
          // (subscription strip · config · widgets), matching the Section gap used
          // in every sheet — instead of ad-hoc margins.
          <div className="animate-fade space-y-4">
            {/* Subscription strip — expiry + days left at a glance, with a quick
                renew. Key / lifetime users (no paid_until) see "lifetime". */}
            {profile &&
              (expired ? (
                <div className="flex items-center gap-3 rounded-3xl border border-border bg-surface px-4 py-3">
                  <button onClick={onGoSubscription} className="tap min-w-0 flex-1 text-left active:opacity-70">
                    <div className="text-[14px] font-medium text-danger">{t('sub.expired')}</div>
                    <div className="mt-0.5 text-[12.5px] text-muted">{t('sub.expiredShort')}</div>
                  </button>
                  <Button size="sm" className="shrink-0" onClick={onGoSubscription}>
                    {t('pay.buy')}
                  </Button>
                </div>
              ) : profile.paid_until ? (
                <div className="flex items-center gap-3 rounded-3xl border border-border bg-surface px-4 py-3">
                  <button onClick={onGoSubscription} className="tap min-w-0 flex-1 text-left active:opacity-70">
                    <div className="text-[14px] font-medium text-ink">
                      {t('sub.activeShort', { d: fmtSubDate(profile.paid_until, lang) })}
                    </div>
                    <div className="animate-rise mt-0.5 text-[12.5px] text-muted">
                      {t('sub.daysLeft', {
                        n: Math.max(
                          0,
                          Math.ceil((new Date(profile.paid_until).getTime() - Date.now()) / 86_400_000),
                        ),
                      })}
                    </div>
                  </button>
                  <Button size="sm" className="shrink-0" onClick={onGoSubscription}>
                    {t('sub.extend')}
                  </Button>
                </div>
              ) : (
                <div className="rounded-3xl border border-border bg-surface px-4 py-3 text-[14px] font-medium text-ink">
                  {t('sub.lifetimeBottom')}
                </div>
              ))}
            {configs.length === 0 ? (
              <div className="flex flex-col items-center px-6 pt-[10vh] text-center">
                <Layers size={40} className="text-faint" />
                <p className="mb-6 mt-4 max-w-[260px] text-[15px] leading-relaxed text-muted">
                  {t('configs.empty')}
                </p>
                <Button onClick={onGoSubscription}>{t('sub.buy')}</Button>
              </div>
            ) : (
              <>
            <div className="stagger flex flex-col gap-2.5">
              {configs.map((c) => (
                  <div
                    key={c.id}
                    className="overflow-hidden rounded-3xl border border-border bg-surface"
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-sunken text-faint">
                        <Globe size={22} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-[16px] font-semibold leading-tight text-ink">
                          {t('detail.title')}
                        </div>
                        <div className="mt-0.5">
                          <span className={'inline-flex items-center gap-2 text-[15px] font-medium ' + (c.server_online ? 'text-success' : 'text-danger')}>
                            <StatusDot ok={c.server_online} className="h-2 w-2" />
                            {c.server_online ? t('server.online') : t('server.offline')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="px-4 pb-4">
                      <Button stretched onClick={() => setDetailId(c.id)}>
                        {t('configs.configure')}
                      </Button>
                    </div>
                  </div>
                ),
              )}
            </div>
              </>
            )}
            {/* Dashboard widgets — devices + usage at a glance (iOS-widget style),
                BELOW the config card so the primary action stays on top. Each taps
                through to its full screen; matching framed icons + center scale-in. */}
            <div className="animate-scale-in grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setDevOpen(true)}
                className="tap rounded-3xl border border-border bg-surface p-4 text-left active:bg-surface-sunken"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-sunken text-faint">
                    <Phone size={15} />
                  </span>
                  <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">{t('home.devices')}</span>
                </div>
                <div className="mt-2.5 font-display text-[22px] font-semibold leading-none text-ink">
                  {devCount == null ? '—' : profile?.device_limit ? `${devCount} / ${profile.device_limit}` : devCount}
                </div>
                <div className="mt-1 text-[12.5px] text-muted">{t('home.devicesSub')}</div>
              </button>
              <button
                onClick={() => setUsageOpen(true)}
                className="tap rounded-3xl border border-border bg-surface p-4 text-left active:bg-surface-sunken"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-sunken text-faint">
                    <ChartLine size={15} />
                  </span>
                  <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">{t('home.usage')}</span>
                </div>
                <div className="mt-2.5 font-display text-[22px] font-semibold leading-none text-ink">
                  {trafficTotal == null ? '—' : formatBytes(trafficTotal, lang)}
                </div>
                <div className="mt-1 text-[12.5px] text-muted">{t('home.usageSub')}</div>
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfigDetailSheet
        config={detail}
        open={!!detail}
        onClose={() => setDetailId(null)}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onOpenStats={() => setStatsOpen(true)}
      />
      <ServerStatsSheet
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        configId={detailId}
      />
      <KeyEntrySheet open={keyOpen} onClose={() => setKeyOpen(false)} onActivated={load} />
      <DevicesSheet open={devOpen} onClose={() => setDevOpen(false)} onChanged={load} />
      <UsageSheet open={usageOpen} onClose={() => setUsageOpen(false)} />
    </div>
  )
}
