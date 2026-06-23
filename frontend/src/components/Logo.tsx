import logoUrl from '../assets/logo.jpg'

/** Brand mark — the actual @mvp_n_net_bot avatar image. */
export function Logo({ size = 72 }: { size?: number }) {
  return (
    <img
      src={logoUrl}
      alt="mvp-n"
      width={size}
      height={size}
      className="rounded-[28%] object-cover shadow-pop"
      style={{ width: size, height: size }}
    />
  )
}
