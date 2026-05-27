import { useState } from 'react'
import { Button } from '../components/ui/Button'
import { Logo } from '../components/Logo'
import { useT } from '../lib/i18n'

export function KeyScreen({
  onActivate,
  busy,
  error,
}: {
  onActivate: (key: string) => void
  busy: boolean
  error: string | null
}) {
  const { t } = useT()
  const [key, setKey] = useState('')
  return (
    <div className="flex min-h-screen flex-col items-center px-7 pt-[18vh] text-center">
      <Logo size={68} />
      <h1 className="font-display mt-5 text-[28px] font-semibold text-ink">{t('key.activateTitle')}</h1>
      <p className="mt-2 max-w-[320px] text-[15px] leading-relaxed text-muted">
        {t('key.activateHint')}
      </p>

      <div className="mt-7 w-full max-w-[360px] text-left">
        <label className="px-1 text-[12px] font-medium uppercase tracking-[0.06em] text-faint">
          {t('key.title')}
        </label>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX"
          autoCapitalize="characters"
          className="mt-2 h-[52px] w-full rounded-2xl border border-transparent bg-surface-sunken px-4 text-[16px] tracking-wider text-ink outline-none placeholder:text-faint focus:border-accent"
        />
        {error && <p className="mt-3 px-1 text-[14px] text-danger">{error}</p>}

        <Button
          stretched
          className="mt-5"
          loading={busy}
          disabled={!key.trim()}
          onClick={() => onActivate(key)}
        >
          {t('key.activate')}
        </Button>
      </div>
    </div>
  )
}
