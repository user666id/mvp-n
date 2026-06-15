import { useCallback, useEffect, useState } from 'react'
import { useForegroundRefetch } from '../lib/useForeground'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ListSkeleton } from '../components/ui/Skeleton'
import { Spinner } from '../components/ui/Spinner'
import { ChevronRight, Layers, Lock, Plus } from '../components/icons'
import { useToast } from '../components/ui/Toast'
import { CreateConfigSheet } from './CreateConfigSheet'
import { ConfigDetailSheet } from './ConfigDetailSheet'
import { ServerStatsSheet } from './ServerStatsSheet'
import { SubscribeSheet } from './SubscribeSheet'
import { KeyEntrySheet } from './KeyEntrySheet'
import {
  createConfig,
  deleteConfig,
  getConfigs,
  getProfile,
  getPendingOrders,
  renameConfig,
  updateSettings,
  type Config,
  type Order,
  type Profile,
  type Protocol,
} from '../api'
import { notify } from '../lib/telegram'
import { useT } from '../lib/i18n'
import { plural } from '../lib/format'
import { configMeta, configListLabel } from '../lib/configMeta'

export function ConfigsScreen({ active, onMenu }: { active: boolean; onMenu: () => void }) {
  const { t, lang } = useT()
  const toast = useToast()
  const [configs, setConfigs] = useState<Config[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [statsOpen, setStatsOpen] = useState(false)
  const [subOpen, setSubOpen] = useState(false)
  const [keyOpen, setKeyOpen] = useState(false)
  const [pending, setPending] = useState<Order[]>([])

  const load = useCallback(async () => {
    try {
      const [cfgs, prof, pend] = await Promise.all([
        getConfigs(),
        getProfile().catch(() => null),
        getPendingOrders().catch(() => []),
      ])
      setConfigs(cfgs)
      if (prof) setProfile(prof)
      setPending(pend)
    } catch {
      toast(t('configs.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [toast, t])

  // Refresh whenever this tab becomes active. The screen stays mounted across
  // tab switches (App toggles visibility), so this is a background refresh that
  // keeps the existing list on screen — no blank skeleton on every switch.
  useEffect(() => {
    if (active) load()
  }, [active, load])

  // Re-load when the app returns to the foreground (suspended WebView / stale data).
  useForegroundRefetch(active, load)

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
  const handleCreate = async (opts: {
    protocol: Protocol
    enhanced: boolean
    game_mode: boolean
  }) => {
    setCreating(true)
    try {
      const c = await createConfig(opts)
      setConfigs((prev) => [c, ...prev])
      setCreateOpen(false)
      notify('success')
      toast(t('configs.created'))
    } catch {
      notify('error')
      toast(t('configs.createFailed'))
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (key: 'enhanced' | 'game_mode', val: boolean) => {
    if (!detailId) return
    setConfigs((prev) => prev.map((c) => (c.id === detailId ? { ...c, [key]: val } : c)))
    try {
      const updated = await updateSettings(detailId, { [key]: val })
      setConfigs((prev) => prev.map((c) => (c.id === detailId ? updated : c)))
    } catch {
      toast(t('common.saveFailed'))
      load()
    }
  }

  const handleRename = async (name: string) => {
    if (!detailId) return
    await renameConfig(detailId, name)
    setConfigs((prev) => prev.map((c) => (c.id === detailId ? { ...c, name } : c)))
  }

  const handleDelete = async () => {
    if (!detailId) return
    await deleteConfig(detailId)
    setConfigs((prev) => prev.filter((c) => c.id !== detailId))
    notify('success')
    toast(t('configs.deleted'))
  }

  return (
    <div className="min-h-screen pb-24">
      <PageHeader title={t('configs.title')} onMenu={onMenu} />

      <div className="px-4">
        {loading ? (
          <ListSkeleton rows={2} />
        ) : !hasAccess && pending.length > 0 ? (
          /* ── A payment is in flight: don't tempt the user to pay again. Show a
                "processing" state that resolves automatically (we poll). ── */
          <div className="flex flex-col items-center px-6 pt-[14vh] text-center">
            <span className="grid h-16 w-16 place-items-center rounded-3xl bg-surface-sunken text-accent">
              <Spinner size={28} />
            </span>
            <h2 className="font-display mt-5 text-[21px] font-semibold leading-tight text-ink">
              {t('pay.pendingTitle')}
            </h2>
            <p className="mb-7 mt-2 max-w-[290px] text-[14px] leading-relaxed text-muted">
              {t('pay.pendingHint')}
            </p>
            <Button stretched variant="secondary" onClick={() => setSubOpen(true)}>
              {t('pay.pendingView')}
            </Button>
          </div>
        ) : !hasAccess ? (
          /* ── Not activated / expired: prominent activate block in place of the
                configs list. Buy a subscription OR enter an access key. ── */
          <div className="flex flex-col items-center px-6 pt-[13vh] text-center">
            <span className="grid h-16 w-16 place-items-center rounded-3xl bg-accent-soft text-accent">
              <Lock size={30} />
            </span>
            <h2 className="font-display mt-5 text-[21px] font-semibold leading-tight text-ink">
              {expired ? t('sub.expired') : t('sub.connectTitle')}
            </h2>
            <p className="mb-7 mt-2 max-w-[290px] text-[14px] leading-relaxed text-muted">
              {expired ? t('sub.expiredHint') : t('sub.connectHint')}
            </p>
            <Button stretched onClick={() => setSubOpen(true)}>
              {expired ? t('sub.renew') : t('sub.buy')}
            </Button>
            <button
              onClick={() => setKeyOpen(true)}
              className="mt-4 text-[14px] font-medium text-accent active:opacity-70"
            >
              {t('sub.haveKey')}
            </button>
          </div>
        ) : (
          <>
            {/* Subscription status lives in Settings → Subscription now — the
                Configs screen stays clean (just the configs list + create). */}
            {configs.length === 0 ? (
              <div className="flex flex-col items-center px-6 pt-[10vh] text-center">
                <Layers size={40} className="text-faint" />
                <p className="mb-6 mt-4 max-w-[260px] text-[15px] leading-relaxed text-muted">
                  {t('configs.empty')}
                </p>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus size={20} /> {t('configs.create')}
                </Button>
              </div>
            ) : (
              <>
            <div className="flex flex-col gap-2.5">
              {configs.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setDetailId(c.id)}
                  className="flex items-center gap-3.5 rounded-2xl border border-border bg-surface px-4 py-4 text-left active:bg-surface-sunken"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface-sunken text-[24px]">
                    🇳🇱
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[18px] font-semibold leading-tight text-ink">
                      {c.name || t('configs.country')}
                    </div>
                    <div className="mt-0.5 text-[12px] text-faint">
                      {configListLabel(configMeta(c, t))}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
                      <span
                        className={
                          'inline-flex items-center gap-1.5 ' +
                          (c.server_online ? 'text-success' : 'text-danger')
                        }
                      >
                        <span
                          className={
                            'h-1.5 w-1.5 rounded-full ' +
                            (c.server_online ? 'bg-success' : 'bg-danger')
                          }
                        />
                        {c.server_online ? t('server.online') : t('server.offline')}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-faint" />
                </button>
              ))}
            </div>
                <div className="py-4 text-center text-[13px] text-faint">
                  {t('configs.count', { n: configs.length, u: configCountUnit(configs.length, lang) })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Floating pill action (Claude "New project" pattern) */}
      {hasAccess && configs.length > 0 && (
        <button
          onClick={() => setCreateOpen(true)}
          aria-label={t('configs.create')}
          className="fixed right-4 z-30 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-5 text-white shadow-btn active:bg-accent-hover bottom-[max(20px,env(safe-area-inset-bottom))]"
        >
          <Plus size={20} />
          <span className="text-[15px] font-medium">{t('configs.create')}</span>
        </button>
      )}

      <CreateConfigSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
        busy={creating}
      />
      <ConfigDetailSheet
        config={detail}
        open={!!detail}
        onClose={() => setDetailId(null)}
        onToggle={handleToggle}
        onRename={handleRename}
        onDelete={handleDelete}
        onOpenStats={() => setStatsOpen(true)}
      />
      <ServerStatsSheet
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        configId={detailId}
      />
      <SubscribeSheet open={subOpen} onClose={() => setSubOpen(false)} onPaid={load} />
      <KeyEntrySheet open={keyOpen} onClose={() => setKeyOpen(false)} onActivated={load} />
    </div>
  )
}

function configCountUnit(n: number, lang: 'en' | 'ru') {
  if (lang === 'ru') return plural(n, 'конфиг', 'конфига', 'конфигов')
  return n === 1 ? 'config' : 'configs'
}
