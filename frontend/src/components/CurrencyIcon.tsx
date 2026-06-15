/**
 * Brand coin glyphs for the payment currency picker. Inline SVG (no external
 * images) so they work under the Mini App CSP and in both themes.
 *  - GRAM (Toncoin): the TON diamond on its blue disc.
 *  - USDT: the Tether ₮ on its teal disc, with a small network badge in the
 *    corner — a blue TON diamond for USDT-TON, a red TRON mark for USDT-TRC20 —
 *    so the two USDT assets are told apart at a glance (Tonkeeper-style).
 */
export function CurrencyIcon({ asset, size = 30 }: { asset: string; size?: number }) {
  if (asset === 'TON') return <TonCoin size={size} />
  return <UsdtCoin size={size} network={asset === 'USDT_TRC20' ? 'trc20' : 'ton'} />
}

function TonCoin({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
      <circle cx="28" cy="28" r="28" fill="#0098EA" />
      <path
        fill="#fff"
        d="M37.56 15.6H18.44c-3.51 0-5.74 3.79-3.97 6.85l11.78 20.4c.77 1.34 2.7 1.34 3.47 0l11.79-20.4c1.76-3.05-.46-6.85-3.95-6.85zM27.5 36.05l-2.57-4.97-6.19-11.06c-.41-.72.1-1.63.94-1.63h7.82v17.66zm10.75-16.03l-6.18 11.07-2.57 4.96V18.39h7.82c.84 0 1.35.91.93 1.63z"
      />
    </svg>
  )
}

function UsdtCoin({ size, network }: { size: number; network: 'ton' | 'trc20' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#26A17B" />
      <path
        fill="#fff"
        d="M17.92 17.38v-.002c-.11.008-.677.042-1.942.042-1.01 0-1.72-.03-1.97-.042v.003c-3.89-.17-6.79-.848-6.79-1.658 0-.81 2.9-1.487 6.79-1.66v2.644c.254.018.982.06 1.988.06 1.207 0 1.812-.05 1.924-.06v-2.643c3.88.173 6.776.85 6.776 1.658 0 .81-2.896 1.486-6.776 1.658m0-3.59v-2.366h5.414V7.82H8.6v3.608h5.413v2.365c-4.4.202-7.71 1.074-7.71 2.118s3.31 1.915 7.71 2.118v7.582h3.913v-7.584c4.392-.202 7.694-1.073 7.694-2.116s-3.302-1.914-7.694-2.117"
      />
      {network === 'ton' ? (
        <g>
          <circle cx="24.5" cy="24.5" r="7" fill="#0098EA" stroke="#fff" strokeWidth="1.4" />
          <polygon fill="#fff" points="24.5,21.2 27.3,24.5 24.5,27.8 21.7,24.5" />
        </g>
      ) : (
        <g>
          <circle cx="24.5" cy="24.5" r="7" fill="#EF0027" stroke="#fff" strokeWidth="1.4" />
          <polygon fill="#fff" points="21.4,21.6 27.6,22.6 24.2,27.6" />
        </g>
      )}
    </svg>
  )
}
