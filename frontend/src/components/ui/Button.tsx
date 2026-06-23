import React from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  stretched?: boolean
}

const variants: Record<Variant, string> = {
  // Single source of truth for button hierarchy:
  //  primary   = solid clay CTA (matches the Create FAB / pay buttons)
  //  secondary = solid clay, no shadow
  //  ghost     = text-only clay (borderless link)
  //  danger    = red outline
  primary: 'bg-accent/80 text-white border border-white/20 shadow-btn backdrop-blur-md backdrop-saturate-150 active:bg-accent',
  secondary: 'bg-accent/65 text-white border border-white/15 backdrop-blur-md backdrop-saturate-150 active:bg-accent/80',
  ghost: 'bg-transparent text-accent active:bg-accent-soft',
  danger: 'bg-transparent text-danger border border-danger/35 active:bg-danger/10',
}

export function Button({
  variant = 'primary',
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
      onClick={onClick}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-full px-5 h-[44px]',
        'text-[15px] font-medium transition-colors select-none',
        'disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        stretched ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      {loading ? <Spinner size={20} /> : children}
    </button>
  )
}
