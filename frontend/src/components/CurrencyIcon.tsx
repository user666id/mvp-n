import gramUrl from '../assets/coins/gram.svg'
import starsUrl from '../assets/coins/stars.svg'
import usdtUrl from '../assets/coins/usdt.svg'
import usdtTonUrl from '../assets/coins/usdt-ton.svg'
import usdtTronUrl from '../assets/coins/usdt-tron.svg'

/**
 * Brand coin icons for the payment currency picker (Fragment-style rounded
 * diamonds) — bundled SVG files so they pass the Mini App CSP `img-src`.
 *  - GRAM (TON): TON-blue diamond + white sparkle.
 *  - USDT: teal Tether diamond. The network variants add a small corner badge —
 *    a TON-blue crystal (USDT_TON) or a TRON-red mark (USDT_TRC20). Plain 'USDT'
 *    (the grouped chip) shows the bare gem.
 *  - Stars: the gold Telegram Stars star.
 */
const SRC: Record<string, string> = {
  TON: gramUrl,
  STARS: starsUrl,
  USDT_TON: usdtTonUrl,
  USDT_TRC20: usdtTronUrl,
}

export function CurrencyIcon({ asset, size = 30 }: { asset: string; size?: number }) {
  const src = SRC[asset] ?? usdtUrl // plain 'USDT' / unknown → bare teal gem
  const alt = asset === 'TON' ? 'GRAM' : asset === 'STARS' ? 'Telegram Stars' : 'USDT'
  return <img src={src} width={size} height={size} alt={alt} className="block object-contain" />
}
