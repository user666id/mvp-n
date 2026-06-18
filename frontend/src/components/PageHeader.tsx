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
    <header className="px-5 pb-4 pt-[max(14px,env(safe-area-inset-top))]">
      {(onMenu || action) && (
        <div className="mb-1.5 flex min-h-[36px] items-center justify-between">
          {onMenu ? (
            <button
              onClick={onMenu}
              aria-label="Menu"
              className="-ml-1.5 grid h-9 w-9 place-items-center rounded-full text-ink active:bg-surface-sunken"
            >
              <Menu size={24} />
            </button>
          ) : (
            <span />
          )}
          {action ?? <span />}
        </div>
      )}
      <h1 className="font-display text-[34px] font-semibold leading-[1.1] tracking-tight text-ink">
        {title}
      </h1>
    </header>
  )
}
