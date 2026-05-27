import React, { useEffect, useState } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { Spinner } from '../components/ui/Spinner'
import { AreaChart } from '../components/Chart'
import { Globe, Clock, Cloud } from '../components/icons'
import { getServerStats, type ServerStats } from '../api'
import { bytesRate } from '../lib/format'
import { useT } from '../lib/i18n'

export function ServerStatsSheet({
  open,
  onClose,
  configId,
}: {
  open: boolean
  onClose: () => void
  configId: string | null
}) {
  const { t, lang } = useT()
  const [stats, setStats] = useState<ServerStats | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open || !configId) return
    setStats(null)
    setError(false)
    getServerStats(configId)
      .then(setStats)
      .catch(() => setError(true))
  }, [open, configId])

  return (
    <Sheet open={open} onClose={onClose} title={t('stats.title')}>
      {error ? (
        <div className="py-16 text-center text-[15px] text-muted">{t('stats.unavailable')}</div>
      ) : !stats ? (
        <div className="grid place-items-center py-20 text-accent">
          <Spinner size={28} />
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            <span className="text-[16px] font-medium text-success">{t('stats.online')}</span>
          </div>

          <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-surface">
            <InfoRow icon={<Globe size={20} />} text={stats.hostname} />
            <InfoRow icon={<Clock size={20} />} text={t('stats.uptime', { n: stats.uptime_days })} />
            <InfoRow icon={<Cloud size={20} />} text={stats.cpu_model} last />
          </div>

          <ChartCard title={t('stats.cpu')}>
            <AreaChart
              timestamps={stats.timestamps}
              series={[{ values: stats.cpu, color: 'rgb(var(--c-chart-cpu))' }]}
              format={(v) => v.toFixed(1) + '%'}
              axisFormat={(v) => Math.round(v) + '%'}
              yMax={100}
            />
          </ChartCard>

          <ChartCard title={t('stats.ram')}>
            <AreaChart
              timestamps={stats.timestamps}
              series={[{ values: stats.ram, color: 'rgb(var(--c-chart-ram))' }]}
              format={(v) => v.toFixed(1) + '%'}
              axisFormat={(v) => Math.round(v) + '%'}
              yMax={100}
            />
          </ChartCard>

          <ChartCard title={t('stats.net')}>
            <AreaChart
              timestamps={stats.timestamps}
              series={[
                { values: stats.net_out, color: 'rgb(var(--c-chart-net))', tag: '↑' },
                { values: stats.net_in, color: 'rgb(var(--c-chart-ram))', tag: '↓' },
              ]}
              format={(v) => bytesRate(v, lang)}
            />
          </ChartCard>

          <p className="px-1 pb-2 text-center text-[12px] leading-snug text-faint">
            {t('stats.footer')}
          </p>
        </>
      )}
    </Sheet>
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
      <div className="rounded-2xl border border-border bg-surface p-3">
        {children}
      </div>
    </div>
  )
}
