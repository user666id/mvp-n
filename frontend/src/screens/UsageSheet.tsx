import { Suspense, useEffect, useState } from 'react'
import { useForegroundRefetch } from '../lib/useForeground'
import { Sheet } from '../components/ui/Sheet'
import { Section } from '../components/ui/Card'
import { LoadError } from '../components/ui/LoadError'
import { SheetHero } from '../components/ui/SheetHero'
import { ChartLine } from '../components/icons'
import { BarChart } from '../components/charts'
import { useT } from '../lib/i18n'
import { formatBytes } from '../lib/format'
import { getProfileTraffic, type TrafficDay } from '../api'

/** TOTAL / TODAY stat, matching the admin panel's traffic card. A null value =
 *  still loading → show a skeleton bar instead of a misleading "0 B" that flashes. */
function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex-1 px-4 py-3.5">
      <div className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-faint">{label}</div>
      {value === null ? (
        <div className="skeleton mt-1.5 h-[20px] w-20 rounded" />
      ) : (
        <div key={value} className="animate-rise mt-1 font-display text-[19px] font-semibold leading-tight text-ink">{value}</div>
      )}
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

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Re-fetch on foreground — a fetch suspended in the background can hang, leaving
  // a permanent skeleton; resuming reloads it (same recovery the other screens have).
  useForegroundRefetch(open, load)

  const today = days && days.length ? days[days.length - 1].bytes : 0

  // Start the chart at the first day with traffic — don't pad the start with
  // empty days from before tracking began.
  const chart = (() => {
    if (!days) return []
    const first = days.findIndex((d) => d.bytes > 0)
    return first >= 0 ? days.slice(first) : days
  })()

  return (
    <Sheet open={open} onClose={onClose} onBack={onClose} title={t('settings.usage')}>
      <SheetHero icon={<ChartLine size={30} />} title={t('settings.usage')} />
      <Section>
        <div className="flex">
          <Stat label={t('admin.trafficTotalShort')} value={days ? formatBytes(total, lang) : null} />
          <div className="w-px self-stretch bg-border" />
          <Stat label={t('admin.trafficTodayShort')} value={days ? formatBytes(today, lang) : null} />
        </div>
      </Section>

      <Section header={t('traffic.byDay')}>
        <div className="px-3 py-4">
          {failed ? (
            <LoadError onRetry={load} />
          ) : !days ? (
            <div className="skeleton h-[168px] w-full rounded-2xl" />
          ) : chart.length ? (
            <div className="animate-fade">
              <Suspense fallback={<div className="skeleton h-[168px] w-full rounded-2xl" />}>
                <BarChart
                  data={chart.map((d) => ({ day: d.day, value: d.bytes }))}
                  format={(v) => formatBytes(v, lang)}
                />
              </Suspense>
            </div>
          ) : (
            <div className="py-8 text-center text-[14px] text-muted">{t('traffic.empty')}</div>
          )}
        </div>
      </Section>
    </Sheet>
  )
}
