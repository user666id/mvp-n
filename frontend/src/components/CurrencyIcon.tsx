import tonUrl from '../assets/coins/ton.svg'
import usdtUrl from '../assets/coins/usdt.svg'
import tronUrl from '../assets/coins/tron.svg'

/**
 * Brand coin icons for the payment currency picker — the official logos shipped
 * as SVG files (bundled same-origin, so they pass the Mini App CSP `img-src`).
 *  - GRAM (Toncoin): the official TON disc + diamond.
 *  - USDT: the Tether disc, with a small network badge in the corner — the TON
 *    diamond for USDT-TON, the TRON mark for USDT-TRC20 — so the two USDT assets
 *    are told apart at a glance (one Tether icon, two badges).
 */
export function CurrencyIcon({ asset, size = 30 }: { asset: string; size?: number }) {
  if (asset === 'TON') {
    return <img src={tonUrl} width={size} height={size} alt="GRAM" className="block" />
  }
  const badge = asset === 'USDT_TRC20' ? tronUrl : tonUrl
  const b = Math.round(size * 0.46)
  return (
    <span className="relative inline-block" style={{ width: size, height: size }}>
      <img src={usdtUrl} width={size} height={size} alt="USDT" className="block" />
      {/* network badge — a ring in the surface colour separates it from the coin */}
      <span
        className="absolute grid place-items-center rounded-full bg-surface"
        style={{ right: -2, bottom: -2, padding: 1.5 }}
      >
        <img src={badge} width={b} height={b} alt="" className="block rounded-full" />
      </span>
    </span>
  )
}
