import React, { useEffect, useRef } from 'react'
import { selection } from '../../lib/telegram'
import { EASE, DUR } from '../../lib/motion'

const PULL_MAX = 90 // px cap on the elastic overscroll travel
const PULL_TICK = 56 // px past which a downward pull fires the haptic tick

/**
 * A scroll surface you can always PULL up/down. Native momentum scroll in the
 * middle; at the edges a JS rubber-band stretches BOTH ways (down at the top, up
 * at the bottom) and settles back, with a haptic tick on the downward pull. Works
 * even when the content fits the screen — so every page feels draggable, not just
 * the ones tall enough to scroll. Shared by full-screen Sheets and the bottom-tab
 * screens so the whole app moves the same way.
 *
 * Perf: the touch listeners are PASSIVE (never preventDefault) so the browser
 * keeps its fast native-scroll path — attaching them via React's synthetic
 * onTouchMove made scroll main-thread-bound and janky. The rubber-band writes the
 * transform straight to the DOM (no React state → no re-render of the heavy page
 * on every move), and `will-change`/`transform` are only set DURING a pull, so at
 * rest there's no forced compositing layer (which was flashing on tab cross-fades).
 *
 * Must be a `flex-1` child of a bounded-height `flex flex-col` parent.
 */
export function PullScroll({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    const inner = innerRef.current
    if (!el || !inner) return

    let startY: number | null = null
    let dir = 0 // 1 = overscroll at top, −1 = overscroll at bottom, 0 = native
    let crossed = false

    const atTop = () => el.scrollTop <= 0
    const atBottom = () => el.scrollTop + el.clientHeight >= el.scrollHeight - 1

    const setPull = (d: number) => {
      inner.style.transform = d === 0 ? '' : `translate3d(0, ${d}px, 0)`
    }

    // True when the touch started inside a NESTED vertical scroller (e.g. the
    // device-limit wheel, or a scrollable list) between the target and our own
    // container. Such a gesture belongs to that element — we must not hijack it
    // with the rubber-band, or the inner control can't be scrolled.
    const startedInNestedScroller = (target: EventTarget | null) => {
      let n = target instanceof HTMLElement ? target : null
      while (n && n !== el) {
        const oy = getComputedStyle(n).overflowY
        if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return true
        n = n.parentElement
      }
      return false
    }

    const begin = (e: TouchEvent) => {
      if (startedInNestedScroller(e.target)) {
        startY = null // leave the gesture to the nested scroller
        return
      }
      startY = e.touches[0].clientY
      dir = 0
      crossed = false
    }

    const move = (e: TouchEvent) => {
      if (startY == null) return
      const dy = e.touches[0].clientY - startY
      if (dir === 0) {
        // Decide once per gesture: overscroll only when pulling away from an
        // edge; otherwise leave the whole gesture to native (fast) scroll.
        if (dy > 0 && atTop()) dir = 1
        else if (dy < 0 && atBottom()) dir = -1
        else {
          startY = null
          return
        }
        inner.style.transition = 'none'
        inner.style.willChange = 'transform'
      }
      if (dir === 1) {
        const d = Math.min(PULL_MAX, dy * 0.45)
        setPull(d)
        if (d >= PULL_TICK && !crossed) {
          crossed = true
          selection()
        } else if (d < PULL_TICK && crossed) {
          crossed = false
        }
      } else {
        setPull(Math.max(-PULL_MAX, dy * 0.45))
      }
    }

    const end = () => {
      if (startY == null && dir === 0) return
      startY = null
      dir = 0
      // Settle back with a transition, then drop the layer so nothing composites
      // at rest.
      inner.style.transition = `transform ${DUR}ms ${EASE}`
      setPull(0)
      window.setTimeout(() => {
        inner.style.willChange = ''
        inner.style.transition = ''
      }, DUR)
    }

    // Passive: we never call preventDefault — the stretch is a transform, native
    // scroll is untouched — so the browser can scroll on the compositor thread.
    el.addEventListener('touchstart', begin, { passive: true })
    el.addEventListener('touchmove', move, { passive: true })
    el.addEventListener('touchend', end, { passive: true })
    el.addEventListener('touchcancel', end, { passive: true })
    return () => {
      el.removeEventListener('touchstart', begin)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
    }
  }, [])

  return (
    <div ref={scrollRef} className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
      <div ref={innerRef}>{children}</div>
    </div>
  )
}
