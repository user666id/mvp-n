/** Grey shimmer placeholder for loading states (Claude-style skeleton). The
 *  `skeleton` class (index.css) sweeps a soft light band across the base for a
 *  smoother feel than an opacity pulse. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={'skeleton rounded-md ' + className} />
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
    <div className="overflow-hidden rounded-3xl border border-border bg-surface">{inner}</div>
  ) : (
    <>{inner}</>
  )
}

/**
 * Home-dashboard placeholder — mirrors the real stacked layout (subscription
 * strip · config card · 2-up widgets) so the first paint doesn't jump when the
 * data lands. Same rounded-3xl cards, same vertical rhythm as the live screen.
 */
export function HomeSkeleton() {
  return (
    <div className="space-y-4">
      {/* subscription strip */}
      <div className="flex items-center gap-3 rounded-3xl border border-border bg-surface px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="mt-2 h-3 w-1/4" />
        </div>
        <Skeleton className="h-8 w-20 shrink-0 rounded-full" />
      </div>
      {/* config card */}
      <div className="overflow-hidden rounded-3xl border border-border bg-surface">
        <div className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="mt-2 h-3 w-1/4" />
          </div>
        </div>
        <div className="px-4 pb-4">
          <Skeleton className="h-11 w-full rounded-2xl" />
        </div>
      </div>
      {/* widgets */}
      <div className="grid grid-cols-2 gap-2.5">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-3xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="mt-3 h-6 w-1/2" />
            <Skeleton className="mt-2.5 h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  )
}
