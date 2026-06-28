import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight } from '../icons'
import { Avatar } from './Avatar'
import { WalletPill } from '../WalletPill'
import { WalletSheet } from '../WalletSheet'
import { useT } from '../../lib/i18n'
import { useHeaderCtx } from '../../lib/headerCtx'
import { inTelegram, pushBackHandler, popBackHandler, accountPhotoUrl, selection } from '../../lib/telegram'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/scrollLock'

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const DUR = 300 // ms — enter/exit slide (snappy, Telegram-like)

// Background scroll lock lives in lib/scrollLock (shared with BottomSheet).

const PULL_MAX = 90 // px cap on the elastic overscroll travel
const PULL_TICK = 56 // px past which a downward pull fires the haptic tick

/**
 * The sheet's scroll surface. The header + body live INSIDE it, so a swipe moves
 * the WHOLE screen as one piece (the avatar/wallet pull along with everything —
 * no static-header / sliding-body split). Native momentum scroll in the middle;
 * at the edges a JS rubber-band stretches both ways (down at the top, up at the
 * bottom) with a haptic tick on the downward pull. Works for short and tall sheets.
 */
function SheetScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pull, setPull] = useState(0) // +down / −up
  const startY = useRef<number | null>(null)
  const dir = useRef(0) // 1 = overscroll at top, −1 = overscroll at bottom, 0 = native
  const crossed = useRef(false)

  const atTop = () => (ref.current?.scrollTop ?? 0) <= 0
  const atBottom = () => {
    const el = ref.current
    return !!el && el.scrollTop + el.clientHeight >= el.scrollHeight - 1
  }

  const begin = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
    dir.current = 0
    crossed.current = false
  }

  const move = (e: React.TouchEvent) => {
    if (startY.current == null) return
    const dy = e.touches[0].clientY - startY.current
    if (dir.current === 0) {
      // Decide once per gesture: overscroll only when pulling away from an edge;
      // otherwise hand the gesture to native scroll.
      if (dy > 0 && atTop()) dir.current = 1
      else if (dy < 0 && atBottom()) dir.current = -1
      else {
        startY.current = null
        return
      }
    }
    if (dir.current === 1) {
      const d = Math.min(PULL_MAX, dy * 0.45)
      setPull(d)
      if (d >= PULL_TICK && !crossed.current) {
        crossed.current = true
        selection()
      } else if (d < PULL_TICK && crossed.current) {
        crossed.current = false
      }
    } else {
      setPull(Math.max(-PULL_MAX, dy * 0.45))
    }
  }

  const end = () => {
    startY.current = null
    dir.current = 0
    setPull(0)
  }

  return (
    <div
      ref={ref}
      className="no-scrollbar flex-1 overflow-y-auto overscroll-y-contain"
      onTouchStart={begin}
      onTouchMove={move}
      onTouchEnd={end}
      onTouchCancel={end}
    >
      <div
        style={{
          transform: `translateY(${pull}px)`,
          transition: pull === 0 ? `transform ${DUR}ms ${EASE}` : 'none',
        }}
      >
        {children}
      </div>
    </div>
  )
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
  footer,
  anim = 'push',
  pills = true,
}: {
  open: boolean
  onClose: () => void
  /** Optional distinct handler for the ‹ back button; defaults to onClose. */
  onBack?: () => void
  title: React.ReactNode
  children: React.ReactNode
  /** Optional sticky action bar pinned to the bottom (the sheet's primary
   *  action). The body scrolls above it. Used by the beta layout system so every
   *  sheet's main action lives in the same place. */
  footer?: React.ReactNode
  /** Open animation: 'push' (slide in from the side — drill-down, back exits right)
   *  or 'center' (scale + fade pop — for action/detail sheets like Настроить). */
  anim?: 'push' | 'center'
  /** When true, render the account-avatar + wallet pills in the header (via
   *  HeaderCtx) so the profile/wallet persist on drill-down sheets. */
  pills?: boolean
}) {
  const { t } = useT()
  const { accountName, onAccount, accountOpen, goHome } = useHeaderCtx()
  const [walletOpen, setWalletOpen] = useState(false)

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

  const dialogRef = useRef<HTMLDivElement>(null)
  const FOCUSABLE =
    'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

  // Escape closes; Tab is trapped inside the open sheet (keyboard a11y — focus
  // shouldn't fall through to the page behind the modal).
  useEffect(() => {
    if (!mounted) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const f = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (f.length === 0) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mounted, onClose])

  // Move focus into the sheet when it opens, unless something inside already has
  // it (e.g. an autofocused field) — so we never pop the keyboard unexpectedly.
  useEffect(() => {
    if (!shown) return
    const root = dialogRef.current
    if (!root || root.contains(document.activeElement)) return
    root.querySelector<HTMLElement>(FOCUSABLE)?.focus()
  }, [shown])

  // Lock the page behind the sheet while it's mounted (covers enter + exit).
  useEffect(() => {
    if (!mounted) return
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [mounted])

  // Drive Telegram's native BackButton from the sheet stack while mounted, routing
  // a press to this sheet's back/close. A ref keeps the handler current without
  // re-subscribing on every parent re-render (onClose is often an inline closure).
  const backRef = useRef<() => void>(() => {})
  backRef.current = onBack ?? onClose
  useEffect(() => {
    if (!mounted) return
    const handler = () => backRef.current()
    pushBackHandler(handler)
    return () => popBackHandler(handler)
  }, [mounted])

  if (!mounted) return null

  // Body enter/exit transform. Applied to the BODY only — never the header — so the
  // avatar/wallet capsules stay pinned (iOS/Telegram nav-bar style) and never slide
  // or double against the tab header behind during open/close (that was the flicker).
  const bodyStyle: React.CSSProperties =
    anim === 'center'
      ? {
          opacity: shown ? 1 : 0,
          transform: shown ? 'scale(1)' : 'scale(0.96)',
          transformOrigin: 'center',
          transition: `opacity ${DUR}ms ${EASE}, transform ${DUR}ms ${EASE}`,
        }
      : {
          transform: shown ? 'translateX(0)' : 'translateX(100%)',
          transition: `transform ${DUR}ms ${EASE}`,
        }

  // Portal to <body> so the sheet escapes any screen-level stacking context
  // (e.g. the animated tab containers) — otherwise the beta bottom-nav could
  // paint over a full-screen sheet. At body level its z-50 reliably wins.
  return createPortal(
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      {/* Header (avatar + wallet pills) is STATIC — never scrolls or slides, exactly
          like the tab PageHeader behind it. Same markup + paddings so the capsules sit
          at the identical spot on every screen → no jump, no double, no flicker. */}
      <div className="bg-canvas px-4 pb-4 pt-[max(10px,env(safe-area-inset-top),var(--tg-safe-top,0px))]">
        <div className="relative flex min-h-[46px] items-center">
            {/* Inside Telegram the native BackButton (wired below) shows a ‹ back in the
                client header — don't duplicate it. Outside Telegram our in-sheet ‹ is it. */}
            {pills && onAccount ? (
              <div className="flex shrink-0 items-center gap-1">
                {!inTelegram && (
                  <button
                    onClick={onBack ?? onClose}
                    className="tap grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink active:bg-surface-sunken"
                    aria-label={t('common.back')}
                  >
                    <ChevronLeft size={24} />
                  </button>
                )}
                <button
                  onClick={accountOpen ? (goHome ?? onBack ?? onClose) : onAccount}
                  aria-label="Account"
                  className="tap flex items-center gap-1.5 rounded-full bg-surface p-1.5 pr-3 active:opacity-80"
                >
                  <Avatar name={accountName} photoUrl={accountPhotoUrl} size={32} />
                  {accountName && (
                    <span className="max-w-[88px] truncate text-[14px] font-medium text-ink">{accountName}</span>
                  )}
                  {accountOpen ? (
                    <ChevronLeft size={15} className="text-faint" />
                  ) : (
                    <ChevronRight size={15} className="text-faint" />
                  )}
                </button>
              </div>
            ) : inTelegram ? (
              <span className="w-11 shrink-0" />
            ) : (
              <button
                onClick={onBack ?? onClose}
                className="tap grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink active:bg-surface-sunken"
                aria-label={t('common.back')}
              >
                <ChevronLeft size={26} />
              </button>
            )}
            <h2 className="sr-only">{title}</h2>
            <div className="flex-1" />
            {pills ? (
              <WalletPill onOpen={() => setWalletOpen(true)} />
            ) : (
              <span className="w-11 shrink-0" />
            )}
            </div>
          </div>
      {/* Body — slides/scales on open/close (bodyStyle) and scrolls + two-way elastic
          bounce UNDER the static header (SheetScroll). */}
      <div
        className="flex min-h-0 flex-1 flex-col bg-canvas will-change-transform"
        style={bodyStyle}
      >
        <SheetScroll>
          <div
            className={
              'animate-fade px-4 pt-4 ' +
              (footer ? 'pb-4' : 'pb-[max(20px,env(safe-area-inset-bottom))]')
            }
          >
            {children}
          </div>
        </SheetScroll>
        {footer && (
          <div className="glass rounded-none border-x-0 border-b-0 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
      {pills && <WalletSheet open={walletOpen} onClose={() => setWalletOpen(false)} />}
    </div>,
    document.body,
  )
}
