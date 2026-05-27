import { useLayoutEffect, useRef, useState } from 'react'
import { useT } from '../lib/i18n'

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
  /** Fix the y-axis top (e.g. 100 for a percentage chart). Defaults to auto
   *  (data max ×1.15), which can make a stable low value look alarmingly high. */
  yMax?: number
}

const PAD = { l: 34, r: 10, t: 12, b: 20 }

/** Round a value up to a clean 1/2/2.5/5/10 ×10ⁿ ceiling, so an auto-scaled
 *  axis gets headroom (data never touches the top) and tidy tick labels. */
function niceCeil(v: number): number {
  if (!(v > 0)) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  for (const s of [1, 2, 2.5, 5, 10]) {
    if (s * pow >= v) return s * pow
  }
  return 10 * pow
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(320)
  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

const hm = (iso: string, lang: string) =>
  new Date(iso).toLocaleTimeString(lang === 'ru' ? 'ru' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })

/**
 * Lightweight area chart with a smooth, interpolated drag tooltip:
 * the guide line follows the finger continuously and the value is linearly
 * interpolated between samples (no snapping), matching the reference UX.
 */
export function AreaChart({ timestamps, series, height = 160, format, axisFormat, yMax: yMaxProp }: Props) {
  const fmtTick = axisFormat ?? format
  const { t, lang } = useT()
  const [ref, W] = useWidth<HTMLDivElement>()
  const H = height
  const n = timestamps.length
  const [active, setActive] = useState<number | null>(null) // fractional index
  const downRef = useRef(false) // pointer is currently pressed/scrubbing

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

  const onMove = (clientX: number, rectLeft: number) => {
    const x = clientX - rectLeft
    const frac = ((x - PAD.l) / innerW) * (n - 1)
    setActive(Math.max(0, Math.min(n - 1, frac)))
  }

  // y-axis ticks: 0, mid, max
  const ticks = [0, yMax / 2, yMax]

  const nearest = active == null ? null : Math.round(active)

  return (
    <div ref={ref} className="relative w-full" style={{ height: H }}>
      <svg
        width={W}
        height={H}
        className="touch-pan-y select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          downRef.current = true
          onMove(e.clientX, e.currentTarget.getBoundingClientRect().left)
        }}
        onPointerMove={(e) => {
          // Mouse: follow on hover (smooth). Touch: only while pressed.
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
          // Keep tooltip for mouse hover; clear once the touch lifts.
          if (e.pointerType !== 'mouse') setActive(null)
        }}
        onPointerCancel={() => {
          downRef.current = false
          setActive(null)
        }}
        // Don't drop the tooltip while actively scrubbing — only when an
        // un-pressed (hovering) pointer truly leaves the chart.
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
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke="rgb(var(--c-border))"
              strokeWidth="1"
            />
            <text
              x={PAD.l - 6}
              y={yAt(t) + 3}
              textAnchor="end"
              fontSize="10"
              fill="rgb(var(--c-faint))"
            >
              {fmtTick(t)}
            </text>
          </g>
        ))}

        {series.map((s, i) => (
          <g key={i}>
            <path d={areaFor(s.values)} fill={`url(#grad${i})`} />
            <path d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth="2" />
          </g>
        ))}

        {/* drag guide */}
        {active != null && (
          <>
            <line
              x1={xAt(active)}
              x2={xAt(active)}
              y1={PAD.t}
              y2={PAD.t + innerH}
              stroke="rgb(var(--c-ink))"
              strokeOpacity="0.35"
              strokeWidth="1"
            />
            {series.map((s, i) => (
              <circle
                key={i}
                cx={xAt(active)}
                cy={yAt(valueAt(s.values, active))}
                r="4"
                fill={s.color}
                stroke="rgb(var(--c-canvas))"
                strokeWidth="2"
              />
            ))}
          </>
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
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-xl border border-border bg-surface px-2.5 py-1.5 text-center shadow-pop"
          style={{
            left: Math.min(Math.max(xAt(active), 52), W - 52),
            top: PAD.t,
          }}
        >
          <div className="text-[11px] text-muted">{t('chart.at')} {hm(timestamps[nearest], lang)}</div>
          {series.map((s, i) => (
            <div key={i} className="text-[13px] font-medium" style={{ color: s.color }}>
              {s.tag ? s.tag + ' ' : ''}
              {format(valueAt(s.values, active))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
