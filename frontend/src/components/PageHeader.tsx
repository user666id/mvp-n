import type { ReactNode } from 'react'
import { Menu } from './icons'
import { Avatar } from './ui/Avatar'

/**
 * Large editorial page title. Left slot is either the account avatar (variant A:
 * `onAccount` opens the Account sheet) or a ‹hamburger› (`onMenu`, legacy drawer);
 * right slot is an optional `action`.
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
  return (
    <header className="sticky top-0 z-20 bg-canvas/72 px-3 pb-2 pt-[max(10px,env(safe-area-inset-top),var(--tg-safe-top,0px))] backdrop-blur-xl backdrop-saturate-150">
      <div className="flex min-h-[44px] items-center">
        <div className="flex w-11 justify-start">
          {onAccount ? (
            <button onClick={onAccount} aria-label="Account" className="rounded-full active:opacity-70">
              <Avatar name={accountName} size={34} />
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
        <h1 className="font-display flex-1 truncate text-center text-[17px] font-semibold text-ink">
          {title}
        </h1>
        <div className="flex w-11 justify-end">{action}</div>
      </div>
    </header>
  )
}
