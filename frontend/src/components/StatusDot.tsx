/**
 * Unified server / online status indicator — a static green (up) or red (down)
 * dot. One look everywhere (config cards, the config-detail row, server stats,
 * admin domain statuses): no pulse, no checkmark, just the dot.
 */
export function StatusDot({ ok, className = 'h-2 w-2' }: { ok: boolean; className?: string }) {
  return (
    <span className={'inline-block shrink-0 rounded-full ' + (ok ? 'bg-success' : 'bg-danger') + ' ' + className} />
  )
}
