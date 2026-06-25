import { translate, type Lang } from './i18n'

/** Russian plural: pick form for n out of (one, few, many). */
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100
  const b = n % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}

/** Human relative time, e.g. "6m ago" / "6 минут назад", "yesterday", "3d ago". */
export function relativeTime(iso: string, lang: Lang = 'en'): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return translate(lang, 'time.justNow')
  if (m < 60) return translate(lang, 'time.minutesAgo', { n: m, u: plural(m, 'минуту', 'минуты', 'минут') })
  const h = Math.floor(m / 60)
  if (h < 24) return translate(lang, 'time.hoursAgo', { n: h, u: plural(h, 'час', 'часа', 'часов') })
  const d = Math.floor(h / 24)
  if (d === 1) return translate(lang, 'time.yesterday')
  return translate(lang, 'time.daysAgo', { n: d, u: plural(d, 'день', 'дня', 'дней') })
}

/** Zero-pad the internal id to 4 digits: 1 → "0001". */
export const padId = (n: number) => String(n).padStart(4, '0')

/** Heuristic: is this device name a phone/tablet (→ mobile icon)? */
export function isMobileDevice(name: string): boolean {
  return /iphone|ipad|ios|android|sm-|galaxy|redmi|xiaomi|pixel|huawei|honor|poco|oneplus|realme/i.test(
    name,
  )
}

/** Bytes → human string: "0 B", "512 MB", "3.4 GB" (units localized). */
export function formatBytes(bytes: number, lang: Lang = 'en'): string {
  const units = lang === 'ru' ? ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'] : ['B', 'KB', 'MB', 'GB', 'TB']
  if (!bytes || bytes < 0) return '0 ' + units[0]
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

/** Network rate from bytes/sec, auto-scaled: "0 B/s", "640 KB/s", "2.4 MB/s". */
export function bytesRate(bps: number, lang: Lang = 'en'): string {
  const perSec = lang === 'ru' ? '/с' : '/s'
  return formatBytes(Math.max(0, bps), lang) + perSec
}
