import React from 'react'

/** A grouped section: optional uppercase header + footer hint around a card. */
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
        <div className="px-3 pb-2 text-[12px] font-semibold uppercase tracking-[0.07em] text-faint">
          {header}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
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
        'rounded-2xl border border-border bg-surface p-4 ' + className
      }
    >
      {children}
    </div>
  )
}
