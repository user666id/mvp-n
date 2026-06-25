import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, Check } from '../icons'

/** A compact select shown as a row: current value + chevron, tapping reveals an
 *  overlay list (the same pattern as the connect-flow OS picker). `align="up"`
 *  opens the menu above the trigger — use it for dropdowns near the bottom of an
 *  `overflow-hidden` Section so the list isn't clipped. */
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
  const ref = useRef<HTMLDivElement>(null)

  // Close on tap outside.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [open])

  const current = options.find((o) => o.value === value)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between rounded-3xl border border-border bg-surface px-4 text-left active:bg-surface-sunken"
      >
        <span className="flex items-center gap-2.5 text-[15px] font-medium text-ink">
          {current?.icon}
          {current?.label}
        </span>
        <ChevronDown size={18} className={'text-muted transition-transform ' + (open ? 'rotate-180' : '')} />
      </button>
      {open && (
        <div
          className={
            'absolute left-0 right-0 z-30 overflow-hidden rounded-3xl border border-white/10 bg-surface/85 shadow-sheet backdrop-blur-xl backdrop-saturate-150 ' +
            (align === 'up' ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]')
          }
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
        </div>
      )}
    </div>
  )
}
