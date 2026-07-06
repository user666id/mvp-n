import { Button } from '../components/ui/Button'
import { Logo } from '../components/Logo'
import { BRAND } from '../lib/config'
import { openLink, effectivePalette } from '../lib/telegram'
import { useT } from '../lib/i18n'

export function AuthScreen({
  onLogin,
  busy,
  error,
}: {
  onLogin: () => void
  busy: boolean
  error: string | null
}) {
  const { t, lang } = useT()
  const legalUrl = (doc: 'terms' | 'privacy') =>
    `https://legal.mvp-n.net/${doc}?lang=${lang}&theme=${effectivePalette()}`

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-7 text-center">
      <Logo size={84} />
      <h1 className="font-display mt-6 text-[34px] font-semibold text-ink">{BRAND}</h1>
      <p className="mt-3 max-w-[320px] text-[15px] leading-relaxed text-muted">{t('auth.welcome')}</p>

      {error && <p className="mt-5 text-[14px] text-danger">{error}</p>}

      <div className="mt-9 w-full max-w-[360px]">
        <Button stretched loading={busy} onClick={onLogin}>
          {t('auth.login')}
        </Button>
        {/* Consent is implicit: by signing in the user accepts the policies. */}
        <p className="mt-4 text-[12.5px] leading-snug text-faint">
          {t('auth.agreePre')}
          <button
            type="button"
            onClick={() => openLink(legalUrl('terms'))}
            className="text-accent active:opacity-70"
          >
            {t('about.terms')}
          </button>
          {t('auth.agreeAnd')}
          <button
            type="button"
            onClick={() => openLink(legalUrl('privacy'))}
            className="text-accent active:opacity-70"
          >
            {t('about.privacy')}
          </button>
          {t('auth.agreePost')}
        </p>
      </div>
    </div>
  )
}
