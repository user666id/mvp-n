import { type ReactNode } from 'react'

/**
 * Category hero — a centred circular icon + a title under it, at the top of a
 * screen (under the avatar/wallet header). A clean grey disc (no glow) with a thin
 * ring, the icon, and a title under it — a consistent anchor per screen.
 */
export function SheetHero({ icon, title }: { icon: ReactNode; title?: string }) {
  return (
    <div className="mb-6 mt-1 flex flex-col items-center text-center">
      <span className="grid h-[74px] w-[74px] place-items-center rounded-full bg-surface-sunken text-muted ring-1 ring-inset ring-white/10">
        {icon}
      </span>
      {title && <div className="font-display mt-3 text-[20px] font-semibold text-ink">{title}</div>}
    </div>
  )
}
