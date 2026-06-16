import type { ReactNode } from 'react'

interface Option<T> {
  value: T
  label: ReactNode
}

/** Claude-style segmented switch (like "Anthropic Sans / System"). */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  block,
  className = '',
}: {
  value: T
  onChange: (v: T) => void
  options: Option<T>[]
  /** stretch to full width with equal-width segments */
  block?: boolean
  className?: string
}) {
  return (
    <div
      className={
        'rounded-full bg-surface-sunken p-0.5 ' +
        (block ? 'flex w-full ' : 'inline-flex ') +
        className
      }
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            onClick={() => {
              if (!active) onChange(o.value)
            }}
            className={
              'rounded-full border-2 py-1 text-[13px] font-medium transition-colors ' +
              (block ? 'flex-1 px-2 ' : 'px-3.5 ') +
              (active
                ? 'border-accent bg-surface text-ink'
                : 'border-transparent text-muted active:text-ink')
            }
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
