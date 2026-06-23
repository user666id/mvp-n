import React from 'react'

/** A grouped section: optional header + footer hint around a card. */
export function Section({
  header,
  footer,
  children,
  className = '',
}: {
  header?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={'mb-5 ' + className}>
      {header && (
        <div className="px-3 pb-2 text-[13px] font-semibold text-faint">{header}</div>
      )}
      <div className="overflow-hidden rounded-3xl border border-border bg-surface">
        {children}
      </div>
      {footer && <div className="px-3 pt-2 text-[13px] leading-snug text-muted">{footer}</div>}
    </div>
  )
}

/** Standalone padded card (no list semantics). */
export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={
        'rounded-3xl border border-border bg-surface p-4 ' + className
      }
    >
      {children}
    </div>
  )
}
