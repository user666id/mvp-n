import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from '../icons'

const ROW_H = 44 // px per option row

/** A compact select shown as a row: current value + chevron. Tapping reveals an
 *  overlay list on frosted glass. The list is rendered in a PORTAL (document.body)
 *  so it is NEVER clipped by a parent `overflow-hidden` Section — the bug where the
 *  language menu only half-opened. Opens downward, flipping up when there isn't
 *  room below (or when `align="up"`). Closes on outside tap or any scroll. */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  align = 'down',
}: {
  value: T
  options: { value: T; label: string; icon?: ReactNode }[]
  onChange: (v: T) => void
  align?: 'down' | 'up'
}) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const place = () => {
      if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
    }
    place()
    // Tap outside closes; any scroll closes (a fixed menu can't follow the content).
    const onDown = (e: PointerEvent) => {
      const n = e.target as Node
      if (triggerRef.current?.contains(n) || menuRef.current?.contains(n)) return
      setOpen(false)
    }
    const onScroll = () => setOpen(false)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    document.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  const current = options.find((o) => o.value === value)
  const menuH = options.length * ROW_H + 8
  // Respect `align`, but flip up when the menu wouldn't fit below the trigger.
  const openUp = rect ? align === 'up' || rect.bottom + 6 + menuH > window.innerHeight : align === 'up'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="tap flex h-11 w-full items-center justify-between rounded-3xl border border-border bg-surface px-4 text-left active:bg-surface-sunken"
      >
        <span className="flex items-center gap-2.5 text-[15px] font-medium text-ink">
          {current?.icon}
          {current?.label}
        </span>
        <ChevronDown size={18} className={'text-muted transition-transform ' + (open ? 'rotate-180' : '')} />
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            ref={menuRef}
            className="glass-thin animate-scale-in fixed z-[70] overflow-hidden rounded-3xl"
            style={{
              left: rect.left,
              width: rect.width,
              transformOrigin: openUp ? 'bottom center' : 'top center',
              ...(openUp ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
            }}
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className={
                  'flex h-11 w-full items-center justify-between px-4 text-left text-[15px] ' +
                  (o.value === value
                    ? 'bg-surface-sunken font-medium text-ink'
                    : 'text-muted active:bg-surface-sunken')
                }
              >
                <span className="flex items-center gap-2.5">
                  {o.icon}
                  {o.label}
                </span>
                {o.value === value && <Check size={16} className="text-accent" />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
