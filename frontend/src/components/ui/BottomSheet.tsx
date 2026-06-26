import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from '../icons'
import { pushBackHandler, popBackHandler } from '../../lib/telegram'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/scrollLock'

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const DUR = 360 // ms — slide up / down
const CLOSE_DRAG = 90 // px — drag the sheet down past this, release → close

/**
 * Bottom sheet: slides up from the bottom edge, sized to its content, dims the
 * page behind it. Closes on the ✕ button / backdrop tap / a downward swipe /
 * Escape / Telegram back. Use for compact, glanceable content (QR code, quick
 * confirmations) that shouldn't take the whole screen. Locks background scroll
 * while open (ref-counted) so dragging the sheet never moves the page behind it.
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
  // Downward-drag-to-dismiss. `drag` = current px offset; `dragging` disables the
  // transition so the sheet tracks the finger 1:1, then snaps (or closes) on release.
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startY = useRef(0)

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

  const onPointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY
    setDragging(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    const dy = e.clientY - startY.current
    setDrag(dy > 0 ? dy : 0)
  }
  const endDrag = () => {
    if (!dragging) return
    setDragging(false)
    if (drag > CLOSE_DRAG) onClose()
    setDrag(0)
  }

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
          opacity: shown ? (dragging ? Math.max(0, 1 - drag / 400) : 1) : 0,
          transition: dragging ? 'none' : `opacity ${DUR}ms ease`,
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative touch-none rounded-t-[28px] bg-canvas px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-5"
        style={{
          transform: shown ? `translateY(${drag}px)` : 'translateY(100%)',
          transition: dragging ? 'none' : `transform ${DUR}ms ${EASE}`,
        }}
      >
        <button
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-surface-sunken text-muted active:opacity-80"
        >
          <X size={18} />
        </button>
        {title && (
          <h3 className="font-display mb-4 px-8 text-center text-[17px] font-semibold text-ink">{title}</h3>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}
