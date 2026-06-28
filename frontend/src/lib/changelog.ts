// User-facing release notes shown in About → "What's new".
//
// SINGLE SOURCE: add one entry here when you ship a release and BOTH the
// in-app updates list AND the version badge update automatically — nothing
// else to touch in the UI. (Developer-facing detail lives in /CHANGELOG.md.)
// Keep entries newest-first; group items by kind (added / changed / fixed) and
// keep each line short and user-facing.

export type ChangeKind = 'added' | 'changed' | 'fixed'

export interface ChangeGroup {
  kind: ChangeKind
  items: { en: string; ru: string }[]
}

/** A refinement (X.Y.Z) shipped under a capsule — its own date + breakdown. */
export interface PatchNote {
  version: string
  /** YYYY-MM-DD */
  date: string
  groups: ChangeGroup[]
}

/** A capsule = a feature update (X.Y). Newest-first; patches newest-first too. */
export interface ReleaseNote {
  version: string
  /** YYYY-MM-DD */
  date: string
  groups: ChangeGroup[]
  /** Refinements (X.Y.Z) released under this capsule, newest-first. */
  patches?: PatchNote[]
}

export const RELEASES: ReleaseNote[] = [
  {
    version: '2.6',
    date: '2026-06-28',
    groups: [
      {
        kind: 'changed',
        items: [
          {
            en: 'More reliable payments — incoming crypto is matched more strictly and credited atomically, so a paid renewal always lands.',
            ru: 'Надёжнее оплата — входящие крипто-платежи сверяются строже и зачисляются атомарно, поэтому оплаченное продление всегда срабатывает.',
          },
          {
            en: 'Faster to open — the Payment and Usage screens now load on demand instead of upfront.',
            ru: 'Быстрее открывается — экраны «Оплата» и «Использование» подгружаются по необходимости, а не сразу.',
          },
          {
            en: 'Update history — refinements appear inline inside each update, so you see the update and all its refinements at once.',
            ru: 'История обновлений — доработки показываются прямо внутри обновления, так что вы сразу видите и само обновление, и все его доработки.',
          },
          {
            en: 'Better accessibility — form fields are labelled and keyboard focus stays inside open windows.',
            ru: 'Лучше доступность — у полей ввода есть подписи, а фокус клавиатуры остаётся внутри открытого окна.',
          },
        ],
      },
    ],
  },
  {
    version: '2.5',
    date: '2026-06-26',
    groups: [
      {
        kind: 'added',
        items: [
          {
            en: 'Home dashboard — at-a-glance Devices and Usage widgets right on the main screen; tap either to open the full view.',
            ru: 'Главный экран-дэшборд — виджеты «Устройства» и «Использование» прямо на главной; тап по любому открывает подробности.',
          },
          {
            en: 'Pull to refresh — drag down on the home, Payment, Devices, Usage, history, server-stats and admin screens to reload, with a haptic tick.',
            ru: 'Потяните вниз, чтобы обновить — на главном, в «Оплате», «Устройствах», «Использовании», истории, статусах сервера и в админке, с лёгким хаптиком.',
          },
        ],
      },
      {
        kind: 'changed',
        items: [
          {
            en: 'Device limit moved onto the Devices screen — now shown right above the device list.',
            ru: 'Лимит устройств переехал на экран «Устройства» — теперь прямо над списком устройств.',
          },
          {
            en: 'Clearer first run — the welcome and activation screens now say it’s a VPN and show the app’s mark.',
            ru: 'Понятнее первый запуск — экраны входа и активации теперь явно говорят, что это VPN, и показывают знак приложения.',
          },
          {
            en: 'Smoother loading — screens now show a matching placeholder instead of a jump, and boot shows a slim progress bar instead of a spinner.',
            ru: 'Плавнее загрузка — экраны теперь показывают аккуратный плейсхолдер вместо «прыжка», а при запуске — тонкая полоска прогресса вместо крутилки.',
          },
        ],
      },
      {
        kind: 'fixed',
        items: [
          {
            en: 'TON-wallet sheet no longer shows its name twice.',
            ru: 'В окне TON-кошелька название больше не дублируется.',
          },
        ],
      },
    ],
    patches: [
      {
        version: '2.5.5',
        date: '2026-06-27',
        groups: [
          {
            kind: 'changed',
            items: [
              {
                en: 'Update history is now organized into capsules — open one to see the update and all its refinements.',
                ru: 'История обновлений теперь разложена по капсулам — откройте капсулу, чтобы увидеть само обновление и все его доработки.',
              },
              {
                en: 'Polished the dropdown selection — a rounded pill highlight, consistent everywhere.',
                ru: 'Аккуратнее выбор в выпадающих списках — скруглённая «таблетка», единообразно везде.',
              },
            ],
          },
          {
            kind: 'fixed',
            items: [
              {
                en: 'Activating a key can no longer be submitted twice, and payment polling now stops cleanly.',
                ru: 'Активацию ключа больше нельзя отправить дважды, а опрос оплаты корректно завершается.',
              },
            ],
          },
        ],
      },
      {
        version: '2.5.4',
        date: '2026-06-27',
        groups: [
          {
            kind: 'changed',
            items: [
              {
                en: 'A unified round-icon system across all list rows for a cleaner, more consistent look.',
                ru: 'Единая система круглых иконок во всех строках списков — чище и единообразнее.',
              },
              {
                en: 'Globe and Moon icons on the Language and Theme rows in Settings.',
                ru: 'Иконки глобуса и луны у строк «Язык» и «Тема» в настройках.',
              },
            ],
          },
        ],
      },
      {
        version: '2.5.3',
        date: '2026-06-27',
        groups: [
          {
            kind: 'changed',
            items: [
              {
                en: 'Sheet headers now scroll with the content, for a more native feel.',
                ru: 'Шапки листов теперь листаются вместе с содержимым — нативнее ощущение.',
              },
              {
                en: 'Refined true-black dark theme (iOS palette).',
                ru: 'Доработана тёмная тема «по-настоящему чёрная» (палитра iOS).',
              },
            ],
          },
          {
            kind: 'fixed',
            items: [
              {
                en: 'No more stuck loading skeletons — screens refresh in the foreground.',
                ru: 'Скелетоны загрузки больше не «залипают» — экраны обновляются на переднем плане.',
              },
              {
                en: 'Dropdown menus are never clipped, and tab/navigation no longer flickers.',
                ru: 'Выпадающие меню больше не обрезаются, а вкладки и навигация не мерцают.',
              },
            ],
          },
        ],
      },
      {
        version: '2.5.2',
        date: '2026-06-26',
        groups: [
          {
            kind: 'added',
            items: [
              {
                en: 'Pull to refresh — drag down on any screen or sheet to reload, with an elastic bounce.',
                ru: 'Потяните вниз, чтобы обновить — на любом экране и листе, с упругим откликом.',
              },
            ],
          },
          {
            kind: 'changed',
            items: [
              {
                en: 'Smoother loading — a home skeleton and a slim boot progress bar instead of a spinner.',
                ru: 'Плавнее загрузка — скелетон на главной и тонкая полоска прогресса при запуске вместо крутилки.',
              },
              {
                en: 'Native two-way overscroll everywhere.',
                ru: 'Нативный двусторонний оверскролл по всему приложению.',
              },
            ],
          },
        ],
      },
      {
        version: '2.5.1',
        date: '2026-06-26',
        groups: [
          {
            kind: 'changed',
            items: [
              {
                en: 'Refined home — the brand mark as a clean circle, tidier hero icons and consistent spacing.',
                ru: 'Доработана главная — фирменный знак чистым кругом, аккуратнее иконки и единые отступы.',
              },
              {
                en: 'The device limit is a compact inline wheel that saves automatically, right above the device list.',
                ru: 'Лимит устройств — компактное встроенное «колесо» с автосохранением, прямо над списком устройств.',
              },
              {
                en: 'Slimmer Settings.',
                ru: 'Компактнее настройки.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '2.4',
    date: '2026-06-26',
    groups: [
      {
        kind: 'changed',
        items: [
          {
            en: 'A more unified look — one consistent “liquid glass” material across the tab bar, menus and notifications, with cleaner buttons and toggles.',
            ru: 'Более цельный вид — единое «жидкое стекло» для таб-бара, меню и уведомлений, чище кнопки и переключатели.',
          },
          {
            en: 'More tactile — buttons and list rows respond to your touch with a gentle press and a light haptic tick, like a native app.',
            ru: 'Тактильнее — кнопки и строки списков отзываются на касание лёгким нажатием и хаптиком, как в нативных приложениях.',
          },
          {
            en: 'Smoother navigation — the active-tab highlight now glides between tabs, and lists appear with a light cascade.',
            ru: 'Плавнее навигация — подсветка активной вкладки скользит между вкладками, а списки появляются лёгким каскадом.',
          },
          {
            en: 'Faster to open — the app is split into smaller parts that load on demand, so first paint and repeat opens are quicker.',
            ru: 'Быстрее открывается — приложение разбито на части, которые грузятся по мере надобности, поэтому первый и повторные запуски шустрее.',
          },
          {
            en: 'Quicker stats — charts load on demand, so the usage and server screens open faster.',
            ru: 'Шустрее статистика — графики подгружаются по необходимости, поэтому экраны использования и сервера открываются быстрее.',
          },
          {
            en: 'A more consistent feel everywhere — the Payment and Admin screens match the new style, and copying a link gives a light tap of feedback.',
            ru: 'Единообразнее по всему приложению — экраны «Оплата» и «Админка» приведены к новому стилю, а копирование ссылки отзывается лёгким откликом.',
          },
        ],
      },
    ],
    patches: [
      {
        version: '2.4.3',
        date: '2026-06-26',
        groups: [
          {
            kind: 'fixed',
            items: [
              {
                en: 'More reliable loading across all screens — no more stuck skeletons, and the Payment screen loads dependably.',
                ru: 'Надёжнее загрузка на всех экранах — без «залипших» скелетонов, а экран «Оплата» грузится стабильно.',
              },
            ],
          },
          {
            kind: 'changed',
            items: [
              {
                en: 'A smooth cross-fade between tabs and a stronger frosted-glass material.',
                ru: 'Плавный переход между вкладками и более выразительное «матовое стекло».',
              },
            ],
          },
        ],
      },
      {
        version: '2.4.2',
        date: '2026-06-26',
        groups: [
          {
            kind: 'changed',
            items: [
              {
                en: 'Self-hosted fonts — faster, privacy-friendly loading with no third-party font CDN.',
                ru: 'Свои шрифты — быстрее и приватнее, без стороннего CDN шрифтов.',
              },
            ],
          },
          {
            kind: 'fixed',
            items: [
              {
                en: 'Security hardening.',
                ru: 'Усилена безопасность.',
              },
            ],
          },
        ],
      },
      {
        version: '2.4.1',
        date: '2026-06-26',
        groups: [
          {
            kind: 'changed',
            items: [
              {
                en: 'Faster stats — charts load on demand.',
                ru: 'Шустрее статистика — графики подгружаются по необходимости.',
              },
              {
                en: 'A consistency pass across the Payment and Admin screens.',
                ru: 'Проход на единообразие по экранам «Оплата» и «Админка».',
              },
              {
                en: 'Configs are no longer named — we don’t store config names.',
                ru: 'У конфигов больше нет названий — мы не храним имена конфигураций.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '2.3',
    date: '2026-06-26',
    groups: [
      {
        kind: 'changed',
        items: [
          {
            en: 'Cleaner header — the avatar and wallet capsules now scroll together with the page (no more content peeking out from under a fixed bar), the divider line is gone, and the capsules are a touch larger.',
            ru: 'Чище шапка — капсулы аватара и кошелька теперь листаются вместе со страницей (контент больше не проглядывает из-под закреплённой панели), разделительная линия убрана, а сами капсулы чуть крупнее.',
          },
          {
            en: 'Pop-up windows sit still — they no longer drag around (like TON Connect); close them with the ✕ or a tap on the dimmed area above.',
            ru: 'Всплывающие окна зафиксированы — их больше нельзя сдвинуть (как в TON Connect); закрытие крестиком или тапом по затемнённой области сверху.',
          },
          {
            en: 'Snappier, smoother transitions — sheets and screens open faster, closer to a native feel.',
            ru: 'Быстрее и плавнее переходы — листы и экраны открываются шустрее, ближе к нативному ощущению.',
          },
        ],
      },
      {
        kind: 'fixed',
        items: [
          {
            en: 'Clearer Privacy Policy — corrected what we store (we don’t keep configuration names) and made it explicit that you delete your account inside the app, not via Telegram.',
            ru: 'Точнее Политика конфиденциальности — исправлено, что мы храним (названия конфигураций не хранятся), и явно указано, что аккаунт удаляется в приложении, а не через Telegram.',
          },
        ],
      },
    ],
  },
  {
    version: '2.2',
    date: '2026-06-26',
    groups: [
      {
        kind: 'changed',
        items: [
          {
            en: 'Smoother interface — menus and expandable sections now open with a gentle fade instead of popping.',
            ru: 'Плавнее интерфейс — меню и разворачивающиеся блоки открываются мягким появлением, без рывков.',
          },
          {
            en: 'A more consistent look — unified section headers, buttons and loading indicators across the app.',
            ru: 'Единообразный вид — общий стиль заголовков, кнопок и индикаторов загрузки по всему приложению.',
          },
        ],
      },
    ],
    patches: [
      {
        version: '2.2.1',
        date: '2026-06-26',
        groups: [
          {
            kind: 'changed',
            items: [
              {
                en: 'Clearer payment — the buttons now say how you pay (in your wallet / directly), for both new and renewing subscriptions.',
                ru: 'Понятнее оплата — кнопки показывают способ (в кошельке / напрямую), и при покупке, и при продлении.',
              },
            ],
          },
          {
            kind: 'fixed',
            items: [
              {
                en: 'An expired subscription now keeps your config and connection link — it just pauses. Renew and your existing link works again (refresh the subscription in your app).',
                ru: 'Истёкшая подписка больше не удаляет конфиг и ссылку — она просто приостанавливается. Продлите — и ваша же ссылка снова работает (обновите подписку в приложении).',
              },
              {
                en: 'Steadier navigation — the top bar (avatar + wallet) and its divider stay put as you move around, and sheets close more reliably from the avatar.',
                ru: 'Стабильнее навигация — верхняя панель (аватар + кошелёк) и линия не дёргаются при переходах, а листы надёжнее закрываются по аватарке.',
              },
            ],
          },
        ],
      },
    ],
  },
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
