import type { ReactNode } from 'react'

/**
 * One consistent "nothing here yet" placeholder — a centred, muted line. Use it
 * for the empty state of any list/section so padding and type size match across
 * the app (they used to drift: py-8 vs py-14, 14px vs 15px). For a richer empty
 * state with an icon + call-to-action (e.g. the Configs activation block), build
 * that inline — this is just the plain-text case.
 */
export function EmptyState({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={'py-12 text-center text-[14px] leading-relaxed text-muted ' + className}>{children}</div>
  )
}
