// User-facing release notes shown in About → "What's new".
//
// SINGLE SOURCE: add one entry here when you ship a release and BOTH the
// in-app updates list AND the version badge update automatically — nothing
// else to touch in the UI. (Developer-facing detail lives in /CHANGELOG.md.)
// Keep entries newest-first; group items by kind (added / changed / fixed) and
// keep each line short and user-facing.

export type ChangeKind = 'added' | 'changed' | 'fixed'

export interface ReleaseNote {
  version: string
  /** YYYY-MM-DD */
  date: string
  groups: { kind: ChangeKind; items: { en: string; ru: string }[] }[]
}

export const RELEASES: ReleaseNote[] = [
  {
    version: '1.4',
    date: '2026-06-12',
    groups: [
      {
        kind: 'added',
        items: [
          {
            en: 'Server status now shows the server IPv4 and a real availability check.',
            ru: 'В статусе сервера — IPv4 и индикатор доступности (реальная проверка).',
          },
        ],
      },
      {
        kind: 'changed',
        items: [
          {
            en: 'Chart colours: CPU and RAM green, network and traffic yellow.',
            ru: 'Цвета графиков: процессор и память — зелёные, сеть и трафик — жёлтые.',
          },
          {
            en: 'Config details: “Advanced settings” moved above the server status.',
            ru: 'В детали конфига «Дополнительные настройки» подняты над статусом сервера.',
          },
          {
            en: 'Traffic chart bars now align to the left.',
            ru: 'Столбики графика трафика выровнены по левому краю.',
          },
          {
            en: 'Hardened security & reliability (strict CSP, scanners, more tests).',
            ru: 'Усилены безопасность и надёжность (строгий CSP, сканеры, больше тестов).',
          },
        ],
      },
    ],
  },
  {
    version: '1.3',
    date: '2026-06-11',
    groups: [
      {
        kind: 'added',
        items: [
          {
            en: 'Daily traffic chart in the admin panel.',
            ru: 'График трафика по дням в админ-панели.',
          },
          {
            en: 'Haptic feedback when scrubbing charts.',
            ru: 'Тактильный отклик на графиках при перетаскивании.',
          },
        ],
      },
      {
        kind: 'changed',
        items: [
          {
            en: 'Unified chart style with a drag-to-inspect tooltip.',
            ru: 'Единый стиль графиков с подсказкой при перетаскивании.',
          },
          {
            en: 'Shorter server-chart labels (CPU / RAM / Network).',
            ru: 'Подписи серверных графиков укорочены (Процессор / Память / Сеть).',
          },
        ],
      },
    ],
  },
  {
    version: '1.2',
    date: '2026-06-10',
    groups: [
      {
        kind: 'fixed',
        items: [
          {
            en: 'Switching tabs no longer reloads data from scratch.',
            ru: 'Переключение вкладок больше не сбрасывает загруженные данные.',
          },
        ],
      },
      {
        kind: 'changed',
        items: [
          {
            en: 'Hardened security & stability (sign-in brute-force protection, stricter limits).',
            ru: 'Усилены безопасность и стабильность (защита входа от перебора, строгие лимиты).',
          },
        ],
      },
    ],
  },
  {
    version: '1.1',
    date: '2026-05-29',
    groups: [
      {
        kind: 'added',
        items: [
          {
            en: 'Settings: profile, connected devices, device limit, language.',
            ru: 'Настройки: профиль, подключённые устройства, лимит устройств, язык.',
          },
          {
            en: 'Per-device accounting and the admin panel.',
            ru: 'Учёт по устройствам и админ-панель.',
          },
        ],
      },
    ],
  },
  {
    version: '1.0',
    date: '2026-05-27',
    groups: [
      {
        kind: 'added',
        items: [
          {
            en: 'Launch: VLESS + REALITY and AmneziaWG, Mini App and Telegram bot.',
            ru: 'Запуск: VLESS + REALITY и AmneziaWG, мини-приложение и Telegram-бот.',
          },
        ],
      },
    ],
  },
]

/** Current version = newest release. Drives the badge in About. */
export const APP_VERSION = RELEASES[0]?.version ?? '1.0'
