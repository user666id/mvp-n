import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ListSkeleton } from '../components/ui/Skeleton'
import { ChevronRight, Layers, Plus } from '../components/icons'
import { useToast } from '../components/ui/Toast'
import { CreateConfigSheet } from './CreateConfigSheet'
import { ConfigDetailSheet } from './ConfigDetailSheet'
import { ServerStatsSheet } from './ServerStatsSheet'
import {
  createConfig,
  deleteConfig,
  getConfigs,
  renameConfig,
  updateSettings,
  type Config,
  type Protocol,
} from '../api'
import { notify } from '../lib/telegram'
import { useT } from '../lib/i18n'
import { plural } from '../lib/format'
import { configMeta, configListLabel } from '../lib/configMeta'

export function ConfigsScreen({ onMenu }: { onMenu: () => void }) {
  const { t, lang } = useT()
  const toast = useToast()
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [statsOpen, setStatsOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      setConfigs(await getConfigs())
    } catch {
      toast(t('configs.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [toast, t])

  useEffect(() => {
    load()
  }, [load])

  const detail = configs.find((c) => c.id === detailId) ?? null

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
        ) : configs.length === 0 ? (
          <div className="flex flex-col items-center px-6 pt-[16vh] text-center">
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
      </div>

      {/* Floating pill action (Claude "New project" pattern) */}
      {configs.length > 0 && (
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
    </div>
  )
}

function configCountUnit(n: number, lang: 'en' | 'ru') {
  if (lang === 'ru') return plural(n, 'конфиг', 'конфига', 'конфигов')
  return n === 1 ? 'config' : 'configs'
}
