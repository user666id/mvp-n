import React from 'react'

interface Props {
  before?: React.ReactNode
  after?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  onClick?: () => void
  /** removes the divider under the row (last item) */
  last?: boolean
  destructive?: boolean
  className?: string
}

/** A list row inside a Section/card. Tappable when onClick is set. */
export function Cell({
  before,
  after,
  title,
  subtitle,
  onClick,
  last,
  destructive,
  className = '',
}: Props) {
  const interactive = !!onClick
  return (
    <div
      role={interactive ? 'button' : undefined}
      onClick={interactive ? onClick : undefined}
      className={[
        'relative flex items-center gap-3 px-4 min-h-[54px] py-2.5',
        interactive ? 'active:bg-surface-sunken transition-colors cursor-pointer' : '',
        className,
      ].join(' ')}
    >
      {/* inset divider: starts after the leading icon (Claude style) */}
      {!last && (
        <span
          className={
            'pointer-events-none absolute bottom-0 right-0 h-px bg-border ' +
            (before ? 'left-[48px]' : 'left-4')
          }
        />
      )}
      {before && (
        <div className={'shrink-0 ' + (destructive ? 'text-danger' : 'text-muted')}>{before}</div>
      )}
      <div className="min-w-0 flex-1">
        <div className={'text-[16px] leading-tight ' + (destructive ? 'text-danger' : 'text-ink')}>
          {title}
        </div>
        {subtitle && <div className="mt-0.5 text-[13px] leading-snug text-muted">{subtitle}</div>}
      </div>
      {after && <div className="shrink-0 text-muted">{after}</div>}
    </div>
  )
}
