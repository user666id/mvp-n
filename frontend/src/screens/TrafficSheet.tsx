import { Suspense, useEffect, useState } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { Section } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { LoadError } from '../components/ui/LoadError'
import { BarChart } from '../components/charts'
import { useT } from '../lib/i18n'
import { formatBytes } from '../lib/format'
import { adminGetTraffic, type TrafficDay } from '../api'

/** TOTAL / TODAY stat, matching the admin panel's traffic card. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 px-4 py-3.5">
      <div className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-faint">{label}</div>
      <div key={value} className="animate-rise mt-1 font-display text-[19px] font-semibold leading-tight text-ink">{value}</div>
    </div>
  )
}

export function TrafficSheet({
  open,
  onClose,
  total,
  today,
}: {
  open: boolean
  onClose: () => void
  total: number
  today: number
}) {
  const { t, lang } = useT()
  const [days, setDays] = useState<TrafficDay[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = () => {
    setFailed(false)
    setDays(null)
    adminGetTraffic(30)
      .then((r) => setDays(r.days))
      .catch(() => setFailed(true))
  }

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Start the chart at the first day with traffic — don't pad the start with
  // empty days from before tracking began ("count from the start, not from zero").
  const chart = (() => {
    if (!days) return []
    const first = days.findIndex((d) => d.bytes > 0)
    return first >= 0 ? days.slice(first) : days
  })()

  return (
    <Sheet open={open} onClose={onClose} onBack={onClose} title={t('admin.traffic')}>
      {/* top card — same as the admin panel: TOTAL / TODAY */}
      <Section>
        <div className="flex">
          <Stat label={t('admin.trafficTotalShort')} value={formatBytes(total, lang)} />
          <div className="w-px self-stretch bg-border" />
          <Stat label={t('admin.trafficTodayShort')} value={formatBytes(today, lang)} />
        </div>
      </Section>

      <Section header={t('traffic.byDay')}>
        <div className="px-3 py-4">
          {failed ? (
            <LoadError onRetry={load} />
          ) : !days ? (
            <div className="grid place-items-center py-10 text-accent">
              <Spinner size={26} />
            </div>
          ) : chart.length ? (
            <Suspense fallback={<div className="skeleton h-[168px] w-full rounded-2xl" />}>
              <BarChart
                data={chart.map((d) => ({ day: d.day, value: d.bytes }))}
                format={(v) => formatBytes(v, lang)}
              />
            </Suspense>
          ) : (
            <div className="py-8 text-center text-[14px] text-muted">{t('traffic.empty')}</div>
          )}
        </div>
      </Section>
    </Sheet>
  )
}
