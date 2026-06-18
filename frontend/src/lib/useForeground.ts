import { useEffect, useRef } from 'react'

/**
 * Runs `fn` when the Mini App returns to the foreground (visibilitychange →
 * visible), but only while `enabled`. Telegram WebViews get suspended in the
 * background and a fetch may have failed or gone stale meanwhile — this re-loads
 * it on resume so the user doesn't have to close and re-open the app to get
 * devices / profile loading again.
 */
export function useForegroundRefetch(enabled: boolean, fn: () => void) {
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    if (!enabled) return
    const onVis = () => {
      if (document.visibilityState === 'visible') fnRef.current()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [enabled])
}
