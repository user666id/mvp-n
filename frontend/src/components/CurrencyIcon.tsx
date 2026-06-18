import gramUrl from '../assets/coins/gram.svg'
import starsUrl from '../assets/coins/stars.svg'
import tonUrl from '../assets/coins/ton.svg'
import usdtUrl from '../assets/coins/usdt.svg'
import tronUrl from '../assets/coins/tron.svg'

/**
 * Brand coin icons for the payment currency picker — bundled SVG files (pass the
 * Mini App CSP `img-src`).
 *  - GRAM: the official post-rebrand mark (ton.org brand assets — blue shield +
 *    white sparkle/gem).
 *  - USDT: the Tether disc + a small network badge — TON diamond for USDT-TON,
 *    TRON mark for USDT-TRC20.
 *  - Stars: the gold Telegram Stars star (official telegram-tt star geometry in
 *    the Stars gold palette).
 */
export function CurrencyIcon({ asset, size = 30 }: { asset: string; size?: number }) {
  if (asset === 'TON') {
    return <img src={gramUrl} width={size} height={size} alt="GRAM" className="block" />
  }
  if (asset === 'STARS') {
    return (
      <img
        src={starsUrl}
        width={size}
        height={size}
        alt="Telegram Stars"
        className="block object-contain"
      />
    )
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
