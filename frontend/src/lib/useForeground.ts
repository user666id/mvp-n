import { useEffect, useReducer, useRef } from 'react'
import * as cache from './cache'

/**
 * THE single loading primitive every data screen uses (stale-while-revalidate).
 * Returns last-known data INSTANTLY and revalidates in the background — it never
 * resets to a skeleton on re-activation, so a tab/sheet you re-open shows its
 * previous content immediately while a fresh fetch runs. A first load (no cache)
 * shows `loading`; the underlying request() has a 12s timeout + retries, so the
 * skeleton can never hang forever — a hard failure surfaces `error`+`retry`.
 *
 * `active` = the tab is selected / the sheet is open. `revalidate` = the App
 * counter bumped after an action that may have changed the data (forces a fetch).
 */
export function useCachedResource<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: { active: boolean; revalidate?: number },
) {
  const [, rerender] = useReducer((c) => c + 1, 0)
  const fRef = useRef(fetcher)
  fRef.current = fetcher
  // Stable wrapper that always calls the LATEST fetcher (props/closures change).
  const stable = useRef(() => fRef.current())
  cache.setFetcher(key, stable.current)

  // Re-render this component whenever the cache entry changes.
  useEffect(() => cache.subscribe(key, rerender), [key])

  // On (key or active) change: while active, count as a live subscriber and
  // revalidate (shows cached instantly + background refetch, or first fetch).
  useEffect(() => {
    if (!opts.active) return
    cache.setFetcher(key, stable.current)
    cache.markActive(key, true)
    cache.revalidate(key)
    return () => cache.markActive(key, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, opts.active])

  // The App `revalidate` counter → force a fresh fetch (skip the initial mount).
  const rev = opts.revalidate
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (opts.active) cache.invalidate(key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev])

  const e = cache.read(key)
  return {
    data: e.data as T | undefined,
    error: e.error,
    loading: e.data === undefined && e.error === undefined && opts.active,
    refreshing: e.promise !== undefined && e.data !== undefined,
    retry: () => cache.revalidate(key, { force: true }),
  }
}

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

/**
 * The single refresh logic shared by every tab: run `fn` when the tab becomes
 * active, when `revalidate` changes (e.g. the Account sheet closed and may have
 * mutated data), and when the Mini App returns to the foreground. One call
 * replaces each screen's bespoke active-effect + foreground hook so all screens
 * load and refresh identically.
 */
export function useActiveRefresh(active: boolean, revalidate: number | undefined, fn: () => void) {
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    if (active) fnRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, revalidate])
  useForegroundRefetch(active, fn)
}
