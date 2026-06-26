import { useEffect, useRef } from 'react'
import { PageHeader } from '../components/PageHeader'
import { SubscribeSheet } from './SubscribeSheet'
import { useT } from '../lib/i18n'
import { useActiveRefresh } from '../lib/useForeground'
import { subState } from '../lib/subscription'
import { pushBackHandler, popBackHandler } from '../lib/telegram'
import { type Profile } from '../api'

/** Dedicated "Subscription" tab. Shows the current status — lifetime (key),
 *  active until a date, expired, or none — the buy/renew action, and payment
 *  history. Keeps the Configs screen clean. Neutral by design; only an expired
 *  subscription is highlighted (red). */
export function SubscriptionScreen({
  active,
  profile,
  onChanged,
  onAccount,
  onBack,
  accountName,
  revalidate,
}: {
  active: boolean
  profile: Profile | null
  onChanged: () => void
  onAccount: () => void
  onBack?: () => void
  accountName?: string
  revalidate?: number
}) {
  const { t } = useT()
  const state = profile ? subState(profile) : 'none'

  // Refresh on tab-active / revalidate / foreground — the shared screen logic.
  useActiveRefresh(active, revalidate, onChanged)

  // When opened via a Renew/Buy button, drive Telegram's native BackButton
  // (‹ Назад, replacing "Закрыть") so it matches every other screen. Outside
  // Telegram, PageHeader renders an in-app ‹ instead. A ref keeps the handler
  // current without re-subscribing each render.
  const backRef = useRef(onBack)
  backRef.current = onBack
  const hasBack = !!onBack
  useEffect(() => {
    if (!active || !hasBack) return
    const handler = () => backRef.current?.()
    pushBackHandler(handler)
    return () => popBackHandler(handler)
  }, [active, hasBack])

  return (
    <div className="animate-fade min-h-screen pb-24">
      <PageHeader title={t('tab.subscription')} onAccount={onAccount} onBack={onBack} accountName={accountName} />
      <div className="px-4">
        {/* Оплата = action only (buy / renew); subscription status lives on the
            home banner. Lifetime has nothing to buy → a short note. */}
        {state === 'lifetime' ? (
          <p className="mt-12 text-center text-[15px] leading-relaxed text-muted">{t('sub.lifetimeHint')}</p>
        ) : (
          <div className="mt-4">
            <SubscribeSheet
              inline
              open={active}
              onClose={() => {}}
              onPaid={onChanged}
              renewing={state === 'active'}
              wasExpired={state === 'expired'}
            />
          </div>
        )}
      </div>
    </div>
  )
}
