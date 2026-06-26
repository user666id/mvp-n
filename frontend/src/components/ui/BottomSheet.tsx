import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { pushBackHandler, popBackHandler } from '../../lib/telegram'

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const DUR = 360 // ms — slide up / down

/**
 * Bottom sheet: slides up from the bottom edge, sized to its content, dims the
 * page behind it. Closes on backdrop tap / Escape / Telegram back. Use for
 * compact, glanceable content (QR code, quick confirmations) that shouldn't take
 * the whole screen. Assumes it opens over an already-mounted Sheet (which holds
 * the scroll lock).
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
        style={{ opacity: shown ? 1 : 0, transition: `opacity ${DUR}ms ease` }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative rounded-t-[28px] bg-canvas px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-3"
        style={{
          transform: shown ? 'translateY(0)' : 'translateY(100%)',
          transition: `transform ${DUR}ms ${EASE}`,
        }}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-border" />
        {title && (
          <h3 className="font-display mb-4 text-center text-[17px] font-semibold text-ink">{title}</h3>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}
