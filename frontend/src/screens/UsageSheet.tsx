import { Suspense } from 'react'
import { useCachedResource } from '../lib/useForeground'
import { Sheet } from '../components/ui/Sheet'
import { EmptyState } from '../components/ui/EmptyState'
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
  // Shared cache: the home Usage widget and this sheet read the SAME 'profileTraffic'
  // key, so they always agree; the last data is kept and revalidated in the background.
  const { data, error, retry } = useCachedResource<{ days: TrafficDay[]; total: number }>(
    'profileTraffic',
    () => getProfileTraffic(30),
    { active: open },
  )
  const days = data?.days ?? null
  const total = data?.total ?? 0

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
          {error ? (
            <LoadError onRetry={retry} />
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
            <EmptyState>{t('traffic.empty')}</EmptyState>
          )}
        </div>
      </Section>
    </Sheet>
  )
}
