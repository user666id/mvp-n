/**
 * Letter avatar — a coloured circle with the first letter of the user's name.
 * Generated for every user (we don't pull the Telegram photo). Falls back to
 * the username's first letter, then "U", so it always renders something.
 */
export function Avatar({
  name,
  fallback,
  size = 40,
  className = '',
}: {
  name?: string
  fallback?: string
  size?: number
  className?: string
}) {
  const src = (name?.trim() || fallback?.trim() || '') as string
  const letter = (src[0] || 'U').toUpperCase()
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
