import React from 'react'

type Tone = 'info' | 'warn'

/** Soft callout used for hints like the location / torrent notice. */
export function Note({
  children,
  tone = 'info',
  icon,
}: {
  children: React.ReactNode
  tone?: Tone
  icon?: React.ReactNode
}) {
  const ring =
    tone === 'warn'
      ? 'border-accent/30 bg-accent-soft/60'
      : 'border-border bg-surface-sunken'
  return (
    <div className={'flex gap-3 rounded-2xl border p-3.5 ' + ring}>
      {icon && <div className="shrink-0 text-accent">{icon}</div>}
      <div className="text-[13.5px] leading-snug text-muted">{children}</div>
    </div>
  )
}
