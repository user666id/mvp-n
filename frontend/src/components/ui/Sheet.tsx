import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight } from '../icons'
import { Avatar } from './Avatar'
import { WalletPill } from '../WalletPill'
import { WalletSheet } from '../WalletSheet'
import { useT } from '../../lib/i18n'
import { useHeaderCtx } from '../../lib/headerCtx'
import { inTelegram, pushBackHandler, popBackHandler, accountPhotoUrl } from '../../lib/telegram'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/scrollLock'

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const DUR = 360 // ms — enter/exit slide

// Background scroll lock lives in lib/scrollLock (shared with BottomSheet).

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

  // Portal to <body> so the sheet escapes any screen-level stacking context
  // (e.g. the animated tab containers) — otherwise the beta bottom-nav could
  // paint over a full-screen sheet. At body level its z-50 reliably wins.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
    >
      {/* Header (avatar + wallet pills + the hairline) is STATIC + identical to the
          tab PageHeader — same translucent glass, same paddings — so it never moves,
          doubles, or flickers as you navigate; only the body below animates. */}
      <div className="border-b border-white/10 bg-canvas/72 px-4 pb-6 pt-[max(10px,env(safe-area-inset-top),var(--tg-safe-top,0px))] backdrop-blur-xl">
        {/* Inner row matches PageHeader's min-h-[44px] so the hairline sits at the
            EXACT same height on every screen — no jump/doubling on transitions. */}
        <div className="relative flex min-h-[44px] items-center">
        {/* Inside Telegram the native BackButton (wired below) shows a ‹ back in the
            client header — don't duplicate it. Keep the title centred with a spacer.
            Outside Telegram (browser) our in-sheet ‹ is the only back, so keep it. */}
        {pills && onAccount ? (
          <div className="flex shrink-0 items-center gap-1">
            {!inTelegram && (
              <button
                onClick={onBack ?? onClose}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink active:bg-surface-sunken"
                aria-label={t('common.back')}
              >
                <ChevronLeft size={24} />
              </button>
            )}
            <button
              onClick={accountOpen ? (goHome ?? onBack ?? onClose) : onAccount}
              aria-label="Account"
              className="flex items-center gap-1 rounded-full bg-surface-sunken p-1 pr-2 active:opacity-80"
            >
              <Avatar name={accountName} photoUrl={accountPhotoUrl} size={30} />
              {accountName && (
                <span className="max-w-[84px] truncate text-[13.5px] font-medium text-ink">{accountName}</span>
              )}
              {accountOpen ? (
                <ChevronLeft size={14} className="text-faint" />
              ) : (
                <ChevronRight size={14} className="text-faint" />
              )}
            </button>
          </div>
        ) : inTelegram ? (
          <span className="w-11 shrink-0" />
        ) : (
          <button
            onClick={onBack ?? onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink active:bg-surface-sunken"
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
      <div
        className="flex min-h-0 flex-1 flex-col bg-canvas will-change-transform"
        style={
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
        }
      >
        <div
          className={
            'no-scrollbar animate-fade flex-1 overflow-y-auto px-4 pt-4 ' +
            (footer ? 'pb-4' : 'pb-[max(20px,env(safe-area-inset-bottom))]')
          }
        >
          {children}
        </div>
        {footer && (
          <div className="border-t border-white/10 bg-canvas/80 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] backdrop-blur-xl backdrop-saturate-150">
            {footer}
          </div>
        )}
      </div>
      {pills && <WalletSheet open={walletOpen} onClose={() => setWalletOpen(false)} />}
    </div>,
    document.body,
  )
}
