import { useState } from 'react'
import { TonConnectUIProvider, useTonConnectUI, useTonAddress } from '@tonconnect/ui-react'
import { Address, beginCell, toNano } from '@ton/core'
import { Button } from '../components/ui/Button'
import { useT } from '../lib/i18n'
import type { Order } from '../api'

// Note: Buffer (needed by @ton/core) is polyfilled globally at app boot in main.tsx,
// before this lazy chunk loads.
const MANIFEST = 'https://app.mvp-n.net/v2/tonconnect-manifest.json'
// After signing in an external wallet (Tonkeeper etc.) return straight to our Mini
// App instead of leaving the user stranded in the wallet — opens the Main Mini App.
const TWA_RETURN_URL = 'https://t.me/mvp_n_net_bot?startapp'
// Official Tether USD₮ jetton master on TON (symbol USD₮, 6 decimals).
const USDT_MASTER = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'
const JETTON_TRANSFER_OP = 0x0f8a7ea5

interface Props {
  /** 'TON' = native GRAM, 'USDT_TON' = USD₮ jetton. */
  asset: string
  /** Create (or reuse) the order and return it — the parent owns order state. */
  makeOrder: () => Promise<Order>
  onConfirmed: () => void
  onCancel: () => void
  /** Override the button label (else "Connect wallet" / "Pay in wallet"). */
  label?: string
  /** Visual emphasis + extra classes — the parent owns hierarchy/spacing. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  className?: string
}

/** Resolve the owner's USD₮ jetton-wallet address (where a jetton transfer must
 *  be sent from). The owner must hold USD₮ to pay, so this is present. */
async function resolveJettonWallet(owner: string): Promise<string> {
  // Timeout the lookup so a stalled tonapi on a flaky mobile/WebView connection
  // rejects (→ the caller's catch fires) instead of leaving the pay button
  // spinning forever.
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10_000)
  let r: Response
  try {
    r = await fetch(`https://tonapi.io/v2/accounts/${owner}/jettons/${USDT_MASTER}`, { signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
  if (!r.ok) throw new Error('no-jetton-wallet')
  const j = (await r.json()) as { wallet_address?: { address?: string } }
  const addr = j.wallet_address?.address
  if (!addr) throw new Error('no-jetton-wallet')
  return addr
}

function PayInner({ asset, makeOrder, onConfirmed, onCancel, label, variant, className }: Props) {
  const { t } = useT()
  const [tonConnectUI] = useTonConnectUI()
  const address = useTonAddress() // friendly address, '' when not connected
  const [busy, setBusy] = useState(false)

  const isNative = asset === 'TON'
  // Connect first whenever no wallet is linked: sendTransaction throws (no modal)
  // when disconnected, and a jetton also needs the owner address up-front. Once
  // connected, it's one tap to pay.
  const needConnect = !address

  const pay = async () => {
    setBusy(true)
    try {
      const o = await makeOrder()
      const validUntil = Math.floor(Date.now() / 1000) + 600 // 10 min to confirm
      let message: { address: string; amount: string; payload?: string }

      if (isNative) {
        const nano = BigInt(Math.round(parseFloat(o.amount) * 1e9)).toString()
        message = { address: o.address, amount: nano }
      } else {
        // USD₮ jetton transfer (TEP-74): send to the owner's jetton wallet, with
        // ~0.05 TON gas; excess refunds to the owner. Matched by amount as usual.
        const owner = address
        const jettonWallet = await resolveJettonWallet(owner)
        const units = BigInt(Math.round(parseFloat(o.amount) * 1e6)) // USD₮ has 6 decimals
        const body = beginCell()
          .storeUint(JETTON_TRANSFER_OP, 32)
          .storeUint(0, 64) // query_id
          .storeCoins(units) // jetton amount
          .storeAddress(Address.parse(o.address)) // destination = our TON wallet
          .storeAddress(Address.parse(owner)) // response_destination (gas refund)
          .storeBit(false) // custom_payload: none
          .storeCoins(1n) // forward_ton_amount (1 nanoton)
          .storeBit(false) // forward_payload: empty, inline
          .endCell()
        message = {
          address: jettonWallet,
          amount: toNano('0.05').toString(),
          payload: body.toBoc().toString('base64'),
        }
      }

      await tonConnectUI.sendTransaction({ validUntil, messages: [message] })
      onConfirmed()
    } catch {
      onCancel()
    } finally {
      setBusy(false)
    }
  }

  const onClick = () => {
    // Jetton needs an address before building the message → connect first.
    if (needConnect) {
      tonConnectUI.openModal()
      return
    }
    pay()
  }

  return (
    <Button onClick={onClick} loading={busy} variant={variant} className={className} stretched>
      {label ?? (needConnect ? t('pay.connectWallet') : t('pay.payWallet'))}
    </Button>
  )
}

/** Default export so it can be React.lazy()-imported — the ONLY module pulling in
 *  @tonconnect/ui + @ton/core, so they land in a lazy chunk off the initial load. */
export default function WalletPay(props: Props) {
  return (
    <TonConnectUIProvider
      manifestUrl={MANIFEST}
      actionsConfiguration={{ twaReturnUrl: TWA_RETURN_URL }}
    >
      <PayInner {...props} />
    </TonConnectUIProvider>
  )
}
