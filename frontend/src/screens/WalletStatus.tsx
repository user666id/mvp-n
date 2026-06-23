import { TonConnectUIProvider, useTonAddress, useTonConnectUI } from '@tonconnect/ui-react'
import { Wallet } from '../components/icons'
import { useT } from '../lib/i18n'

const MANIFEST = 'https://app.mvp-n.net/v2/tonconnect-manifest.json'
// Return to the Mini App after the wallet (Tonkeeper etc.) finishes — without this
// the user is left in the wallet app and connect/pay looks like it "hung".
const TWA_RETURN_URL = 'https://t.me/mvp_n_net_bot?startapp'

function WalletInner() {
  const { t } = useT()
  const address = useTonAddress() // friendly address, '' when not connected
  const [tonConnectUI] = useTonConnectUI()

  if (!address) {
    // Not connected → same capsule, with a Connect action (link up-front so
    // renewals are one tap).
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3">
        <Wallet size={20} className="text-muted" />
        <div className="min-w-0 flex-1 text-[15px] text-ink">{t('settings.walletNotConnected')}</div>
        <button
          onClick={() => tonConnectUI.openModal()}
          className="shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-medium text-white active:bg-accent-hover"
        >
          {t('settings.walletConnect')}
        </button>
      </div>
    )
  }

  const short = address.slice(0, 4) + '…' + address.slice(-4)
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3">
      <Wallet size={20} className="text-success" />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] text-ink">{t('settings.walletConnected')}</div>
        <div className="mt-0.5 text-[12.5px] text-muted tabular-nums">{short}</div>
      </div>
      <button
        onClick={() => tonConnectUI.disconnect()}
        className="shrink-0 text-[13.5px] font-medium text-danger active:opacity-60"
      >
        {t('settings.walletDisconnect')}
      </button>
    </div>
  )
}

/** Connect / show / disconnect a TON wallet. Lazy + its own TonConnectUIProvider
 *  so the heavy @tonconnect/ui SDK stays out of the initial bundle (loaded only
 *  when the payment pane that hosts this opens). The session persists, so once
 *  linked, renewals reuse it without reconnecting. */
export default function WalletStatus() {
  return (
    <TonConnectUIProvider
      manifestUrl={MANIFEST}
      actionsConfiguration={{ twaReturnUrl: TWA_RETURN_URL }}
    >
      <WalletInner />
    </TonConnectUIProvider>
  )
}
