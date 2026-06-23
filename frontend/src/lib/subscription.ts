import type { TKey } from './i18n'

type T = (key: TKey, params?: Record<string, string | number>) => string

/** What kind of access a profile has, derived from the same fields the backend
 *  exposes on both the user Profile and the admin AdminProfile. */
export type SubState = 'lifetime' | 'active' | 'expired' | 'none'

export interface SubFields {
  is_active?: boolean
  paid_until?: string | null
  is_expired?: boolean
}

export function subState(p: SubFields): SubState {
  if (p.is_expired) return 'expired'
  if (!p.is_active) return 'none'
  return p.paid_until ? 'active' : 'lifetime'
}

/** Block-explorer URL for a settled payment's tx hash, or '' if not linkable.
 *  TON tx ids are stored as "eventId:action" — strip the action suffix. */
export function txExplorerUrl(asset: string, txHash?: string): string {
  if (!txHash) return ''
  if (asset === 'USDT_TRC20') return `https://tronscan.org/#/transaction/${txHash}`
  return `https://tonviewer.com/transaction/${txHash.split(':')[0]}`
}

export function fmtSubDate(s: string, lang: 'en' | 'ru') {
  return new Date(s).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Human label + a tone for badges/dots. `lifetime`/`active` are good (green),
 *  `expired` is danger (red), `none` is neutral. */
export function subLabel(
  p: SubFields,
  t: T,
  lang: 'en' | 'ru',
): { state: SubState; text: string; tone: 'success' | 'danger' | 'muted' } {
  const state = subState(p)
  switch (state) {
    case 'lifetime':
      // Neutral by request — only "expired" is colored (red). Active vs key is
      // told apart by the text (a date vs "Lifetime"), not by colour.
      return { state, text: t('sub.lifetimeShort'), tone: 'muted' }
    case 'active':
      return { state, text: t('sub.until', { d: fmtSubDate(p.paid_until!, lang) }), tone: 'muted' }
    case 'expired':
      return { state, text: t('sub.expired'), tone: 'danger' }
    default:
      return { state, text: t('sub.none'), tone: 'muted' }
  }
}
