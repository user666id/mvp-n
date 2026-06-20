import { useRef, useState } from 'react'
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

export interface Series {
  values: number[]
  /** css color (e.g. 'rgb(var(--c-chart-cpu))') */
  color: string
  /** label shown in tooltip, e.g. '↑' for upload */
  tag?: string
}

interface Props {
  timestamps: string[]
  series: Series[]
  height?: number
  /** formats a value for the tooltip, e.g. (v) => v.toFixed(1) + '%' */
  format: (v: number) => string
  /** formats a y-axis tick; defaults to `format`. Use to drop units on the axis. */
  axisFormat?: (v: number) => string
  /** Fix the y-axis top (e.g. 100 for a percentage chart). Defaults to auto. */
  yMax?: number
}

const hm = (iso: string, lang: string) =>
  new Date(iso).toLocaleTimeString(lang === 'ru' ? 'ru' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })

/**
 * Live area chart with a smooth interpolated drag tooltip: the guide line
 * follows the finger continuously and the value is interpolated between
 * samples. Used for "here and now" server metrics (CPU / RAM / network) — it
 * shares the axis, tooltip, crosshair and haptics with the bar chart but stays
 * a thin line by nature of the data.
 */
export function AreaChart({ timestamps, series, height = 160, format, axisFormat, yMax: yMaxProp }: Props) {
  const fmtTick = axisFormat ?? format
  const { t, lang } = useT()
  const [ref, W] = useChartWidth<HTMLDivElement>()
  const H = height
  const n = timestamps.length
  const [active, setActive] = useState<number | null>(null) // fractional index
  const downRef = useRef(false)

  const innerW = Math.max(1, W - PAD.l - PAD.r)
  const innerH = H - PAD.t - PAD.b
  const yMax = yMaxProp ?? niceCeil(Math.max(1, ...series.flatMap((s) => s.values)) * 1.1)

  const xAt = (i: number) => PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * innerW)
  const yAt = (v: number) => PAD.t + innerH - (v / yMax) * innerH

  const valueAt = (vals: number[], idx: number) => {
    const lo = Math.floor(idx)
    const hi = Math.min(n - 1, lo + 1)
    const f = idx - lo
    return vals[lo] * (1 - f) + vals[hi] * f
  }

  const pathFor = (vals: number[]) => {
    let d = ''
    vals.forEach((v, i) => (d += (i ? 'L' : 'M') + xAt(i) + ' ' + yAt(v)))
    return d
  }
  const areaFor = (vals: number[]) =>
    pathFor(vals) + `L${xAt(n - 1)} ${PAD.t + innerH}L${xAt(0)} ${PAD.t + innerH}Z`
  // One fill = the per-x max across series (envelope). Multiple same-colour series
  // (e.g. network ↑/↓) then share a single translucent fill instead of stacking
  // into a darker green than the single-series charts (CPU / RAM).
  const envelopeVals = timestamps.map((_, i) => Math.max(0, ...series.map((s) => s.values[i] ?? 0)))

  const onMove = (clientX: number, rectLeft: number) => {
    const x = clientX - rectLeft
    const frac = ((x - PAD.l) / innerW) * (n - 1)
    setActive(Math.max(0, Math.min(n - 1, frac)))
  }

  const ticks = [0, yMax / 2, yMax]
  const nearest = active == null ? null : Math.round(active)
  useScrubHaptics(nearest)

  return (
    <div ref={ref} className="relative w-full" style={{ height: H }}>
      <svg
        width={W}
        height={H}
        className="touch-pan-y select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          downRef.current = true
          pressHaptic()
          onMove(e.clientX, e.currentTarget.getBoundingClientRect().left)
        }}
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse' && !downRef.current) return
          onMove(e.clientX, e.currentTarget.getBoundingClientRect().left)
        }}
        onPointerUp={(e) => {
          downRef.current = false
          try {
            e.currentTarget.releasePointerCapture(e.pointerId)
          } catch {
            /* ignore */
          }
          if (e.pointerType !== 'mouse') setActive(null)
        }}
        onPointerCancel={() => {
          downRef.current = false
          setActive(null)
        }}
        onPointerLeave={() => {
          if (!downRef.current) setActive(null)
        }}
      >
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

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
              {fmtTick(tk)}
            </text>
          </g>
        ))}

        <path d={areaFor(envelopeVals)} fill="url(#grad0)" />
        {series.map((s, i) => (
          <path key={i} d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth="2" />
        ))}

        {/* drag crosshair + dots (one per series) */}
        {active != null && (
          <ChartGuide
            x={xAt(active)}
            top={PAD.t}
            height={innerH}
            dots={series.map((s) => ({ cy: yAt(valueAt(s.values, active)), color: s.color }))}
          />
        )}

        {/* x labels (first / mid / last) */}
        {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
          <text
            key={i}
            x={xAt(i)}
            y={H - 5}
            textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            fontSize="10"
            fill="rgb(var(--c-faint))"
          >
            {hm(timestamps[i], lang)}
          </text>
        ))}
      </svg>

      {active != null && nearest != null && (
        <ChartTooltip
          x={xAt(active)}
          W={W}
          top={`${t('chart.at')} ${hm(timestamps[nearest], lang)}`}
          lines={series.map((s) => ({
            text: (s.tag ? s.tag + ' ' : '') + format(valueAt(s.values, active)),
            color: s.color,
          }))}
        />
      )}
    </div>
  )
}
