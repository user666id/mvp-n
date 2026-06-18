import { useState } from 'react'
import { useT } from '../lib/i18n'
import {
  CHART_PAD as PAD,
  ChartGuide,
  ChartTooltip,
  niceCeil,
  pressHaptic,
  useChartWidth,
  useScrubHaptics,
} from './chartkit'

export interface Bar {
  /** YYYY-MM-DD */
  day: string
  value: number
}

interface Props {
  data: Bar[]
  height?: number
  /** value → tooltip/axis label, e.g. formatBytes */
  format: (v: number) => string
}

/** Parse a YYYY-MM-DD as a LOCAL date (avoids the UTC-midnight off-by-one). */
function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/**
 * Daily bar chart (wide "square candles"). The last bar is "today", filled with
 * the soft accent tint (theme-aware) to read as still-accumulating. Drag/scrub
 * shows a crosshair + dot with the day's date and exact value, with haptics.
 */
export function BarChart({ data, height = 168, format }: Props) {
  const { lang } = useT()
  const [ref, W] = useChartWidth<HTMLDivElement>()
  const H = height
  const n = data.length
  const [active, setActive] = useState<number | null>(null)
  useScrubHaptics(active)

  const innerW = Math.max(1, W - PAD.l - PAD.r)
  const innerH = H - PAD.t - PAD.b
  const yMax = niceCeil(Math.max(1, ...data.map((d) => d.value)) * 1.1)

  // Left-anchored "timeline that fills from the left": cap the slot width so a
  // few days cluster at the left edge (with room to grow rightward) instead of
  // stretching across the whole width — a lone bar would otherwise float dead
  // centre. Once enough days accumulate the cap stops biting and bars fill the
  // plot edge-to-edge.
  const MAX_SLOT = 64
  const slot = Math.min(innerW / Math.max(1, n), MAX_SLOT)
  // Balanced rectangular bars: roughly half the slot (≈equal bar/gap), capped so
  // a handful of days don't render as fat blocks.
  const barW = Math.max(8, Math.min(44, slot * 0.56))
  const xCenter = (i: number) => PAD.l + slot * (i + 0.5)
  const yAt = (v: number) => PAD.t + innerH - (v / yMax) * innerH

  const fmtDay = (s: string) =>
    parseDay(s).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'short',
    })

  const pickFromX = (clientX: number, rectLeft: number) => {
    const x = clientX - rectLeft - PAD.l
    setActive(Math.max(0, Math.min(n - 1, Math.floor(x / slot))))
  }

  const ticks = [0, yMax / 2, yMax]
  const labelIdx = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1]

  return (
    <div ref={ref} className="relative w-full" style={{ height: H }}>
      <svg
        width={W}
        height={H}
        className="touch-pan-y select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          pressHaptic()
          pickFromX(e.clientX, e.currentTarget.getBoundingClientRect().left)
        }}
        onPointerMove={(e) => {
          if (e.buttons === 0 && e.pointerType !== 'mouse') return
          if (e.pointerType === 'mouse' && e.buttons === 0) return
          pickFromX(e.clientX, e.currentTarget.getBoundingClientRect().left)
        }}
        onPointerUp={(e) => {
          try {
            e.currentTarget.releasePointerCapture(e.pointerId)
          } catch {
            /* ignore */
          }
          if (e.pointerType !== 'mouse') setActive(null)
        }}
        onPointerCancel={() => setActive(null)}
        onPointerLeave={(e) => {
          if (e.buttons === 0) setActive(null)
        }}
      >
        {/* y grid + labels */}
        {ticks.map((tk, i) => (
          <g key={i}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={yAt(tk)}
              y2={yAt(tk)}
              stroke="rgb(var(--c-border))"
              strokeWidth="1"
            />
            <text x={PAD.l - 6} y={yAt(tk) + 3} textAnchor="end" fontSize="10" fill="rgb(var(--c-faint))">
              {format(tk)}
            </text>
          </g>
        ))}

        {/* bars */}
        {data.map((d, i) => {
          const isToday = i === n - 1
          const isActive = active === i
          const h = Math.max(0, innerH - (yAt(d.value) - PAD.t))
          // Amber-yellow bars. "Today" (when not being scrubbed) is paler — it's
          // still accumulating.
          return (
            <rect
              key={d.day}
              x={xCenter(i) - barW / 2}
              y={d.value > 0 ? yAt(d.value) : PAD.t + innerH - 1}
              width={barW}
              height={d.value > 0 ? h : 1}
              rx={Math.min(5, barW / 2)}
              fill="rgb(var(--c-chart-ram))"
              fillOpacity={isActive ? 1 : isToday ? 0.45 : 0.85}
            />
          )
        })}

        {/* drag marker dot (no vertical line — it would bisect the bar) */}
        {active != null && data[active] && (
          <ChartGuide
            x={xCenter(active)}
            top={PAD.t}
            height={innerH}
            line={false}
            dots={data[active].value > 0 ? [{ cy: yAt(data[active].value), color: 'rgb(var(--c-chart-ram))' }] : []}
          />
        )}

        {/* x labels */}
        {labelIdx.map((i) => (
          <text
            key={i}
            x={xCenter(i)}
            y={H - 5}
            textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            fontSize="10"
            fill="rgb(var(--c-faint))"
          >
            {fmtDay(data[i].day)}
          </text>
        ))}
      </svg>

      {active != null && data[active] && (
        <ChartTooltip
          x={xCenter(active)}
          W={W}
          top={fmtDay(data[active].day)}
          lines={[{ text: format(data[active].value), color: 'rgb(var(--c-chart-ram))' }]}
        />
      )}
    </div>
  )
}
