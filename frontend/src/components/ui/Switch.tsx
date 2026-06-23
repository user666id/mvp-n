export function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative box-border block shrink-0 rounded-full transition-colors duration-200',
        'disabled:opacity-50',
        checked
          ? 'bg-accent/70 ring-1 ring-inset ring-white/25 backdrop-blur-md backdrop-saturate-150'
          : 'bg-border',
      ].join(' ')}
      style={{ width: 50, height: 30 }}
    >
      <span
        className="rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{
          position: 'absolute',
          top: 3,
          left: 3,
          width: 24,
          height: 24,
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
        }}
      />
    </button>
  )
}
