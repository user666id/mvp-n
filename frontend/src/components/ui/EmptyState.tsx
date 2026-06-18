import type { ReactNode } from 'react'

/** Claude-style empty state: icon-in-circle + title + optional subtitle, centered. */
export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-surface-sunken text-faint">
        {icon}
      </div>
      <div className="text-[16px] font-medium text-ink">{title}</div>
      {subtitle && (
        <div className="mt-1 max-w-[260px] text-[13.5px] leading-snug text-muted">{subtitle}</div>
      )}
    </div>
  )
}
