import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { haptic, selection } from '../lib/telegram'

// Shared chart primitives so AreaChart (server, live line) and BarChart
// (traffic, daily bars) share one visual + interaction language: same padding,
// axis, tooltip card, drag crosshair, and haptics. The chart TYPE differs by
// data nature; everything around it is unified here.

export const CHART_PAD = { l: 46, r: 10, t: 14, b: 20 }

/** Round up to a clean 1/2/2.5/5/10 ×10ⁿ ceiling for tidy axis headroom. */
export function niceCeil(v: number): number {
  if (!(v > 0)) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  for (const s of [1, 2, 2.5, 5, 10]) if (s * pow >= v) return s * pow
  return 10 * pow
}

export function useChartWidth<T extends HTMLElement>() {
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

/** Light tick when a scrub starts. Routes through haptic(), which no-ops when
 *  the user turned tactile feedback off in Settings — so charts obey that switch. */
export function pressHaptic() {
  haptic('light')
}

/** Fire a selection tick whenever the focused point changes during a scrub —
 *  same gating as buttons (the Settings haptics toggle). */
export function useScrubHaptics(focus: number | null) {
  const prev = useRef<number | null>(null)
  useEffect(() => {
    if (focus == null) {
      prev.current = null
      return
    }
    if (prev.current !== focus) {
      selection()
      prev.current = focus
    }
  }, [focus])
}

export interface TooltipLine {
  text: string
  color: string
}

/** Floating value card, clamped to stay on-screen. Identical across charts. */
export function ChartTooltip({
  x,
  W,
  top,
  lines,
}: {
  x: number
  W: number
  top: string
  lines: TooltipLine[]
}) {
  return (
    <div
      className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-xl border border-border bg-surface px-2.5 py-1.5 text-center shadow-pop"
      style={{ left: Math.min(Math.max(x, 52), W - 52), top: CHART_PAD.t }}
    >
      <div className="text-[11px] text-muted">{top}</div>
      {lines.map((l, i) => (
        <div key={i} className="text-[13px] font-medium" style={{ color: l.color }}>
          {l.text}
        </div>
      ))}
    </div>
  )
}

/** Marker dot(s) at the focused position, with an optional vertical crosshair.
 *  The line reads well over a continuous area chart but bisects a bar (looks
 *  like a seam), so bar charts pass line={false}. */
export function ChartGuide({
  x,
  top,
  height,
  dots,
  line = true,
}: {
  x: number
  top: number
  height: number
  dots: { cy: number; color: string }[]
  line?: boolean
}) {
  return (
    <>
      {line && (
        <line
          x1={x}
          x2={x}
          y1={top}
          y2={top + height}
          stroke="rgb(var(--c-ink))"
          strokeOpacity="0.35"
          strokeWidth="1"
        />
      )}
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={x}
          cy={d.cy}
          r="4"
          fill={d.color}
          stroke="rgb(var(--c-canvas))"
          strokeWidth="2"
        />
      ))}
    </>
  )
}
