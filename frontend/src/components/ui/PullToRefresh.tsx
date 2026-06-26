import { useRef, useState, type ReactNode } from 'react'
import { selection, notify } from '../../lib/telegram'
import { anyBottomSheetOpen } from './BottomSheet'

const MAX = 90 // cap on the rubber-band travel (px)
const THRESHOLD = 56 // translated px past which a downward pull arms a refresh

// Nearest scrollable ancestor of `el` (an overflow-y auto/scroll box), or null
// when the page scrolls on the window itself.
function findScroller(el: HTMLElement | null): HTMLElement | null {
  let node = el
  while (node && node !== document.body) {
    const oy = getComputedStyle(node).overflowY
    if (oy === 'auto' || oy === 'scroll') return node
    node = node.parentElement
  }
  return null
}

// Can this surface actually scroll? If yes, native momentum + edge-bounce already
// handle BOTH directions (like the window-scrolled tabs) — so we stay out of the
// way. Only short, non-scrolling surfaces get the JS rubber-band, so every screen
// still feels elastic up AND down.
function scrollable(sc: HTMLElement | null): boolean {
  if (sc) return sc.scrollHeight > sc.clientHeight + 1
  return document.documentElement.scrollHeight > window.innerHeight + 1
}

/**
 * Elastic overscroll in BOTH directions — no spinner. On a surface that can't
 * scroll, dragging up or down rubber-bands the content and eases back on release,
 * matching the native feel of the scrollable screens. On a scrollable surface it
 * does nothing and lets native momentum/bounce take over.
 *
 * `onRefresh` (optional) fires silently once a downward pull passes the threshold
 * (haptic tick only, no indicator). Inert when `disabled`.
 */
export function PullToRefresh({
  onRefresh,
  disabled,
  children,
}: {
  onRefresh?: () => Promise<unknown> | unknown
  disabled?: boolean
  children: ReactNode
}) {
  const [pull, setPull] = useState(0) // +down / −up
  const startY = useRef<number | null>(null)
  const armed = useRef(false)
  const crossed = useRef(false)

  const begin = (e: React.TouchEvent) => {
    if (disabled || anyBottomSheetOpen()) return // don't move the page under a mini-modal
    if (scrollable(findScroller(e.target as HTMLElement))) return // native handles it
    startY.current = e.touches[0].clientY
    armed.current = true
    crossed.current = false
  }

  const move = (e: React.TouchEvent) => {
    if (!armed.current || startY.current == null) return
    const dy = e.touches[0].clientY - startY.current
    const d = Math.max(-MAX, Math.min(MAX, dy * 0.45)) // rubber-band, both ways, capped
    setPull(d)
    if (onRefresh && d >= THRESHOLD && !crossed.current) {
      crossed.current = true
      selection()
    } else if (d < THRESHOLD && crossed.current) {
      crossed.current = false
    }
  }

  const end = () => {
    if (!armed.current) return
    armed.current = false
    if (onRefresh && pull >= THRESHOLD) {
      notify('success')
      void onRefresh()
    }
    setPull(0)
  }

  const settling = !armed.current // ease back into place once the finger lifts

  return (
    <div className="relative" onTouchStart={begin} onTouchMove={move} onTouchEnd={end} onTouchCancel={end}>
      <div
        style={{
          transform: `translateY(${pull}px)`,
          transition: settling ? 'transform .3s cubic-bezier(.22,1,.36,1)' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  )
}
