import { useEffect, useRef } from 'react'
import { selection } from '../../lib/telegram'

const ITEM_H = 40 // px — one row
const VISIBLE = 3 // rows shown (odd → one centred) — compact
const PAD = ITEM_H * ((VISIBLE - 1) / 2) // spacer so first/last can centre

/**
 * Compact iOS-style scrolling wheel. Values are LEFT-aligned (lined up with the
 * row above it), sit in a slim selection band, and the centred value auto-commits
 * once the scroll settles. Haptic tick per value. Pure CSS scroll-snap.
 */
export function WheelPicker({
  value,
  options,
  onChange,
  format,
}: {
  value: number
  options: number[]
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const settle = useRef<number | undefined>(undefined)
  const lastIdx = useRef(-1)

  useEffect(() => {
    const i = Math.max(0, options.indexOf(value))
    if (ref.current) ref.current.scrollTop = i * ITEM_H
    lastIdx.current = i
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onScroll = () => {
    if (!ref.current) return
    const i = Math.min(options.length - 1, Math.max(0, Math.round(ref.current.scrollTop / ITEM_H)))
    if (i !== lastIdx.current) {
      lastIdx.current = i
      selection()
    }
    window.clearTimeout(settle.current)
    settle.current = window.setTimeout(() => onChange(options[i]), 140)
  }

  return (
    <div className="relative select-none" style={{ height: ITEM_H * VISIBLE }}>
      {/* slim selection band */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-xl bg-surface-sunken/55"
        style={{ height: ITEM_H }}
      />
      <div ref={ref} onScroll={onScroll} className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll">
        <div style={{ height: PAD }} />
        {options.map((o) => (
          <div
            key={o}
            className="flex snap-center items-center whitespace-nowrap pl-1 text-[17px] font-semibold tabular-nums text-ink"
            style={{ height: ITEM_H }}
          >
            {format ? format(o) : o}
          </div>
        ))}
        <div style={{ height: PAD }} />
      </div>
    </div>
  )
}
