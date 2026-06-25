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
    version: '2.1',
    date: '2026-06-25',
    groups: [
      {
        kind: 'changed',
        items: [
          {
            en: 'Redesigned config screen — a globe + country header with the full protocol spec, a one-tap “Add to app”, and the subscription link, QR, formats and settings gathered into one tidy card.',
            ru: 'Переработан экран конфига — шапка с глобусом и страной и полной спецификацией протокола, «Установить в приложение» в один тап, а ссылка, QR, форматы и настройки собраны в одну аккуратную карточку.',
          },
          {
            en: 'Rebuilt install guide — pick your OS and app by icon, with a clear 1·2·3 (install → add → connect).',
            ru: 'Переделан экран установки — выбор ОС и приложения иконками и понятные шаги 1·2·3 (установить → добавить → подключить).',
          },
          {
            en: 'New Payment screen — pick the plan and payment method right there; key activation and payment history moved into your profile. A config now comes with your subscription (one per account).',
            ru: 'Новый экран «Оплата» — выбор тарифа и способа оплаты прямо на экране; активация ключа и история платежей переехали в профиль. Конфиг теперь создаётся вместе с подпиской (один на аккаунт).',
          },
          {
            en: 'Refreshed dark theme (Standard) — lighter cards on a darker page for a cleaner, more native look.',
            ru: 'Обновлённая тёмная тема («Стандарт») — светлее карточки на более тёмном фоне, чище и роднее.',
          },
          {
            en: 'Wallet moved to a capsule in the header on every screen — tap to connect, copy, or disconnect.',
            ru: 'Кошелёк переехал в капсулу в шапке на всех экранах — тап, чтобы подключить, скопировать или отключить.',
          },
          {
            en: 'New configs are created in Enhanced mode by default — they connect right away.',
            ru: 'Новые конфиги создаются в усиленном режиме по умолчанию — сразу подключаются.',
          },
        ],
      },
      {
        kind: 'fixed',
        items: [
          {
            en: 'More reliable devices — blocking or deleting one no longer affects the others, and active devices don’t disappear on their own.',
            ru: 'Надёжнее устройства — блокировка или удаление одного больше не влияет на остальные, а активные устройства не пропадают сами.',
          },
          {
            en: 'Everything loads and refreshes the same way — screens update instantly after an action and on returning to the app, with no late-loading wallet.',
            ru: 'Единые загрузка и обновление — экраны обновляются сразу после действия и при возврате в приложение, а кошелёк больше не подгружается с задержкой.',
          },
          {
            en: 'No white flash on launch — the app opens straight into your theme.',
            ru: 'Нет белой вспышки при запуске — приложение сразу открывается в вашей теме.',
          },
          {
            en: 'More stable connection.',
            ru: 'Стабильнее подключение.',
          },
        ],
      },
    ],
  },
  {
    version: '2.0',
    date: '2026-06-23',
    groups: [
      {
        kind: 'added',
        items: [
          {
            en: 'Usage — see your own traffic by day, right in the app.',
            ru: '«Использование» — ваш трафик по дням прямо в приложении.',
          },
          {
            en: 'Connect a TON wallet from your profile — tap the avatar, then the wallet.',
            ru: 'Подключение TON-кошелька прямо из профиля — тап по аватару, затем кошелёк.',
          },
        ],
      },
      {
        kind: 'changed',
        items: [
          {
            en: 'A fresh iOS-style “liquid glass” look — frosted bars and buttons, rounder cards, smooth animations.',
            ru: 'Свежий вид в стиле iOS «жидкое стекло» — матовые панели и кнопки, круглее карточки, плавные анимации.',
          },
          {
            en: 'New navigation — bottom tabs (Configs · Subscription), with your account behind the avatar.',
            ru: 'Новая навигация — нижние вкладки (Конфиги · Подписка), а аккаунт — по тапу на аватар.',
          },
          {
            en: 'One-tap “Add subscription” now works on desktop too (Windows / macOS / Linux).',
            ru: '«Добавить подписку» в один тап теперь работает и на компьютере (Windows / macOS / Linux).',
          },
          {
            en: 'Faster, smoother start — a branded loading screen and the native back button.',
            ru: 'Быстрее и плавнее запуск — фирменный экран загрузки и нативная кнопка «назад».',
          },
        ],
      },
    ],
  },
  {
    version: '1.9',
    date: '2026-06-20',
    groups: [
      {
        kind: 'changed',
        items: [
          {
            en: 'A full visual refresh — one consistent style: green for status, orange for actions, neutral for info.',
            ru: 'Полное обновление вида — единый стиль: зелёный для статусов, оранжевый для действий, нейтральный для информации.',
          },
          {
            en: 'Redesigned subscription — plans show their saving up front, prices appear in your currency, with official coin icons.',
            ru: 'Переработана подписка — у тарифов сразу видна выгода, цены показываются в вашей валюте, добавлены официальные значки монет.',
          },
          {
            en: 'USDT lets you pick the network — TON or TRC20.',
            ru: 'У USDT можно выбрать сеть — TON или TRC20.',
          },
          {
            en: 'The admin panel is now a top-level tab (admins only).',
            ru: 'Админ-панель теперь обычная вкладка (только для админов).',
          },
          {
            en: 'New “Fragment” dark theme — a blue palette, alongside Standard and Black.',
            ru: 'Новая тёмная тема «Fragment» — синяя палитра, рядом со Стандартной и Чёрной.',
          },
        ],
      },
      {
        kind: 'fixed',
        items: [
          {
            en: 'The GRAM price is now live and accurate — it tracks the real exchange rate.',
            ru: 'Цена в GRAM теперь живая и точная — по реальному курсу.',
          },
          {
            en: 'Your VPN app now shows when the subscription ends.',
            ru: 'VPN-приложение теперь показывает, когда заканчивается подписка.',
          },
        ],
      },
    ],
  },
  {
    version: '1.8',
    date: '2026-06-18',
    groups: [
      {
        kind: 'added',
        items: [
          {
            en: 'Pay with Telegram Stars — buy or renew inside Telegram, no wallet or crypto needed.',
            ru: 'Оплата в Telegram Stars — покупка и продление прямо в Telegram, без кошелька и крипты.',
          },
          {
            en: 'You can enter an access key when renewing too, not only on first activation.',
            ru: 'Ключ доступа теперь можно ввести и при продлении, не только при первой активации.',
          },
        ],
      },
      {
        kind: 'changed',
        items: [
          {
            en: 'Fewer taps to pay — method, plan and the Pay button on one screen.',
            ru: 'Меньше шагов до оплаты — способ, тариф и кнопка оплаты на одном экране.',
          },
          {
            en: 'Cheaper long plans — 90 days and 1 year cost less per day.',
            ru: 'Длинные тарифы дешевле — 90 дней и 1 год выгоднее в пересчёте на день.',
          },
          {
            en: 'The app auto-updates to the latest version when you open it.',
            ru: 'Приложение само обновляется до последней версии при открытии.',
          },
        ],
      },
    ],
  },
  {
    version: '1.7',
    date: '2026-06-16',
    groups: [
      {
        kind: 'added',
        items: [
          {
            en: 'Pay from your TON wallet via TON Connect (Telegram Wallet, Tonkeeper) — GRAM and USDT-TON.',
            ru: 'Оплата из TON-кошелька через TON Connect (Telegram Wallet, Tonkeeper) — GRAM и USDT-TON.',
          },
        ],
      },
    ],
  },
  {
    version: '1.6',
    date: '2026-06-16',
    groups: [
      {
        kind: 'added',
        items: [
          {
            en: 'Access keys can grant a fixed term (7 / 30 / 90 / 365 days), not only lifetime.',
            ru: 'Ключи доступа могут давать доступ на срок (7 / 30 / 90 / 365 дней), а не только бессрочно.',
          },
        ],
      },
      {
        kind: 'changed',
        items: [
          {
            en: 'Source code is now public (AGPL-3.0) — a link to the open mirror is under About.',
            ru: 'Исходный код теперь открыт (AGPL-3.0) — ссылка на зеркало в «О сервисе».',
          },
          {
            en: 'Rewritten Help — clearer answers and a step-by-step on how to connect.',
            ru: 'Переписан раздел «Помощь» — понятнее ответы и пошаговое подключение.',
          },
        ],
      },
      {
        kind: 'fixed',
        items: [
          {
            en: 'AmneziaWG traffic is now counted in your usage stats (previously VLESS only).',
            ru: 'Трафик AmneziaWG теперь учитывается в статистике (раньше только VLESS).',
          },
        ],
      },
    ],
  },
  {
    version: '1.5',
    date: '2026-06-15',
    groups: [
      {
        kind: 'added',
        items: [
          {
            en: 'Paid subscriptions — pay with crypto (GRAM or USDT on TON / TRC20), or activate a key for lifetime access.',
            ru: 'Платные подписки — оплата криптой (GRAM или USDT, сети TON / TRC20) или активация по ключу с бессрочным доступом.',
          },
          {
            en: 'Subscription section — status, renewal and payment history.',
            ru: 'Раздел «Подписка» — статус, продление и история платежей.',
          },
        ],
      },
      {
        kind: 'fixed',
        items: [
          {
            en: 'Devices and profile no longer get stuck on a flaky connection.',
            ru: 'Устройства и профиль больше не «зависают» при плохой связи.',
          },
        ],
      },
    ],
  },
  {
    version: '1.4',
    date: '2026-06-12',
    groups: [
      {
        kind: 'added',
        items: [
          {
            en: 'Server status now shows the IPv4 and a real availability check.',
            ru: 'В статусе сервера — IPv4 и реальная проверка доступности.',
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
            en: 'Daily traffic charts with a drag-to-inspect tooltip.',
            ru: 'Графики трафика по дням с подсказкой при перетаскивании.',
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
            en: 'Settings — profile, connected devices, device limit and language; per-device accounting and the admin panel.',
            ru: 'Настройки — профиль, устройства, лимит устройств и язык; учёт по устройствам и админ-панель.',
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
            en: 'Launch — VLESS + REALITY and AmneziaWG, the Mini App and a Telegram bot.',
            ru: 'Запуск — VLESS + REALITY и AmneziaWG, мини-приложение и Telegram-бот.',
          },
        ],
      },
    ],
  },
]

/** Current version = newest release. Drives the badge in About. */
export const APP_VERSION = RELEASES[0]?.version ?? '1.0'
