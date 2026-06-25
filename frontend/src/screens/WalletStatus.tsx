import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react'
import { Wallet } from '../components/icons'
import { useT } from '../lib/i18n'

function WalletInner() {
  const { t } = useT()
  const address = useTonAddress() // friendly address, '' when not connected
  const [tonConnectUI] = useTonConnectUI()

  if (!address) {
    // Not connected → same capsule, with a Connect action (link up-front so
    // renewals are one tap).
    return (
      <div className="flex items-center gap-2.5 rounded-3xl border border-border bg-surface px-4 py-3">
        <Wallet size={20} className="text-muted" />
        <div className="min-w-0 flex-1 text-[15px] text-ink">{t('settings.walletNotConnected')}</div>
        <button
          onClick={() => tonConnectUI.openModal()}
          className="shrink-0 rounded-full border border-white/20 bg-accent/80 px-3.5 py-1.5 text-[13px] font-medium text-white backdrop-blur-md backdrop-saturate-150 active:bg-accent/85"
        >
          {t('settings.walletConnect')}
        </button>
      </div>
    )
  }

  const short = address.slice(0, 4) + '…' + address.slice(-4)
  return (
    <div className="flex items-center gap-2.5 rounded-3xl border border-border bg-surface px-4 py-3">
      <Wallet size={20} className="text-success" />
      <div className="min-w-0 flex-1 text-[15px] text-ink tabular-nums">{short}</div>
      <button
        onClick={() => tonConnectUI.disconnect()}
        className="shrink-0 text-[13.5px] font-medium text-danger active:opacity-60"
      >
        {t('settings.walletDisconnect')}
      </button>
    </div>
  )
}

/** Connect / show / disconnect a TON wallet. Uses the app-wide
 *  TonConnectUIProvider (mounted in App), so the connection is shared with the
 *  header wallet capsule and the payment panes. */
export default function WalletStatus() {
  return <WalletInner />
}
