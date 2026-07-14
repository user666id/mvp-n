import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from '../icons'
import { pushBackHandler, popBackHandler } from '../../lib/telegram'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/scrollLock'
import { EASE, DUR } from '../../lib/motion'

/**
 * Bottom sheet: slides up from the bottom edge, sized to its content, dims the
 * page behind it. The sheet itself is IMMOVABLE (no drag) — like the TON Connect
 * modal; it closes ONLY on the ✕ button, a tap on the dimmed area above it, Escape,
 * or Telegram back. Use for compact, glanceable content (QR code, quick
 * confirmations) that shouldn't take the whole screen. Locks background scroll
 * while open (ref-counted) so the page behind never moves.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const r = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(r)
    }
    setShown(false)
    const id = setTimeout(() => setMounted(false), DUR)
    return () => clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!mounted) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const handler = () => onClose()
    pushBackHandler(handler)
    return () => {
      document.removeEventListener('keydown', onKey)
      popBackHandler(handler)
    }
  }, [mounted, onClose])

  // Freeze the page behind while open (ref-counted, shared with Sheet) so dragging
  // the sheet never scrolls/rubber-bands the screen underneath — only it moves.
  useEffect(() => {
    if (!mounted) return
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [mounted])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="absolute inset-0 bg-black/50"
        style={{
          opacity: shown ? 1 : 0,
          transition: `opacity ${DUR}ms ease`,
        }}
      />
      {/* The sheet itself swallows taps and is fixed in place — no drag handlers, so
          it can't be moved; closing is via the ✕ or a tap on the dimmed area above. */}
      <div
        onClick={(e) => e.stopPropagation()}
        // Capped at 92vh and scrollable, so a popup taller than the screen (small
        // device / large font) stays fully reachable instead of clipping — the same
        // "all content is reachable" rule the full-screen surfaces follow. Short
        // content (the norm) doesn't scroll and looks unchanged.
        className="glass-thin relative flex max-h-[92vh] flex-col rounded-t-[28px] border-x-0 border-b-0"
        style={{
          transform: shown ? 'translateY(0)' : 'translateY(100%)',
          transition: `transform ${DUR}ms ${EASE}`,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="tap absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full bg-surface-sunken text-muted active:opacity-80"
        >
          <X size={18} />
        </button>
        <div className="no-scrollbar overflow-y-auto overscroll-contain px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-5">
          {title && (
            <h3 className="font-display mb-4 px-8 text-center text-[17px] font-semibold text-ink">{title}</h3>
          )}
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
