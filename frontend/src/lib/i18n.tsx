import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type Lang = 'en' | 'ru'
const STORAGE_KEY = 'mvpn_lang'

/** Translation table: key → per-language string. English is the default. */
const dict = {
  // ── common ───────────────────────────────────────────────────────────────
  'common.save': { en: 'Save', ru: 'Сохранить' },
  'common.cancel': { en: 'Cancel', ru: 'Отмена' },
  'common.close': { en: 'Close', ru: 'Закрыть' },
  'common.back': { en: 'Back', ru: 'Назад' },
  'common.delete': { en: 'Delete', ru: 'Удалить' },
  'common.copy': { en: 'Copy', ru: 'Копировать' },
  'common.copied': { en: 'Copied', ru: 'Скопировано' },
  'common.device': { en: 'Device', ru: 'Устройство' },
  'common.online': { en: 'online', ru: 'в сети' },
  'common.loadFailed': { en: 'Failed to load', ru: 'Не удалось загрузить' },
  'common.saveFailed': { en: 'Failed to save', ru: 'Не удалось сохранить' },

  // ── time ─────────────────────────────────────────────────────────────────
  'time.justNow': { en: 'just now', ru: 'только что' },
  'time.minutesAgo': { en: '{n}m ago', ru: '{n} {u} назад' },
  'time.hoursAgo': { en: '{n}h ago', ru: '{n} {u} назад' },
  'time.yesterday': { en: 'yesterday', ru: 'вчера' },
  'time.daysAgo': { en: '{n}d ago', ru: '{n} {u} назад' },

  // ── tabs ─────────────────────────────────────────────────────────────────
  'tab.configs': { en: 'Configs', ru: 'Конфиги' },
  'tab.settings': { en: 'Settings', ru: 'Настройки' },

  // ── auth / key ─────────────────────────────────────────────────────────────
  'auth.welcome': {
    en: 'Sign in with Telegram, then buy a subscription or activate an access key.',
    ru: 'Войдите через Telegram, затем оформите подписку или активируйте ключ доступа.',
  },
  'auth.login': { en: 'Sign in with Telegram', ru: 'Войти через Telegram' },
  'auth.loginFailed': { en: 'Sign-in failed', ru: 'Не удалось войти' },
  'key.title': { en: 'Access key', ru: 'Ключ доступа' },
  'key.activateTitle': { en: 'Activation', ru: 'Активация' },
  'key.activateHint': {
    en: 'Enter your access key.',
    ru: 'Введите ключ доступа.',
  },
  'key.hint': {
    en: 'One-time key from the administrator.',
    ru: 'Одноразовый ключ от администратора.',
  },
  'key.placeholder': { en: 'XXXX-XXXX', ru: 'XXXX-XXXX' },
  'key.activate': { en: 'Activate', ru: 'Активировать' },
  'key.or': { en: 'or', ru: 'или' },
  'key.invalid': { en: 'Invalid key', ru: 'Неверный ключ' },

  // ── configs ──────────────────────────────────────────────────────────────
  'configs.title': { en: 'Configs', ru: 'Конфиги' },
  'sub.unlimited': { en: 'Lifetime access', ru: 'Бессрочно' },
  'sub.until': { en: 'Active until {d}', ru: 'Активна до {d}' },
  'sub.expired': { en: 'Subscription expired', ru: 'Подписка истекла' },
  'sub.status': { en: 'Subscription', ru: 'Подписка' },
  'sub.lifetimeShort': { en: 'Lifetime', ru: 'Бессрочно' },
  'sub.none': { en: 'No subscription', ru: 'Нет подписки' },
  'sub.activeTitle': { en: 'Subscription active', ru: 'Подписка активна' },
  'sub.history': { en: 'Payment history', ru: 'История платежей' },
  'sub.historyEmpty': { en: 'No payments yet', ru: 'Платежей пока нет' },
  'sub.statusPaid': { en: 'Paid', ru: 'Оплачено' },
  'sub.statusExpired': { en: 'Expired', ru: 'Истёк' },
  'sub.viewTx': { en: 'View transaction', ru: 'Транзакция' },
  'sub.lifetimeHint': {
    en: 'Granted by an access key — it never expires.',
    ru: 'Доступ выдан по ключу — без срока действия.',
  },
  'sub.noneHint': {
    en: 'Buy a subscription or activate an access key to use the VPN.',
    ru: 'Купите подписку или активируйте ключ, чтобы пользоваться VPN.',
  },
  'sub.byKey': { en: 'Key', ru: 'Ключ' },
  'sub.byPaid': { en: 'Paid', ru: 'Оплата' },
  'sub.expiredHint': {
    en: 'Renew it to use the VPN and create configs again.',
    ru: 'Продлите, чтобы снова пользоваться VPN и создавать конфиги.',
  },
  'sub.renew': { en: 'Renew', ru: 'Продлить' },
  'sub.buy': { en: 'Buy subscription', ru: 'Купить подписку' },
  'sub.haveKey': { en: 'I have a key', ru: 'У меня есть ключ' },
  'sub.connectTitle': { en: 'Activate access', ru: 'Подключите доступ' },
  'sub.connectHint': {
    en: 'Buy a subscription or activate an access key to use the VPN.',
    ru: 'Купите подписку или активируйте ключ, чтобы пользоваться VPN.',
  },
  'pay.title': { en: 'Subscription', ru: 'Подписка' },
  'pay.currency': { en: 'Currency', ru: 'Валюта' },
  'pay.plan': { en: 'Plan', ru: 'Тариф' },
  'pay.pay': { en: 'Pay {a}', ru: 'Оплатить {a}' },
  'pay.d7': { en: '7 days', ru: '7 дней' },
  'pay.d30': { en: '30 days', ru: '30 дней' },
  'pay.d90': { en: '90 days', ru: '90 дней' },
  'pay.d365': { en: '365 days', ru: '365 дней' },
  'pay.sendExactly': { en: 'Send exactly', ru: 'Отправьте ровно' },
  'pay.network': { en: 'network', ru: 'сеть' },
  'pay.amount': { en: 'Amount', ru: 'Сумма' },
  'pay.waiting': { en: 'Waiting for payment…', ru: 'Ждём оплату…' },
  'pay.exactHint': {
    en: 'Send the exact amount — that’s how we match your payment.',
    ru: 'Отправьте точную сумму — по ней мы находим ваш платёж.',
  },
  'pay.autoHint': {
    en: 'Access opens automatically once the network confirms (usually 1–2 min). You can close this — the payment won’t be lost, just come back here.',
    ru: 'Доступ откроется автоматически после подтверждения в сети (обычно 1–2 мин). Можно закрыть — платёж не потеряется, просто вернитесь сюда.',
  },
  'pay.resumeTitle': { en: 'Unfinished payment', ru: 'Незавершённый платёж' },
  'pay.resumeBtn': { en: 'Continue', ru: 'Продолжить' },
  'pay.pendingTitle': { en: 'Payment processing', ru: 'Платёж обрабатывается' },
  'pay.pendingHint': {
    en: 'We’re waiting for the network to confirm your payment. Access opens automatically — usually within 1–2 minutes.',
    ru: 'Ждём подтверждения вашего платежа в сети. Доступ откроется автоматически — обычно в течение 1–2 минут.',
  },
  'pay.pendingView': { en: 'View payment', ru: 'Открыть оплату' },
  'pay.done': { en: 'Paid!', ru: 'Оплачено!' },
  'pay.doneHint': { en: 'Your subscription is extended.', ru: 'Подписка продлена.' },
  'pay.failed': { en: 'Couldn’t start payment', ru: 'Не удалось начать оплату' },
  'pay.expired': { en: 'Order expired', ru: 'Срок заказа истёк' },
  'configs.empty': {
    en: 'You don’t have any configs yet. Create your first one to connect.',
    ru: 'У вас пока нет конфигов. Создайте первый, чтобы подключиться.',
  },
  'configs.create': { en: 'Create config', ru: 'Создать конфиг' },
  'configs.created': { en: 'Config created', ru: 'Конфиг создан' },
  'configs.createFailed': { en: 'Failed to create config', ru: 'Не удалось создать конфиг' },
  'configs.deleted': { en: 'Config deleted', ru: 'Конфиг удалён' },
  'configs.loadFailed': { en: 'Failed to load configs', ru: 'Не удалось загрузить конфиги' },
  'configs.country': { en: 'Netherlands', ru: 'Нидерланды' },
  'server.online': { en: 'Server is up', ru: 'Сервер работает' },
  'server.offline': { en: 'Server is down', ru: 'Сервер недоступен' },
  'configs.count': { en: '{n} {u}', ru: '{n} {u}' },

  // ── admin ──────────────────────────────────────────────────────────────────
  'admin.title': { en: 'Admin panel', ru: 'Админ-панель' },
  'admin.keys': { en: 'Access keys', ru: 'Ключи доступа' },
  'admin.keysFooter': {
    en: 'One-time keys. Default TTL — 12 hours.',
    ru: 'Одноразовые ключи. TTL по умолчанию — 12 часов.',
  },
  'admin.keysEmpty': { en: 'No keys yet', ru: 'Пока нет ключей' },
  'admin.keysUnused': { en: 'Unused ({n})', ru: 'Не использованные ({n})' },
  'admin.keysUsed': { en: 'Used ({n})', ru: 'Использованные ({n})' },
  'admin.newKey': { en: 'New keys', ru: 'Новые ключи' },
  'admin.count': { en: 'Qty', ru: 'Кол-во' },
  'admin.generate': { en: 'Generate', ru: 'Сгенерировать' },
  'admin.keysGenerated': { en: 'Keys generated', ru: 'Ключи сгенерированы' },
  'admin.generateFailed': { en: 'Failed to generate', ru: 'Не удалось сгенерировать' },
  'admin.keyDeleteConfirm': { en: 'Delete this key?', ru: 'Удалить этот ключ?' },
  'admin.keyDeleted': { en: 'Key deleted', ru: 'Ключ удалён' },
  'admin.deleteFailed': { en: 'Failed to delete', ru: 'Не удалось удалить' },
  'admin.keyUsed': { en: 'used', ru: 'использован' },
  'admin.keyActive': { en: 'active', ru: 'активен' },
  'admin.keyExpired': { en: 'expired', ru: 'истёк' },
  'admin.keyCopied': { en: 'Key copied', ru: 'Ключ скопирован' },
  'admin.deleteKey': { en: 'Delete key', ru: 'Удалить ключ' },
  'admin.profilesCount': { en: 'Profiles', ru: 'Профилей' },
  'admin.trafficTotalShort': { en: 'Total', ru: 'Всего' },
  'admin.trafficTodayShort': { en: 'Today', ru: 'Сегодня' },
  'traffic.byDay': { en: 'By day', ru: 'По дням' },
  'traffic.empty': { en: 'No data yet', ru: 'Пока нет данных' },
  'admin.profiles': { en: 'Profiles', ru: 'Профили' },
  'admin.domains': { en: 'Status', ru: 'Статусы' },
  'admin.domainsWeb': { en: 'Web', ru: 'Веб' },
  'admin.domainsVpn': { en: 'VPN', ru: 'VPN' },
  'admin.domainsSvc': { en: 'Services', ru: 'Сервисы' },
  'admin.domainsSub': { en: 'Check reachability via Cloudflare', ru: 'Проверка доступности через Cloudflare' },
  'admin.domainOk': { en: 'online', ru: 'онлайн' },
  'admin.domainDown': { en: 'unreachable', ru: 'недоступен' },
  'admin.refresh': { en: 'Refresh', ru: 'Обновить' },
  'admin.devShort': { en: '{n} dev.', ru: '{n} устр.' },
  'admin.profileFallback': { en: 'Profile {id}', ru: 'Профиль {id}' },
  'admin.idCopied': { en: 'ID copied', ru: 'ID скопирован' },
  'admin.internalId': { en: 'Internal ID', ru: 'Внутренний ID' },
  'admin.configsCount': { en: 'Configs', ru: 'Конфигов' },
  'admin.devicesCount': { en: 'Devices', ru: 'Устройств' },
  'admin.traffic': { en: 'Traffic', ru: 'Трафик' },
  'admin.devicesTitle': { en: 'Devices ({n})', ru: 'Устройства ({n})' },
  'admin.noDevices': { en: 'No devices', ru: 'Нет устройств' },
  'admin.configsTitle': { en: 'Configs ({n})', ru: 'Конфиги ({n})' },
  'admin.noConfigs': { en: 'No configs', ru: 'Нет конфигов' },
  'admin.search': { en: 'Search', ru: 'Поиск' },
  'admin.noMatches': { en: 'Nothing found', ru: 'Ничего не найдено' },
  'admin.resetSub': { en: 'Reset everything', ru: 'Сбросить всё' },
  'admin.resetSubConfirm': {
    en: 'Reset this user? All configs and devices are deleted; traffic is kept.',
    ru: 'Сбросить пользователя? Все конфиги и устройства удалятся, трафик сохранится.',
  },
  'admin.resetDone': { en: 'Everything reset', ru: 'Всё сброшено' },
  'admin.unblockProfile': { en: 'Unblock', ru: 'Разблокировать' },
  'admin.blockProfile': { en: 'Block', ru: 'Заблокировать' },
  'admin.done': { en: 'Done', ru: 'Готово' },
  'admin.cantBlockAdmin': { en: 'Can’t block the admin', ru: 'Нельзя заблокировать админа' },
  'admin.deleteProfileConfirm': {
    en: 'Delete the profile and all its configs? Irreversible.',
    ru: 'Удалить профиль и все его конфиги? Необратимо.',
  },
  'admin.profileDeleted': { en: 'Profile deleted', ru: 'Профиль удалён' },
  'admin.cantDeleteAdmin': { en: 'Can’t delete the admin', ru: 'Нельзя удалить админа' },
  'admin.deleteProfile': { en: 'Delete profile', ru: 'Удалить профиль' },

  // ── config characteristics ──────────────────────────────────────────────────
  'meta.modeNormal': { en: 'Standard', ru: 'Обычный' },
  'meta.modeEnhanced': { en: 'Enhanced', ru: 'Усиленный' },
  'meta.modeGame': { en: 'Game', ru: 'Игровой' },
  'tech.visionTcp': { en: 'REALITY + Vision', ru: 'REALITY + Vision' },
  'tech.xhttp': { en: 'REALITY + XHTTP', ru: 'REALITY + XHTTP' },
  'tech.noVision': { en: 'REALITY', ru: 'REALITY' },
  'tech.awg': { en: 'WireGuard + obfuscation', ru: 'WireGuard + обфускация' },
  'purpose.normal': {
    en: 'Balance of speed and stability',
    ru: 'Баланс скорости и стабильности',
  },
  'purpose.enhanced': { en: 'Maximum censorship bypass', ru: 'Максимальный обход блокировок' },
  'purpose.game': { en: 'Minimal latency (gaming)', ru: 'Минимальная задержка (игры)' },
  'purpose.awg': {
    en: 'High speed (UDP may be throttled by ISPs)',
    ru: 'Высокая скорость (UDP могут резать провайдеры)',
  },

  // ── config detail ──────────────────────────────────────────────────────────
  'detail.title': { en: 'Config', ru: 'Конфиг' },
  'detail.qr': { en: 'QR code', ru: 'QR-код' },
  'detail.copyLink': { en: 'Copy link', ru: 'Скопировать ссылку' },
  'detail.linkCopied': { en: 'Link copied', ru: 'Ссылка скопирована' },
  'detail.otherFormat': {
    en: 'Other config format',
    ru: 'Другой формат конфига',
  },
  'detail.serverOkSub': { en: 'Tap to learn more', ru: 'Нажмите, чтобы узнать подробнее' },
  'detail.enhancedSub': {
    en: 'Masquerade traffic as HTTPS (XHTTP).',
    ru: 'Маскировка трафика под HTTPS (XHTTP).',
  },
  'detail.gameSub': {
    en: 'Lower latency for games (no vision-flow).',
    ru: 'Меньше задержка для игр (без vision-flow).',
  },
  'detail.afterChange': {
    en: 'After changing settings, refresh the subscription in your app.',
    ru: 'После изменения настроек обновите подписку в приложении.',
  },
  'detail.delete': { en: 'Delete config', ru: 'Удалить конфиг' },
  'detail.deleteConfirm': { en: 'Delete this config?', ru: 'Удалить этот конфиг?' },
  'detail.qrTitle': { en: 'Config QR code', ru: 'QR-код конфига' },
  'detail.qrHint': {
    en: 'Scan in your app (Happ, v2RayTun).',
    ru: 'Отсканируйте в приложении (Happ, v2RayTun).',
  },
  'detail.rawTitle': { en: 'VLESS link', ru: 'VLESS-ссылка' },
  'detail.rawHint': {
    en: 'Import into any app.',
    ru: 'Импортируйте в любое приложение.',
  },
  'detail.copied': { en: 'Config copied to clipboard', ru: 'Конфиг скопирован в буфер обмена' },
  'detail.gotIt': { en: 'Got it', ru: 'Понятно' },
  'detail.renameTitle': { en: 'Rename', ru: 'Изменение имени' },
  'detail.renameHint': {
    en: 'Shown in the console and apps.',
    ru: 'Имя для отображения в консоли и приложениях.',
  },
  'detail.name': { en: 'Name', ru: 'Имя' },
  'detail.namePlaceholder': { en: 'Enter config name', ru: 'Введите имя конфига' },
  'detail.awgImport': {
    en: 'Import into AmneziaVPN — QR or config text.',
    ru: 'Импортируйте в AmneziaVPN — QR или текст конфига.',
  },
  'detail.awgQrHint': {
    en: 'Scan in AmneziaVPN.',
    ru: 'Отсканируйте в AmneziaVPN.',
  },
  'detail.confCopied': { en: 'Config copied', ru: 'Конфиг скопирован' },
  'detail.notConnected': { en: 'not connected', ru: 'не подключён' },
  'detail.copiedForAmnezia': {
    en: 'Link copied — paste it into AmneziaVPN (＋ → from clipboard)',
    ru: 'Ссылка скопирована — вставьте в AmneziaVPN (＋ → из буфера)',
  },
  'detail.installToApp': { en: 'Add to app', ru: 'Установить в приложение' },
  'detail.chooseApp': { en: 'Choose an app', ru: 'Выберите приложение' },
  'detail.copySubLink': { en: 'Copy subscription link', ru: 'Скопировать ссылку подписки' },

  // ── create config ──────────────────────────────────────────────────────────
  'create.title': { en: 'New config', ru: 'Создание конфига' },
  'create.location': { en: 'Location', ru: 'Локация' },
  'create.locationNoteTitle': { en: 'About this location', ru: 'Об этой локации' },
  'create.locationNoteText': {
    en: 'Torrent traffic is not allowed at this location.',
    ru: 'На этой локации запрещён torrent-трафик.',
  },
  'create.protocolHeader': { en: 'Protocol', ru: 'Протокол' },
  'create.protocolFooter': {
    en: 'Can be changed later in settings.',
    ru: 'Можно сменить позже в настройках.',
  },
  'create.recommended': { en: 'recommended', ru: 'рекомендовано' },
  'create.awgNote': {
    en: 'One config = one device.',
    ru: 'Один конфиг = одно устройство.',
  },
  'create.advanced': { en: 'Advanced settings', ru: 'Дополнительные настройки' },
  'create.enhanced': { en: 'Enhanced mode', ru: 'Усиленный режим' },
  'create.enhancedSub': {
    en: 'Maximum censorship bypass.',
    ru: 'Максимальный обход блокировок.',
  },
  'create.game': { en: 'Game mode', ru: 'Игровой режим' },
  'create.beta': { en: 'beta', ru: 'бета' },
  'create.gameSub': {
    en: 'Minimal latency for gaming.',
    ru: 'Минимальная задержка для игр.',
  },

  // ── devices ────────────────────────────────────────────────────────────────
  'devices.title': { en: 'Connected devices', ru: 'Подключённые устройства' },
  'devices.note': {
    en: 'Devices are detected automatically. You can rename any of them.',
    ru: 'Устройства определяются автоматически. Любое можно переименовать.',
  },
  'devices.empty': { en: 'No connected devices', ru: 'Нет подключённых устройств' },
  'devices.emptySub': {
    en: 'Import a subscription into your VPN app — it will appear here.',
    ru: 'Импортируй подписку в VPN-приложение — устройство появится здесь.',
  },
  'devices.catVless': { en: 'VLESS', ru: 'VLESS' },
  'devices.catAwg': { en: 'AmneziaWG', ru: 'AmneziaWG' },
  'devices.blockedShort': { en: 'blocked', ru: 'заблок.' },
  'devices.blocked': { en: 'blocked', ru: 'заблокировано' },
  'devices.actions': { en: 'Actions', ru: 'Действия' },
  'devices.rename': { en: 'Rename', ru: 'Переименовать' },
  'devices.renameTitle': { en: 'Rename device', ru: 'Переименовать устройство' },
  'devices.renamePlaceholder': { en: 'Enter a device name', ru: 'Введите имя устройства' },
  'devices.renameSave': { en: 'Change name', ru: 'Изменить имя' },
  'devices.renamed': { en: 'Name changed', ru: 'Имя изменено' },
  'devices.block': { en: 'Block', ru: 'Заблокировать' },
  'devices.unblock': { en: 'Unblock', ru: 'Снять блокировку' },
  'devices.blockedToast': { en: 'Device blocked', ru: 'Устройство заблокировано' },
  'devices.unblockedToast': { en: 'Block removed', ru: 'Блокировка снята' },
  'devices.deleteOne': { en: 'Delete device', ru: 'Удалить устройство' },
  'devices.deleteConfirm': { en: 'Delete this device?', ru: 'Удалить это устройство?' },
  'devices.deletedToast': { en: 'Device deleted', ru: 'Устройство удалено' },
  'devices.deleteAll': { en: 'Delete all devices', ru: 'Удалить все устройства' },
  'devices.deleteAllConfirm': {
    en: 'Delete all devices? The subscription will be reset.',
    ru: 'Удалить все устройства? Подписка будет сброшена.',
  },
  'devices.deletedAllToast': { en: 'All devices deleted', ru: 'Все устройства удалены' },
  'devices.loadFailed': { en: 'Failed to load devices', ru: 'Не удалось загрузить устройства' },

  // ── settings ───────────────────────────────────────────────────────────────
  'settings.title': { en: 'Settings', ru: 'Настройки' },
  'settings.internalId': { en: 'Internal ID', ru: 'Внутренний ID' },
  'settings.admin': { en: 'admin', ru: 'админ' },
  'settings.used': { en: 'Used', ru: 'Использовано' },
  'settings.account': { en: 'Account', ru: 'Аккаунт' },
  'settings.logout': { en: 'Log out', ru: 'Выйти' },
  'settings.logoutConfirm': { en: 'Log out?', ru: 'Выйти из аккаунта?' },
  'settings.language': { en: 'Language', ru: 'Язык' },
  'settings.adminPanel': { en: 'Admin panel', ru: 'Админ-панель' },
  'settings.adminPanelSub': { en: 'Keys, profiles, devices', ru: 'Ключи доступа, профили, устройства' },
  'settings.sections': { en: 'Sections', ru: 'Разделы' },
  'settings.about': { en: 'About', ru: 'О сервисе' },
  'settings.aboutSub': {
    en: 'Service info and useful links',
    ru: 'Информация о сервисе и полезные ссылки',
  },
  'settings.notifications': { en: 'Notifications', ru: 'Уведомления' },
  'settings.notifyTitle': { en: 'Telegram notifications', ru: 'Уведомления в Telegram' },
  'settings.notifySub': {
    en: 'We’ll remind you about maintenance or if something happens to the servers',
    ru: 'Напомним о плановых работах или если что-то случится с серверами',
  },
  'settings.haptics': { en: 'Haptic feedback', ru: 'Тактильный отклик' },
  'settings.hapticsSub': {
    en: 'Vibration on taps and actions',
    ru: 'Вибрация при нажатиях и действиях',
  },
  'settings.notificationsFeedback': { en: 'Notifications & feedback', ru: 'Уведомления и отклик' },
  'settings.appearance': { en: 'Appearance', ru: 'Оформление' },
  'settings.theme': { en: 'Theme', ru: 'Тема' },
  'settings.themeSystem': { en: 'System', ru: 'Система' },
  'settings.themeLight': { en: 'Light', ru: 'Светлая' },
  'settings.themeDark': { en: 'Dark', ru: 'Тёмная' },
  'settings.subscriptions': { en: 'Connection', ru: 'Подключение' },
  'settings.devices': { en: 'Connected devices', ru: 'Подключённые устройства' },
  'settings.devicesSub': { en: '{n} {u} connected', ru: 'Подключено {n} {u}' },
  'settings.subSettings': { en: 'Device limit', ru: 'Лимит устройств' },
  'settings.deviceLimit': { en: 'Maximum devices', ru: 'Максимум устройств' },
  'settings.noLimit': { en: 'no limit', ru: 'без лимита' },
  'settings.subSettingsSub': { en: 'Device limit: {v}', ru: 'Лимит устройств: {v}' },
  'settings.subSettingsHint': {
    en: 'Maximum number of devices. Empty = no limit.',
    ru: 'Максимальное число устройств. Пусто — без лимита.',
  },
  'settings.subSaved': { en: 'Device limit saved', ru: 'Лимит устройств сохранён' },
  'settings.reset': { en: 'Reset configs', ru: 'Сбросить конфиги' },
  'settings.resetSub': {
    en: 'Deletes all your configs and devices',
    ru: 'Удаляет все ваши конфиги и устройства',
  },
  'settings.resetConfirm': {
    en: 'Delete ALL your configs and devices? This cannot be undone.',
    ru: 'Удалить ВСЕ ваши конфиги и устройства? Действие необратимо.',
  },
  'settings.resetDone': { en: 'Everything reset', ru: 'Всё сброшено' },
  'settings.resetFailed': { en: 'Failed to reset link', ru: 'Не удалось сбросить ссылку' },
  'settings.danger': { en: 'Danger zone', ru: 'Опасная зона' },
  'settings.deleteAccount': { en: 'Delete account', ru: 'Удалить аккаунт' },
  'settings.deleteAccountSub': {
    en: 'Permanently delete your account and all configs',
    ru: 'Безвозвратно удалить аккаунт и все конфиги',
  },
  'settings.adminLocked': { en: 'The admin account is locked', ru: 'Аккаунт администратора закреплён' },
  'settings.deleteAccountConfirm': {
    en: 'Delete your account and all configs? This can’t be undone.',
    ru: 'Удалить аккаунт и все конфиги? Действие необратимо.',
  },
  'settings.deleteAccountConfirmSub': {
    en: 'Delete your account, all configs AND your active subscription? The subscription will be lost (no refund) and this can’t be undone.',
    ru: 'Удалить аккаунт, все конфиги И активную подписку? Подписка будет потеряна без возврата средств. Действие необратимо.',
  },
  'settings.adminCantDelete': {
    en: 'The admin account cannot be deleted',
    ru: 'Аккаунт администратора нельзя удалить',
  },
  'settings.deleteAccountFailed': { en: 'Failed to delete account', ru: 'Не удалось удалить аккаунт' },

  // ── about ──────────────────────────────────────────────────────────────────
  'about.title': { en: 'About', ru: 'О сервисе' },
  'about.tagline': {
    en: 'Secure and anonymous access.',
    ru: 'Безопасный и анонимный доступ.',
  },
  'about.links': { en: 'Useful links', ru: 'Полезные ссылки' },
  'about.bot': { en: 'Telegram bot', ru: 'Telegram-бот' },
  'about.faq': { en: 'Help', ru: 'Помощь' },
  'about.whatsnew': { en: 'Changelog', ru: 'История изменений' },
  'about.latest': { en: 'latest', ru: 'свежее' },
  'about.added': { en: 'Added', ru: 'Добавлено' },
  'about.changed': { en: 'Changed', ru: 'Изменено' },
  'about.fixed': { en: 'Fixed', ru: 'Исправлено' },
  'about.legal': { en: 'Legal', ru: 'Правовая информация' },
  'about.terms': { en: 'Usage policy', ru: 'Политика использования' },
  'about.privacy': { en: 'Privacy policy', ru: 'Политика конфиденциальности' },
  'about.versionLabel': { en: 'Version', ru: 'Версия' },
  'about.q1': { en: 'What is a config?', ru: 'Что такое конфиг?' },
  'about.a1': {
    en: 'A config is your personal VPN profile. VLESS opens in Happ, v2RayTun or v2rayNG (by link or QR); AmneziaWG — in the AmneziaVPN app (.conf or QR).',
    ru: 'Конфиг — это ваш личный профиль подключения. VLESS открывается в Happ, v2RayTun или v2rayNG (по ссылке или QR), AmneziaWG — в приложении AmneziaVPN (.conf или QR).',
  },
  'about.q2': { en: 'Are there traffic limits?', ru: 'Есть ли лимиты на трафик?' },
  'about.a2': {
    en: 'No — traffic is unlimited, use it freely. Server channels are 2–10 Gbit/s and aren’t throttled.',
    ru: 'Нет, трафик безлимитный — пользуйтесь без ограничений. Каналы серверов 2–10 Гбит/с и не режутся.',
  },
  'about.q3': { en: 'How do I activate a config?', ru: 'Как активировать конфиг?' },
  'about.a3': {
    en: 'Sign in with Telegram, enter the access key from the owner, then create a config on the “Configs” tab — one tap to import into your app.',
    ru: 'Войдите через Telegram, введите ключ доступа от владельца и создайте конфиг во вкладке «Конфиги» — импорт в приложение в один тап.',
  },
  'about.q4': { en: 'Where do I get a key?', ru: 'Где получить ключ?' },
  'about.a4': {
    en: 'The owner of the service issues it. Message support and they’ll send you an activation key.',
    ru: 'Ключ выдаёт владелец сервиса. Напишите в поддержку — пришлют ключ активации.',
  },
  'about.q5': {
    en: 'Can I use a config on several devices?',
    ru: 'Можно ли использовать конфиг на нескольких устройствах?',
  },
  'about.a5': {
    en: 'A VLESS subscription works on several devices at once over one link — they show up under “Connected devices”. With AmneziaWG it’s one config per device, so add a separate config for each.',
    ru: 'Подписка VLESS работает сразу на нескольких устройствах по одной ссылке — они появятся в «Подключённых устройствах». У AmneziaWG один конфиг на одно устройство, для каждого создайте отдельный.',
  },
  'about.q6': { en: 'How do I know a config is active?', ru: 'Как узнать, что конфиг активирован?' },
  'about.a6': {
    en: 'If the config is listed on the “Configs” tab and the server shows “online”, it’s active and ready to connect.',
    ru: 'Если конфиг виден во вкладке «Конфиги», а сервер в статусе «онлайн» — он активен и готов к подключению.',
  },
  'about.q7': { en: 'What speed can I expect?', ru: 'Какая скорость?' },
  'about.a7': {
    en: 'Speed mostly depends on your ISP and network. The servers don’t limit traffic and run on 2–10 Gbit/s channels.',
    ru: 'Скорость зависит в основном от вашего провайдера и сети. Серверы не ограничивают трафик, каналы 2–10 Гбит/с.',
  },
  'about.q8': { en: 'VLESS or AmneziaWG — what’s the difference?', ru: 'VLESS или AmneziaWG — в чём разница?' },
  'about.a8': {
    en: 'VLESS (REALITY) is the most stable and best at bypassing blocks — modes Standard, Enhanced (HTTPS masking) and Game (low latency). AmneziaWG is very fast, but some ISPs throttle its UDP. Not sure? Pick VLESS.',
    ru: 'VLESS (REALITY) — самый стабильный и лучше обходит блокировки; режимы Обычный, Усиленный (маскировка под HTTPS) и Игровой (мин. задержка). AmneziaWG очень быстрый, но его UDP у некоторых провайдеров режется. Не уверены — берите VLESS.',
  },

  // ── charts / server stats ─────────────────────────────────────────────────
  'chart.at': { en: 'at', ru: 'в' },
  'stats.title': { en: 'Server statistics', ru: 'Статистика сервера' },
  'stats.location': { en: 'Netherlands', ru: 'Нидерланды' },
  'stats.unavailable': { en: 'Statistics unavailable', ru: 'Статистика недоступна' },
  'stats.online': { en: 'Server is up', ru: 'Сервер работает' },
  'stats.offline': { en: 'Server unavailable', ru: 'Сервер недоступен' },
  'stats.uptime': { en: 'Online for {n} day(s)', ru: 'В сети уже {n} дн.' },
  'stats.cpu': { en: 'CPU', ru: 'Процессор' },
  'stats.ram': { en: 'RAM', ru: 'Память' },
  'stats.net': { en: 'Network', ru: 'Сеть' },
  'stats.footer': {
    en: 'Updated every 10 minutes.',
    ru: 'Обновление раз в 10 минут.',
  },
} as const

export type TKey = keyof typeof dict

function getInitialLang(): Lang {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s === 'en' || s === 'ru') return s
  } catch {
    /* ignore */
  }
  return 'en' // default: English
}

function interpolate(s: string, params?: Record<string, string | number>): string {
  if (!params) return s
  let out = s
  for (const [k, v] of Object.entries(params)) {
    out = out.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v))
  }
  return out
}

/** Look up a translation outside React (e.g. format helpers). */
export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const entry = (dict as Record<string, { en: string; ru: string }>)[key]
  const s = entry ? entry[lang] ?? entry.en : key
  return interpolate(s, params)
}

interface Ctx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TKey, params?: Record<string, string | number>) => string
}

const LangContext = createContext<Ctx>({ lang: 'en', setLang: () => {}, t: (k) => k })

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang)
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      /* ignore */
    }
  }, [])
  const t = useCallback(
    (key: TKey, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang],
  )
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>
}

export function useT() {
  return useContext(LangContext)
}
