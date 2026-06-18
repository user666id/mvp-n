import React from 'react'
import { selection } from '../../lib/telegram'

interface Props {
  selected: boolean
  onSelect: () => void
  title: React.ReactNode
  subtitle?: React.ReactNode
  badge?: React.ReactNode
  disabled?: boolean
  last?: boolean
}

/** A selectable option row with a leading radio dot (config protocol picker). */
export function RadioRow({ selected, onSelect, title, subtitle, badge, disabled, last }: Props) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      onClick={() => {
        if (disabled) return
        selection()
        onSelect()
      }}
      className={[
        'flex items-start gap-3 px-4 py-3.5 transition-colors',
        last ? '' : 'border-b border-border',
        disabled ? 'opacity-45' : 'active:bg-surface-sunken cursor-pointer',
      ].join(' ')}
    >
      <span
        className={[
          'mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 transition-colors',
          selected ? 'border-accent' : 'border-faint',
        ].join(' ')}
      >
        {selected && <span className="h-[11px] w-[11px] rounded-full bg-accent" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-medium text-ink">{title}</span>
          {badge}
        </div>
        {subtitle && <div className="mt-0.5 text-[13px] leading-snug text-muted">{subtitle}</div>}
      </div>
    </div>
  )
}
