import { useState, type ReactNode } from 'react'
import { Menu, ChevronRight } from './icons'
import { Avatar } from './ui/Avatar'
import { WalletPill } from './WalletPill'
import { WalletSheet } from './WalletSheet'

/**
 * App header bar: account avatar pill on the left (`onAccount` opens the Account
 * sheet) or a ‹hamburger› (`onMenu`), the absolutely-centred title (so it stays
 * screen-centred regardless of the side pills' widths), and the wallet capsule
 * on the right.
 */
export function PageHeader({
  title,
  action,
  onMenu,
  onAccount,
  accountName,
}: {
  title: string
  action?: ReactNode
  onMenu?: () => void
  onAccount?: () => void
  accountName?: string
}) {
  const [walletOpen, setWalletOpen] = useState(false)
  return (
    <>
    <header aria-label={title} className="sticky top-0 z-20 border-b border-white/10 bg-canvas/72 px-4 pb-6 pt-[max(10px,env(safe-area-inset-top),var(--tg-safe-top,0px))] backdrop-blur-xl backdrop-saturate-150">
      <div className="relative flex min-h-[44px] items-center">
        <div className="flex justify-start">
          {onAccount ? (
            <button
              onClick={onAccount}
              aria-label="Account"
              className="flex items-center gap-1 rounded-full bg-surface-sunken p-1 pr-2 active:opacity-80"
            >
              <Avatar name={accountName} size={30} />
              <ChevronRight size={14} className="text-faint" />
            </button>
          ) : onMenu ? (
            <button
              onClick={onMenu}
              aria-label="Menu"
              className="grid h-11 w-11 place-items-center rounded-full text-ink active:bg-surface-sunken"
            >
              <Menu size={24} />
            </button>
          ) : null}
        </div>
        <div className="flex-1" />
        <div className="flex items-center justify-end gap-2">
          {action}
          <WalletPill onOpen={() => setWalletOpen(true)} />
        </div>
      </div>
    </header>
    <WalletSheet open={walletOpen} onClose={() => setWalletOpen(false)} />
    </>
  )
}
