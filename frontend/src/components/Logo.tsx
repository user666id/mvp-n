/** Brand mark — the mvp-n star (shield-less), matching the loading splash and the
 *  star app icon. Inline SVG so it stays crisp at any size. (The bot's Telegram
 *  avatar keeps the shield; everywhere else uses the star.) */
export function Logo({ size = 72 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="rounded-[28%] shadow-pop"
      style={{ width: size, height: size }}
      role="img"
      aria-label="mvp-n"
    >
      <defs>
        <linearGradient id="mvpnLogoBg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#D97757" />
          <stop offset="1" stopColor="#D97757" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="28" fill="url(#mvpnLogoBg)" />
      <path
        fill="#F3EEE3"
        d="M50 20 L53.1 38.41 L65 24.02 L58.49 41.51 L75.98 35 L61.59 46.89 L80 50 L61.59 53.11 L75.98 65 L58.49 58.49 L65 75.98 L53.1 61.59 L50 80 L46.9 61.59 L35 75.98 L41.51 58.49 L24.02 65 L38.41 53.11 L20 50 L38.41 46.89 L24.02 35 L41.51 41.51 L35 24.02 L46.9 38.41 Z"
      />
    </svg>
  )
}
