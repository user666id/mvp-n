import React, { Suspense, useCallback, useEffect, useState } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { Spinner } from '../components/ui/Spinner'
import { LoadError } from '../components/ui/LoadError'
import { AreaChart } from '../components/charts'
import { Globe, Clock, Monitor } from '../components/icons'
import { StatusDot } from '../components/StatusDot'
import { getServerStats, type ServerStats } from '../api'
import { bytesRate } from '../lib/format'
import { useT } from '../lib/i18n'

// AreaChart is lazy (split out of the main bundle); show a chart-sized skeleton
// while its chunk loads on first open.
function LazyArea(props: React.ComponentProps<typeof AreaChart>) {
  return (
    <Suspense fallback={<div className="skeleton h-[160px] w-full rounded-2xl" />}>
      <AreaChart {...props} />
    </Suspense>
  )
}

export function ServerStatsSheet({
  open,
  onClose,
  configId,
}: {
  open: boolean
  onClose: () => void
  configId: string | null
}) {
  const { t } = useT()
  const [stats, setStats] = useState<ServerStats | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    if (!configId) return
    setStats(null)
    setError(false)
    getServerStats(configId)
      .then(setStats)
      .catch(() => setError(true))
  }, [configId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  return (
    <Sheet open={open} onClose={onClose} title={t('stats.title')}>
      {error ? (
        <LoadError onRetry={load} />
      ) : !stats ? (
        <div className="grid place-items-center py-20 text-accent">
          <Spinner size={28} />
        </div>
      ) : (
        <div className="animate-fade">
          <StatsBody stats={stats} />
        </div>
      )}
    </Sheet>
  )
}

function StatsBody({ stats }: { stats: ServerStats }) {
  const { t, lang } = useT()
  // All charts share one colour — the app's green "positive data" hue.
  const green = 'rgb(var(--c-success))'

  return (
    <>
      <div className="mb-3 flex items-center gap-2.5 rounded-3xl border border-border bg-surface px-4 py-3.5">
        <StatusDot ok={stats.online} className="h-2.5 w-2.5" />
        <span className={'text-[16px] font-medium ' + (stats.online ? 'text-success' : 'text-danger')}>
          {stats.online ? t('stats.online') : t('stats.offline')}
        </span>
      </div>

      <div className="mb-5 overflow-hidden rounded-3xl border border-border bg-surface">
        <InfoRow icon={<Globe size={20} />} text={t('stats.location')} />
        {stats.server_ip && <InfoRow icon={<Monitor size={20} />} text={stats.server_ip} />}
        <InfoRow icon={<Clock size={20} />} text={t('stats.uptime', { n: stats.uptime_days })} last />
      </div>

      <ChartCard title={t('stats.cpu')}>
        <LazyArea
          timestamps={stats.timestamps}
          series={[{ values: stats.cpu, color: green }]}
          format={(v) => v.toFixed(1) + '%'}
          axisFormat={(v) => Math.round(v) + '%'}
          yMax={100}
        />
      </ChartCard>

      <ChartCard title={t('stats.ram')}>
        <LazyArea
          timestamps={stats.timestamps}
          series={[{ values: stats.ram, color: green }]}
          format={(v) => v.toFixed(1) + '%'}
          axisFormat={(v) => Math.round(v) + '%'}
          yMax={100}
        />
      </ChartCard>

      <ChartCard title={t('stats.net')}>
        <LazyArea
          timestamps={stats.timestamps}
          series={[
            { values: stats.net_out, color: green, tag: '↑' },
            { values: stats.net_in, color: green, tag: '↓' },
          ]}
          format={(v) => bytesRate(v, lang)}
        />
      </ChartCard>

      <p className="px-1 pb-2 text-center text-[12px] leading-snug text-faint">
        {t('stats.footer')}
      </p>
    </>
  )
}

function InfoRow({
  icon,
  text,
  last,
}: {
  icon: React.ReactNode
  text: string
  last?: boolean
}) {
  return (
    <div
      className={'flex items-center gap-3 px-4 py-3.5 ' + (last ? '' : 'border-b border-border')}
    >
      <span className="shrink-0 text-faint">{icon}</span>
      <span className="text-[14.5px] leading-snug text-ink">{text}</span>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-2 px-1 text-[12px] font-medium uppercase tracking-[0.06em] text-faint">
        {title}
      </div>
      <div className="rounded-3xl border border-border bg-surface p-4">{children}</div>
    </div>
  )
}
