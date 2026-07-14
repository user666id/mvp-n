import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight } from '../icons'
import { Avatar } from './Avatar'
import { PullScroll } from './PullScroll'
import { WalletPill } from '../WalletPill'
import { WalletSheet } from '../WalletSheet'
import { useT } from '../../lib/i18n'
import { useHeaderCtx } from '../../lib/headerCtx'
import { inTelegram, pushBackHandler, popBackHandler, accountPhotoUrl } from '../../lib/telegram'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/scrollLock'

// Background scroll lock lives in lib/scrollLock (shared with BottomSheet).
// The pull-to-drag scroll surface lives in ./PullScroll (shared with the tab screens).

/**
 * Full-screen panel: appears instantly (navigation transitions are disabled — they
 * stuttered in the webview), scrollable body, iOS-safe areas. Always shows a ‹ back
 * button — every sheet is push navigation, so a back arrow (not ✕) fits everywhere.
 */
export function Sheet({
  open,
  onClose,
  onBack,
  title,
  children,
  footer,
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
  /** When true, render the account-avatar + wallet pills in the header (via
   *  HeaderCtx) so the profile/wallet persist on drill-down sheets. */
  pills?: boolean
}) {
  const { t } = useT()
  const { accountName, onAccount, accountOpen, goHome } = useHeaderCtx()
  const [walletOpen, setWalletOpen] = useState(false)

  // No open/close animation — the sheet mounts shown and unmounts immediately, so
  // panels appear/dismiss instantly (transitions were dropped on request; they
  // stuttered in the webview). `mounted` gates the DOM; `shown` is true right away
  // (kept only for the focus-on-open effect below).
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(open)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setShown(true)
      return
    }
    setShown(false)
    setMounted(false)
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

  // No enter/exit transform — the sheet appears/dismisses instantly (bodyStyle is
  // empty; navigation transitions are off).
  const bodyStyle: React.CSSProperties = {}

  // Portal to <body> so the sheet escapes any screen-level stacking context
  // (e.g. the tab containers) — otherwise the bottom-nav could paint over a
  // full-screen sheet. At body level its z-50 reliably wins.
  return createPortal(
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      {/* The header + content BOTH live inside PullScroll, so a swipe moves the
          whole screen as one piece (avatar/wallet pull along with everything, with
          two-way elastic bounce) —
          the same PullScroll the tab screens use, so every page drags the same way. */}
      <div
        className="flex min-h-0 flex-1 flex-col bg-canvas"
        style={bodyStyle}
      >
        <PullScroll>
          {/* Header (avatar + wallet pills) — scrolls WITH the content. Same markup +
              paddings as the tab PageHeader so the capsules sit at the identical spot
              on every screen (no jump between a tab and a drill-down sheet). */}
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
          <div
            className={
              // No content entrance animation — the sheet appears instantly.
              'px-4 pt-4 ' +
              (footer ? 'pb-4' : 'pb-[max(20px,env(safe-area-inset-bottom))]')
            }
          >
            {children}
          </div>
        </PullScroll>
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
