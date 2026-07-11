import { Skeleton } from './ui/Skeleton'

/** Capsule-shaped placeholder for the TON wallet status while its lazy chunk +
 *  TON Connect session restore. The SAME skeleton on every screen that hosts the
 *  wallet (Subscription, Profile) so the capsule keeps its shape and never pops
 *  in from a different-looking block. */
export function WalletSkeleton() {
  return (
    <div className="flex items-center gap-2.5 rounded-3xl border border-border bg-surface px-4 py-3">
      <Skeleton className="h-5 w-5 shrink-0 rounded-md" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-7 w-[84px] shrink-0 rounded-full" />
    </div>
  )
}
