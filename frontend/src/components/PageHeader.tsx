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
    <header aria-label={title} className="sticky top-0 z-20 border-b border-white/10 bg-canvas/72 px-4 pb-6 pt-[max(10px,env(safe-area-inset-top),var(--tg-safe-top,0px))] backdrop-blur-xl">
      <div className="relative flex min-h-[44px] items-center">
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
              className="flex items-center gap-1 rounded-full bg-surface-sunken p-1 pr-2 active:opacity-80"
            >
              <Avatar name={accountName} photoUrl={accountPhotoUrl} size={30} />
              {accountName && (
                <span className="max-w-[84px] truncate text-[13.5px] font-medium text-ink">{accountName}</span>
              )}
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
