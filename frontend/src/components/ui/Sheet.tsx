import React, { useEffect, useState } from 'react'
import { ChevronLeft } from '../icons'
import { useT } from '../../lib/i18n'

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const DUR = 360 // ms — enter/exit slide

// ── Background scroll lock ─────────────────────────────────────────────────────
// While any Sheet is open, the page behind it must NOT scroll — only the sheet's
// own body scrolls. Uses the position:fixed trick (reliable in iOS/Telegram
// webviews where `overflow:hidden` alone leaks touch momentum). Ref-counted so
// nested sheets (e.g. admin → profile) don't unlock the page prematurely.
let lockCount = 0
let savedScrollY = 0

function lockBodyScroll() {
  lockCount++
  if (lockCount > 1) return
  savedScrollY = window.scrollY
  const b = document.body.style
  b.position = 'fixed'
  b.top = `-${savedScrollY}px`
  b.left = '0'
  b.right = '0'
  b.width = '100%'
  b.overflow = 'hidden'
}

function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount > 0) return
  const b = document.body.style
  b.position = ''
  b.top = ''
  b.left = ''
  b.right = ''
  b.width = ''
  b.overflow = ''
  window.scrollTo(0, savedScrollY)
}

/**
 * Full-screen push panel (Claude style): slides in from the right, scrollable
 * body, iOS-safe areas. Always shows a ‹ back button — every sheet is push
 * navigation, so a back arrow (not ✕) is the right affordance everywhere.
 */
export function Sheet({
  open,
  onClose,
  onBack,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  /** Optional distinct handler for the ‹ back button; defaults to onClose. */
  onBack?: () => void
  title: React.ReactNode
  children: React.ReactNode
}) {
  const { t } = useT()

  // Mount-delay so the sheet can play an EXIT slide before unmounting (smooth,
  // Claude-style). `mounted` keeps it in the DOM; `shown` drives the transform.
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
    return () => document.removeEventListener('keydown', onKey)
  }, [mounted, onClose])

  // Lock the page behind the sheet while it's mounted (covers enter + exit).
  useEffect(() => {
    if (!mounted) return
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [mounted])

  if (!mounted) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-canvas will-change-transform"
      role="dialog"
      aria-modal="true"
      style={{
        transform: shown ? 'translateX(0)' : 'translateX(100%)',
        transition: `transform ${DUR}ms ${EASE}`,
      }}
    >
      <div className="flex items-center gap-3 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
        <button
          onClick={onBack ?? onClose}
          className="-ml-1 grid h-9 w-9 place-items-center rounded-full text-ink active:bg-surface-sunken"
          aria-label={t('common.back')}
        >
          <ChevronLeft size={26} />
        </button>
        <h2 className="font-display text-[22px] font-semibold text-ink">{title}</h2>
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-[max(20px,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  )
}
