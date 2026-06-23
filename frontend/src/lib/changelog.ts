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
    version: '1.9',
    date: '2026-06-20',
    groups: [
      {
        kind: 'changed',
        items: [
          {
            en: 'A full visual refresh — one consistent style across the app: green for status, orange for actions, neutral for info, with tidier titles, selectors and cards.',
            ru: 'Полное обновление вида — единый стиль по всему приложению: зелёный для статусов, оранжевый для действий, нейтральный для информации; аккуратнее заголовки, переключатели и карточки.',
          },
          {
            en: 'Redesigned subscription — plans show their saving up front and prices appear right away in your currency, with official coin icons (GRAM, USDT, Stars).',
            ru: 'Переработана подписка — у тарифов сразу видна выгода, а цены показываются в выбранной валюте; добавлены официальные значки монет (GRAM, USDT, Stars).',
          },
          {
            en: 'USDT now lets you pick the network — choose TON or TRC20 from a dropdown right on the payment method.',
            ru: 'У USDT теперь можно выбрать сеть — TON или TRC20 из выпадающего списка прямо на способе оплаты.',
          },
          {
            en: 'Cleaner Settings and About — your profile, billing and usage sit in one "Account" group, with less clutter.',
            ru: 'Чище «Настройки» и «О сервисе» — профиль, оплата и использование в одной группе «Аккаунт», без лишнего.',
          },
          {
            en: 'Smoother loading — content gently fades in instead of popping.',
            ru: 'Плавнее загрузка — контент мягко проявляется, а не «выскакивает».',
          },
          {
            en: 'The admin panel is now a top-level tab, like Configs and Settings (admins only).',
            ru: 'Админ-панель теперь обычная вкладка, как «Конфиги» и «Настройки» (только для админов).',
          },
          {
            en: 'Installing into a VPN app is now guided — pick your phone (iOS / Android) and launcher to get the right App Store (RU / Global) or Google Play link, then one tap adds the subscription.',
            ru: 'Установка в VPN-приложение теперь с подсказками — выбираешь телефон (iOS / Android) и лаунчер, получаешь нужную ссылку App Store (RU / Global) или Google Play, и одним тапом добавляешь подписку.',
          },
          {
            en: 'Payment history matches the new style — the amount with its coin icon, and the date underneath.',
            ru: 'История платежей в новом стиле — сумма со значком монеты, а под ней дата.',
          },
          {
            en: 'New "Fragment" dark theme — a blue palette in Settings, alongside Warm and Black.',
            ru: 'Новая тёмная тема «Fragment» — синяя палитра в настройках, рядом с Тёплой и Чёрной.',
          },
        ],
      },
      {
        kind: 'fixed',
        items: [
          {
            en: 'The GRAM price is now live and accurate — it tracks the real exchange rate and is fresh from the moment you open the payment screen.',
            ru: 'Цена в GRAM теперь живая и точная — следует реальному курсу и актуальна сразу при открытии экрана оплаты.',
          },
          {
            en: 'Your VPN app now shows when the subscription ends — the expiry date is passed through to the client.',
            ru: 'VPN-приложение теперь показывает, когда заканчивается подписка — дата окончания передаётся в клиент.',
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
            en: 'Pay with Telegram Stars — buy or renew right inside Telegram, no wallet or crypto needed.',
            ru: 'Оплата в Telegram Stars — купить или продлить прямо в Telegram, без кошелька и крипты.',
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
            en: 'Fewer taps to pay — method, plan and the Pay button now live on one screen (the separate confirmation step is gone).',
            ru: 'Меньше шагов до оплаты — способ, тариф и кнопка оплаты теперь на одном экране (отдельный шаг подтверждения убран).',
          },
          {
            en: 'Cheaper long plans — 90 days and 1 year cost less, with a real per-day discount the longer you go.',
            ru: 'Длинные тарифы дешевле — 90 дней и 1 год стоят меньше, и чем дольше срок, тем выгоднее день.',
          },
          {
            en: 'The admin panel moved to the main menu (admins only).',
            ru: 'Панель администратора перенесена в главное меню (только для админов).',
          },
          {
            en: 'Sign-in now asks you to accept the Usage and Privacy policies (with links); the policies were updated for the EU/GDPR.',
            ru: 'При входе теперь нужно принять Политику использования и конфиденциальности (со ссылками); политики обновлены под ЕС/GDPR.',
          },
          {
            en: 'The app auto-updates to the latest version when you open it — no more stale screens after an update.',
            ru: 'Приложение само обновляется до последней версии при открытии — больше нет старых экранов после апдейта.',
          },
          {
            en: 'Dark background now has two shades — Warm (default) and Black; the legal and open-app pages follow your theme.',
            ru: 'У тёмного фона теперь два оттенка — Тёплый (по умолчанию) и Чёрный; страницы политик и открытия приложения следуют теме.',
          },
          {
            en: 'About → Licenses now lists every third-party component.',
            ru: 'В «О сервисе → Лицензии» теперь весь список сторонних компонентов.',
          },
        ],
      },
      {
        kind: 'fixed',
        items: [
          {
            en: 'Paying GRAM from a wallet now opens TON Connect correctly (connect, then pay), same as USDT-TON.',
            ru: 'Оплата GRAM из кошелька теперь корректно открывает TON Connect (подключение, затем оплата) — как и у USDT-TON.',
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
            en: 'Pay from your TON wallet via TON Connect (Telegram Wallet, Tonkeeper) — for both GRAM and USDT-TON.',
            ru: 'Оплата из TON-кошелька через TON Connect (Telegram Wallet, Tonkeeper) — для GRAM и USDT-TON.',
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
            en: 'A review step before payment — check the plan, currency and amount, then confirm.',
            ru: 'Шаг подтверждения перед оплатой — проверяете тариф, валюту и сумму, затем подтверждаете.',
          },
        ],
      },
      {
        kind: 'changed',
        items: [
          {
            en: 'Settings reorganised — notifications now live under “App”, and subscription is part of “Subscription & connection”.',
            ru: 'Настройки переустроены — уведомления теперь в разделе «Приложение», а подписка объединена с подключением.',
          },
          {
            en: 'The success screen now tells a first purchase apart from a renewal.',
            ru: 'Экран успешной оплаты теперь различает первую покупку и продление.',
          },
          {
            en: 'Consistent links and clearer icons throughout, plus a confirmation before anything destructive.',
            ru: 'Единообразные ссылки и понятные значки по всему приложению, а перед опасными действиями — подтверждение.',
          },
          {
            en: 'Rewritten Help section — clearer answers and a step-by-step on how to connect.',
            ru: 'Переписан раздел «Помощь» — понятнее ответы и пошаговая инструкция, как подключиться.',
          },
          {
            en: 'Access keys can now grant a fixed term (7/30/90/365 days), not only lifetime.',
            ru: 'Ключи доступа теперь могут давать доступ на срок (7/30/90/365 дней), а не только бессрочно.',
          },
          {
            en: 'Dark theme now has three background shades — Warm, Neutral and Black (Settings → App).',
            ru: 'У тёмной темы теперь три оттенка фона — Тёплый, Нейтральный и Чёрный (Настройки → Приложение).',
          },
          {
            en: 'Source code is now public — a link to the open mirror was added under About → Useful links.',
            ru: 'Исходный код теперь открыт — в «О сервисе → Полезные ссылки» добавлена ссылка на публичное зеркало.',
          },
          {
            en: 'Source relicensed to AGPL-3.0, and a Licenses section (third-party attributions) added under About.',
            ru: 'Код перелицензирован на AGPL-3.0, в «О сервисе» добавлен раздел «Лицензии» (сторонние компоненты).',
          },
        ],
      },
      {
        kind: 'fixed',
        items: [
          {
            en: 'The unfinished-payment list refreshes the moment you step back — no need to re-open the app.',
            ru: 'Список незавершённых платежей обновляется сразу при возврате — перезаходить больше не нужно.',
          },
          {
            en: 'AmneziaWG traffic is now counted in your usage stats (previously only VLESS was).',
            ru: 'Трафик AmneziaWG теперь учитывается в статистике (раньше считался только VLESS).',
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
            en: 'Subscription section with status, renewal and payment history (with transaction links).',
            ru: 'Раздел «Подписка»: статус, продление и история платежей (со ссылкой на транзакцию).',
          },
          {
            en: 'Legal documents — Usage Policy and Privacy Policy on the web (EN / RU).',
            ru: 'Юридические документы — «Политика использования» и «Политика конфиденциальности» в вебе (EN / RU).',
          },
        ],
      },
      {
        kind: 'changed',
        items: [
          {
            en: 'Cleaner interface — tidied settings and navigation, refined dark theme.',
            ru: 'Интерфейс стал чище — прибраны настройки и навигация, выверена тёмная тема.',
          },
          {
            en: 'Updated the VPN core and app libraries for security and freshness.',
            ru: 'Обновлены ядро VPN и библиотеки приложения — безопасность и актуальность.',
          },
        ],
      },
      {
        kind: 'fixed',
        items: [
          {
            en: 'Devices and profile no longer get stuck on a flaky connection; an unfinished payment resumes after a reload.',
            ru: 'Устройства и профиль больше не «зависают» при плохой связи; незавершённая оплата возобновляется после перезагрузки.',
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
            en: 'Server status now shows the server IPv4 and a real availability check.',
            ru: 'В статусе сервера — IPv4 и индикатор доступности (реальная проверка).',
          },
        ],
      },
      {
        kind: 'changed',
        items: [
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
