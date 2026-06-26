import React, { useState } from 'react'
import { ChevronDown } from '../icons'

/** Collapsible block used for "Additional settings". */
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
      <div className="overflow-hidden rounded-3xl border border-border bg-surface">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-[54px] w-full items-center justify-between px-4 py-2.5 text-left active:bg-surface-sunken"
        >
          <span className="text-[16px] font-medium text-ink">{title}</span>
          <ChevronDown
            size={20}
            className={'text-muted transition-transform duration-200 ' + (open ? 'rotate-180' : '')}
          />
        </button>
        <div className={'grid transition-[grid-template-rows] duration-300 ease-out ' + (open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
          <div className="overflow-hidden">
            <div className="border-t border-border">{children}</div>
          </div>
        </div>
      </div>
      {open && footer}
    </>
  )
}
