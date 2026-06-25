import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react'
import { Wallet } from './icons'
import { useT } from '../lib/i18n'

/**
 * Header wallet capsule — same height as the account avatar pill on the left
 * (a 30px icon circle + p-1). Not connected → tapping opens TON Connect directly
 * (the wallet picker). Connected → shows the short address and opens the wallet
 * sheet (copy / disconnect). Renders under the app-wide TonConnectUIProvider.
 */
export function WalletPill({ onOpen }: { onOpen: () => void }) {
  const { t } = useT()
  const address = useTonAddress()
  const [tonConnectUI] = useTonConnectUI()
  const short = address ? address.slice(0, 4) + '…' + address.slice(-4) : ''
  return (
    <button
      onClick={() => (address ? onOpen() : tonConnectUI.openModal())}
      aria-label={t('wallet.title')}
      className="flex items-center gap-1 rounded-full bg-surface-sunken p-1 pr-2 active:opacity-80"
    >
      <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-surface">
        <Wallet size={16} className={short ? 'text-success' : 'text-muted'} />
      </span>
      <span className="text-[12.5px] font-medium tabular-nums text-ink">{short || t('wallet.label')}</span>
    </button>
  )
}
