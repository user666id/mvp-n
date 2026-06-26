import React from 'react'
import { Spinner } from './Spinner'
import { haptic } from '../../lib/telegram'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'md' | 'sm'
  loading?: boolean
  stretched?: boolean
}

const variants: Record<Variant, string> = {
  // Single source of truth for button hierarchy:
  //  primary   = solid clay CTA (matches the Create FAB / pay buttons)
  //  secondary = solid clay, no shadow
  //  ghost     = text-only clay (borderless link)
  //  danger    = red outline
  primary: 'bg-accent text-white border border-white/15 shadow-btn active:bg-accent-hover',
  secondary: 'bg-accent/85 text-white border border-white/12 active:bg-accent',
  ghost: 'bg-transparent text-accent active:bg-accent-soft',
  danger: 'bg-transparent text-danger border border-danger/35 active:bg-danger/10',
}

// Size controls padding + text only; both share the pill (rounded-full) shape.
//  md = full-height CTA (44px) · sm = inline pill (renew / connect / resume)
const sizes = {
  md: 'px-5 h-[44px] text-[15px]',
  sm: 'px-4 py-1.5 text-[13px]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  stretched,
  className = '',
  children,
  disabled,
  onClick,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      // A light haptic tick on every CTA press — one place, so the whole app gets
      // the same native tap feedback (the result still fires notify() on success).
      onClick={(e) => {
        if (!disabled && !loading) haptic('light')
        onClick?.(e)
      }}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-full font-medium select-none',
        'transition-[transform,background-color,color,opacity] duration-150 active:scale-[0.97]',
        'disabled:opacity-50 disabled:pointer-events-none',
        sizes[size],
        variants[variant],
        stretched ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      {loading ? <Spinner size={20} /> : children}
    </button>
  )
}
