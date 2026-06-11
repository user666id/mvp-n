// User-facing release notes shown in About → "What's new".
//
// SINGLE SOURCE: add one entry here when you ship a release and BOTH the
// in-app updates list AND the version badge update automatically — nothing
// else to touch in the UI. (Developer-facing detail lives in /CHANGELOG.md.)
// Keep entries newest-first; keep each line short and user-facing.

export interface ReleaseNote {
  version: string
  /** YYYY-MM-DD */
  date: string
  items: { en: string; ru: string }[]
}

export const RELEASES: ReleaseNote[] = [
  {
    version: '1.3',
    date: '2026-06-11',
    items: [
      { en: 'Daily traffic chart in the admin panel.', ru: 'График трафика по дням в админ-панели.' },
      {
        en: 'Unified chart style with drag-to-inspect and haptic feedback.',
        ru: 'Единый стиль графиков: перетаскивание с подсказкой и тактильный отклик.',
      },
    ],
  },
  {
    version: '1.2',
    date: '2026-06-10',
    items: [
      {
        en: 'Smoother interface — tabs no longer reload from scratch on every switch.',
        ru: 'Плавный интерфейс — вкладки больше не перезагружаются при каждом переключении.',
      },
      {
        en: 'Security & reliability hardening: sign-in brute-force protection, stricter limits.',
        ru: 'Усиление безопасности и стабильности: защита входа от перебора, строгие лимиты.',
      },
    ],
  },
  {
    version: '1.1',
    date: '2026-05-29',
    items: [
      {
        en: 'Settings: profile, connected devices, device limit, language.',
        ru: 'Настройки: профиль, подключённые устройства, лимит устройств, язык.',
      },
      { en: 'Per-device accounting and the admin panel.', ru: 'Учёт по устройствам и админ-панель.' },
    ],
  },
  {
    version: '1.0',
    date: '2026-05-27',
    items: [
      {
        en: 'Launch: VLESS + REALITY and AmneziaWG, Mini App and Telegram bot.',
        ru: 'Запуск: VLESS + REALITY и AmneziaWG, мини-приложение и Telegram-бот.',
      },
    ],
  },
]

/** Current version = newest release. Drives the badge in About. */
export const APP_VERSION = RELEASES[0]?.version ?? '1.0'
