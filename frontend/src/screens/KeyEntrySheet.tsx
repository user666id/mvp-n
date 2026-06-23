import { useState } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { Button } from '../components/ui/Button'
import { notify } from '../lib/telegram'
import { ApiError, activateKey } from '../api'
import { useT } from '../lib/i18n'

/** Activate access with a one-time key — opened from the Configs activate block. */
export function KeyEntrySheet({
  open,
  onClose,
  onActivated,
}: {
  open: boolean
  onClose: () => void
  onActivated: () => void
}) {
  const { t } = useT()
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await activateKey(key)
      notify('success')
      onActivated()
      onClose()
    } catch (e) {
      notify('error')
      setError(e instanceof ApiError ? e.message : t('key.invalid'))
    } finally {
      setBusy(false)
    }
  }

  const primaryBtn = (
    <Button stretched loading={busy} disabled={!key.trim()} onClick={submit}>
      {t('key.activate')}
    </Button>
  )

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('key.activateTitle')}
    >
      <p className="mb-4 text-[14px] leading-relaxed text-muted">{t('key.activateHint')}</p>
      <input
        value={key}
        onChange={(e) => setKey(e.target.value.toUpperCase())}
        placeholder="XXXX-XXXX"
        autoCapitalize="characters"
        className="h-[52px] w-full rounded-3xl border border-transparent bg-surface-sunken px-4 text-[16px] tracking-wider text-ink outline-none placeholder:text-faint focus:border-accent"
      />
      {error && <p className="mt-3 text-[14px] text-danger">{error}</p>}
      <div className="mt-5">{primaryBtn}</div>
    </Sheet>
  )
}
