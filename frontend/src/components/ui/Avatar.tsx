/**
 * Account avatar. Shows the real Telegram profile photo when one is available
 * (`photoUrl`); otherwise falls back to a coloured circle with the first letter
 * of the user's name (then username, then "U") — so it always renders something.
 */
export function Avatar({
  name,
  fallback,
  size = 40,
  photoUrl,
  className = '',
}: {
  name?: string
  fallback?: string
  size?: number
  photoUrl?: string
  className?: string
}) {
  const src = (name?.trim() || fallback?.trim() || '') as string
  const letter = (src[0] || 'U').toUpperCase()
  if (photoUrl) {
    // Hard-clip the photo to the circle (overflow-hidden on the wrapper) so the
    // image colour never bleeds past the disc edge in any webview.
    return (
      <span
        className={'block shrink-0 overflow-hidden rounded-full bg-surface-sunken ' + className}
        style={{ width: size, height: size }}
      >
        <img
          src={photoUrl}
          alt={src || 'avatar'}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      </span>
    )
  }
  return (
    <div
      className={
        'grid shrink-0 place-items-center rounded-full bg-accent font-semibold text-white ' +
        className
      }
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {letter}
    </div>
  )
}
