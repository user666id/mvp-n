import { Suspense, useEffect, useState } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { Section } from '../components/ui/Card'
import { LoadError } from '../components/ui/LoadError'
import { SheetHero } from '../components/ui/SheetHero'
import { ChartLine } from '../components/icons'
import { BarChart } from '../components/charts'
import { useT } from '../lib/i18n'
import { formatBytes } from '../lib/format'
import { getProfileTraffic, type TrafficDay } from '../api'

/** TOTAL / TODAY stat, matching the admin panel's traffic card. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 px-4 py-3.5">
      <div className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-faint">{label}</div>
      <div key={value} className="animate-rise mt-1 font-display text-[19px] font-semibold leading-tight text-ink">{value}</div>
    </div>
  )
}

/** The user's own traffic — lifetime total, today, and a 30-day chart. The
 *  per-user analogue of the admin TrafficSheet (GET /profile/traffic). */
export function UsageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useT()
  const [days, setDays] = useState<TrafficDay[] | null>(null)
  const [total, setTotal] = useState(0)
  const [failed, setFailed] = useState(false)

  const load = () => {
    setFailed(false)
    setDays(null)
    getProfileTraffic(30)
      .then((r) => {
        setDays(r.days)
        setTotal(r.total)
      })
      .catch(() => setFailed(true))
  }

  // Pull-to-refresh: re-fetch without blanking the chart to a skeleton.
  const refresh = () =>
    getProfileTraffic(30)
      .then((r) => {
        setDays(r.days)
        setTotal(r.total)
      })
      .catch(() => {})

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const today = days && days.length ? days[days.length - 1].bytes : 0

  // Start the chart at the first day with traffic — don't pad the start with
  // empty days from before tracking began.
  const chart = (() => {
    if (!days) return []
    const first = days.findIndex((d) => d.bytes > 0)
    return first >= 0 ? days.slice(first) : days
  })()

  return (
    <Sheet open={open} onClose={onClose} onBack={onClose} title={t('settings.usage')} onRefresh={refresh}>
      <SheetHero icon={<ChartLine size={30} />} title={t('settings.usage')} />
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
            <div className="skeleton h-[168px] w-full rounded-2xl" />
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
