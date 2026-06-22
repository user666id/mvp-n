import React, { useState } from 'react'
import { ChevronDown } from '../icons'

/** Collapsible block used for "Дополнительные настройки". */
export function Collapse({
  title,
  defaultOpen = false,
  children,
  footer,
}: {
  title: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
  /** Rendered BELOW the card (outside its border) only while expanded — e.g. a hint. */
  footer?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-[54px] w-full items-center justify-between px-4 py-2.5 text-left active:bg-surface-sunken"
        >
          <span className="text-[16px] font-medium text-ink">{title}</span>
          <ChevronDown
            size={20}
            className={'text-muted transition-transform ' + (open ? 'rotate-180' : '')}
          />
        </button>
        {open && <div className="border-t border-border">{children}</div>}
      </div>
      {open && footer}
    </>
  )
}
