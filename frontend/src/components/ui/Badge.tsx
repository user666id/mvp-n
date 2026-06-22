import React from 'react'

type Tone = 'accent' | 'success' | 'neutral' | 'danger'

const tones: Record<Tone, string> = {
  accent: 'bg-accent text-white',
  success: 'bg-success/15 text-success',
  neutral: 'bg-surface-sunken text-muted',
  danger: 'bg-danger/15 text-danger',
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: Tone
}) {
  return (
    <span
      className={
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none ' +
        tones[tone]
      }
    >
      {children}
    </span>
  )
}
