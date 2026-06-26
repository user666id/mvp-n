import { useState, type ReactNode } from 'react'
import { Menu, ChevronRight, ChevronLeft } from './icons'
import { Avatar } from './ui/Avatar'
import { WalletPill } from './WalletPill'
import { WalletSheet } from './WalletSheet'
import { useT } from '../lib/i18n'
import { inTelegram, accountPhotoUrl } from '../lib/telegram'

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
  onBack,
  accountName,
}: {
  title: string
  action?: ReactNode
  onMenu?: () => void
  onAccount?: () => void
  /** When set, a ‹ back arrow shows at the far left (e.g. the Payment tab opened
   *  via a Renew button — returns to where it came from). */
  onBack?: () => void
  accountName?: string
}) {
  const { t } = useT()
  const [walletOpen, setWalletOpen] = useState(false)
  return (
    <>
    {/* Header scrolls WITH the content (not sticky) and carries no divider — so the
        avatar + wallet capsules move together with every other block on the page,
        and nothing bleeds through a translucent bar. Identical markup across all
        screens keeps the capsules visually static (no jump) on transitions. */}
    <header aria-label={title} className="bg-canvas px-4 pb-4 pt-[max(10px,env(safe-area-inset-top),var(--tg-safe-top,0px))]">
      <div className="relative flex min-h-[46px] items-center">
        <div className="flex items-center justify-start gap-1">
          {/* Inside Telegram the native BackButton (‹ Назад) is used instead — see
              SubscriptionScreen; only render an in-app ‹ in the browser. */}
          {onBack && !inTelegram && (
            <button
              onClick={onBack}
              aria-label={t('common.back')}
              className="grid h-9 w-9 place-items-center rounded-full text-ink active:bg-surface-sunken"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          {onAccount ? (
            <button
              onClick={onAccount}
              aria-label="Account"
              className="flex items-center gap-1.5 rounded-full bg-surface p-1 pr-2.5 active:opacity-80"
            >
              <Avatar name={accountName} photoUrl={accountPhotoUrl} size={32} />
              {accountName && (
                <span className="max-w-[88px] truncate text-[14px] font-medium text-ink">{accountName}</span>
              )}
              <ChevronRight size={15} className="text-faint" />
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
