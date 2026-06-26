import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react'
import { BottomSheet } from './ui/BottomSheet'
import { Button } from './ui/Button'
import { SheetHero } from './ui/SheetHero'
import { Wallet } from './icons'
import { useToast } from './ui/Toast'
import { copyText } from '../lib/clipboard'
import { notify } from '../lib/telegram'
import { useT } from '../lib/i18n'

/**
 * Wallet bottom-sheet opened from the header capsule when connected. Shows just a
 * single capsule — neutral wallet icon, the short address (tap to copy), and a red
 * Disconnect. Not-connected falls back to a connect action (the header pill opens
 * TON Connect directly, so that branch is rarely hit). Renders under the app-wide
 * TonConnectUIProvider (mounted in App).
 */
export function WalletSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT()
  const toast = useToast()
  const address = useTonAddress()
  const [tonConnectUI] = useTonConnectUI()
  const short = address ? address.slice(0, 4) + '…' + address.slice(-4) : ''

  const copy = async () => {
    await copyText(address)
    notify('success')
    toast(t('detail.copied'))
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      {/* Title lives UNDER the icon (the SheetHero), like every other screen —
          so the BottomSheet header carries no title here (would be a duplicate). */}
      <SheetHero icon={<Wallet size={30} />} title={t('wallet.title')} />
      {address ? (
        <div className="flex items-center gap-2.5 rounded-3xl border border-border bg-surface px-4 py-3">
          <button
            onClick={copy}
            className="tap flex min-w-0 flex-1 items-center gap-2.5 text-left active:opacity-70"
            aria-label={t('common.copy')}
          >
            <Wallet size={20} className="shrink-0 text-success" />
            <span className="min-w-0 flex-1 truncate text-[15px] text-ink tabular-nums">{short}</span>
          </button>
          <button
            onClick={() => {
              tonConnectUI.disconnect()
              onClose()
            }}
            className="tap shrink-0 text-[13.5px] font-medium text-danger active:opacity-60"
          >
            {t('settings.walletDisconnect')}
          </button>
        </div>
      ) : (
        <>
          <p className="mx-auto mb-5 max-w-[280px] text-center text-[13.5px] leading-snug text-muted">
            {t('wallet.connectHint')}
          </p>
          <Button stretched onClick={() => tonConnectUI.openModal()}>
            {t('settings.walletConnect')}
          </Button>
        </>
      )}
    </BottomSheet>
  )
}
