import { Spinner } from './Spinner'

/** Full-screen dim + centered spinner shown while a blocking action runs (save,
 *  delete, reset). Fades in; sits above sheets (z-[55]). Single source for the
 *  three identical busy overlays (config detail, account, admin). */
export function BusyOverlay({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="animate-fade fixed inset-0 z-[55] grid place-items-center bg-black/20">
      <Spinner size={30} />
    </div>
  )
}
