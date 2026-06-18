/** Grey shimmer placeholder for loading states (Claude-style skeleton). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={'animate-pulse rounded-md bg-surface-sunken ' + className} />
}

/**
 * Skeleton rows — drop-in replacement for a list spinner. `card` (default true)
 * wraps them in a bordered card; pass card={false} when already inside one.
 */
export function ListSkeleton({
  rows = 4,
  avatar = true,
  card = true,
}: {
  rows?: number
  avatar?: boolean
  card?: boolean
}) {
  const inner = Array.from({ length: rows }).map((_, i) => (
    <div
      key={i}
      className={
        'flex items-center gap-3 px-4 py-3.5 ' + (i !== rows - 1 ? 'border-b border-border' : '')
      }
    >
      {avatar && <Skeleton className="h-10 w-10 shrink-0 rounded-full" />}
      <div className="min-w-0 flex-1">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="mt-2 h-3 w-1/3" />
      </div>
    </div>
  ))
  return card ? (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">{inner}</div>
  ) : (
    <>{inner}</>
  )
}
