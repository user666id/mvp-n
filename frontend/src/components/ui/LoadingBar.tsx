/**
 * Indeterminate boot loading bar — a thin clay-orange (accent) sweep pinned to
 * the bottom of the screen, shown while the app boots or a lazy chunk loads
 * (in place of a centred spinner). Sits above the safe-area inset.
 */
export function LoadingBar() {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 h-[3px] loadbar-track"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      role="progressbar"
      aria-label="Loading"
    >
      <div className="h-full w-full loadbar-fill" />
    </div>
  )
}
