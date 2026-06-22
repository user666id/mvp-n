import type { ReactNode } from 'react'
import { Menu } from './icons'

/**
 * Large editorial page title with a ‹hamburger› menu trigger on the left
 * (opens the sections drawer) and an optional `action` on the right.
 */
export function PageHeader({
  title,
  action,
  onMenu,
}: {
  title: string
  action?: ReactNode
  onMenu?: () => void
}) {
  return (
    <header className="px-3 pb-2 pt-[max(10px,env(safe-area-inset-top))]">
      <div className="flex min-h-[44px] items-center">
        <div className="flex w-11 justify-start">
          {onMenu && (
            <button
              onClick={onMenu}
              aria-label="Menu"
              className="grid h-11 w-11 place-items-center rounded-full text-ink active:bg-surface-sunken"
            >
              <Menu size={24} />
            </button>
          )}
        </div>
        <h1 className="font-display flex-1 truncate text-center text-[17px] font-semibold text-ink">
          {title}
        </h1>
        <div className="flex w-11 justify-end">{action}</div>
      </div>
    </header>
  )
}
