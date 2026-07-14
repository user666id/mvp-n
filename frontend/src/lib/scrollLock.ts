// Background scroll lock — shared by Sheet + BottomSheet so the page behind a
// modal never scrolls or rubber-bands; only the modal itself moves. Uses the
// position:fixed trick (reliable in iOS/Telegram webviews where `overflow:hidden`
// alone leaks touch momentum). Ref-counted so nested modals (e.g. a BottomSheet
// over a Sheet) don't unlock the page prematurely.
let lockCount = 0
let savedScrollY = 0

export function lockBodyScroll() {
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

export function unlockBodyScroll() {
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
