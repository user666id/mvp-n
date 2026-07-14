import { Button } from './Button'
import { Refresh } from '../icons'
import { useT } from '../../lib/i18n'

/** Shown when a load failed (network/timeout) instead of leaving an infinite
 *  skeleton or a misleading "empty" — gives the user a Retry button. */
export function LoadError({ onRetry, className = '' }: { onRetry: () => void; className?: string }) {
  const { t } = useT()
  return (
    <div className={'flex flex-col items-center px-6 py-12 text-center ' + className}>
      <span className="grid h-14 w-14 place-items-center rounded-full bg-surface-sunken text-faint">
        <Refresh size={24} />
      </span>
      <p className="mb-6 mt-4 max-w-[260px] text-[14px] leading-relaxed text-muted">
        {t('common.loadError')}
      </p>
      <Button variant="secondary" onClick={onRetry}>
        <Refresh size={18} /> {t('common.retry')}
      </Button>
    </div>
  )
}
