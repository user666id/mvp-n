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
  'common.copy': { en: 'Copy', ru: 'Копировать' },
  'common.copied': { en: 'Copied', ru: 'Скопировано' },
  'common.device': { en: 'Device', ru: 'Устройство' },
  'common.online': { en: 'online', ru: 'в сети' },
  'common.saveFailed': { en: 'Failed to save', ru: 'Не удалось сохранить' },
  'common.loadError': {
    en: 'Couldn’t load. Check your connection and try again.',
    ru: 'Не удалось загрузить. Проверьте соединение и повторите.',
  },
  'common.retry': { en: 'Retry', ru: 'Повторить' },

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
  'auth.agreePre': { en: 'By signing in, you agree to the ', ru: 'Входя, вы принимаете ' },
  'auth.agreeAnd': { en: ' and ', ru: ' и ' },
  'auth.agreePost': { en: '.', ru: '.' },
  'key.activateTitle': { en: 'Activation', ru: 'Активация' },
  'key.activateHint': {
    en: 'Enter your access key.',
    ru: 'Введите ключ доступа.',
  },
  'key.activate': { en: 'Activate', ru: 'Активировать' },
  'key.invalid': { en: 'Invalid key', ru: 'Неверный ключ' },

  // ── configs ──────────────────────────────────────────────────────────────
  'configs.title': { en: 'Configs', ru: 'Конфиги' },
  'sub.until': { en: 'Active until {d}', ru: 'Активна до {d}' },
  'sub.daysLeft': { en: '{n} days left', ru: 'осталось {n} дн.' },
  'sub.activeShort': { en: 'Active until {d}', ru: 'Активна до {d}' },
  'sub.expired': { en: 'Subscription expired', ru: 'Подписка истекла' },
  'sub.status': { en: 'Billing', ru: 'Оплата' },
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
  'sub.expiredHint': {
    en: 'Renew it to use the VPN and create configs again.',
    ru: 'Продлите, чтобы снова пользоваться VPN и создавать конфиги.',
  },
  'sub.renew': { en: 'Subscription', ru: 'Подписка' },
  'sub.lifetimeBottom': { en: 'Lifetime access', ru: 'Бессрочный доступ' },
  'sub.buy': { en: 'Buy subscription', ru: 'Купить подписку' },
  'sub.extend': { en: 'Renew', ru: 'Продлить' },
  'sub.haveKey': { en: 'Activate key', ru: 'Активировать ключ' },
  'sub.connectTitle': { en: 'Activate access', ru: 'Подключите доступ' },
  'sub.connectHint': {
    en: 'Buy a subscription or activate an access key to use the VPN.',
    ru: 'Купите подписку или активируйте ключ, чтобы пользоваться VPN.',
  },
  'pay.title': { en: 'Subscription', ru: 'Подписка' },
  'pay.method': { en: 'Payment method', ru: 'Способ оплаты' },
  'pay.plan': { en: 'Plan', ru: 'Тариф' },
  'pay.d7': { en: '7 days', ru: '7 дней' },
  'pay.d30': { en: '30 days', ru: '30 дней' },
  'pay.d90': { en: '90 days', ru: '90 дней' },
  'pay.d365': { en: '365 days', ru: '365 дней' },
  'pay.sendExactly': { en: 'Send exactly', ru: 'Отправьте ровно' },
  'pay.network': { en: 'network', ru: 'сеть' },
  'pay.payWallet': { en: 'Pay in wallet', ru: 'Оплатить в кошельке' },
  'pay.connectWallet': { en: 'Connect wallet', ru: 'Подключить кошелёк' },
  'pay.starsProcessing': {
    en: 'Payment received — your subscription will activate shortly.',
    ru: 'Платёж получен — подписка активируется в течение минуты.',
  },
  'pay.buy': { en: 'Buy', ru: 'Купить' },
  'pay.walletCancelled': { en: 'Payment cancelled', ru: 'Оплата отменена' },
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
  'pay.cancelConfirm': {
    en: 'Cancel this payment? If you have already sent it, the funds may not be credited.',
    ru: 'Отменить этот платёж? Если вы уже отправили его, средства могут не зачислиться.',
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
  'pay.doneRenewed': { en: 'Your subscription is extended.', ru: 'Подписка продлена.' },
  'pay.doneActivated': { en: 'Your subscription is active.', ru: 'Подписка оформлена.' },
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
  'admin.keyDuration': { en: 'Grants access for', ru: 'Даёт доступ на' },
  'admin.keyLifetime': { en: 'Lifetime', ru: 'Бессрочно' },
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
  'admin.trafficTotalShort': { en: 'Total', ru: 'Всего' },
  'admin.trafficTodayShort': { en: 'Today', ru: 'Сегодня' },
  'traffic.byDay': { en: 'By day', ru: 'По дням' },
  'traffic.empty': { en: 'No data yet', ru: 'Пока нет данных' },
  'admin.profiles': { en: 'Profiles', ru: 'Профили' },
  'admin.domains': { en: 'Status', ru: 'Статусы' },
  'admin.domainsWeb': { en: 'Web', ru: 'Веб' },
  'admin.domainsVpn': { en: 'VPN', ru: 'VPN' },
  'admin.domainsSvc': { en: 'Services', ru: 'Сервисы' },
  'admin.domainOk': { en: 'online', ru: 'онлайн' },
  'admin.domainDown': { en: 'unreachable', ru: 'недоступен' },
  'admin.refresh': { en: 'Refresh', ru: 'Обновить' },
  'admin.devShort': { en: '{n} dev.', ru: '{n} устр.' },
  'admin.profileFallback': { en: 'Profile {id}', ru: 'Профиль {id}' },
  'admin.idCopied': { en: 'ID copied', ru: 'ID скопирован' },
  'admin.internalId': { en: 'Internal ID', ru: 'Внутренний ID' },
  'admin.traffic': { en: 'Traffic', ru: 'Трафик' },
  'admin.devicesTitle': { en: 'Devices ({n})', ru: 'Устройства ({n})' },
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
  'admin.blockProfileConfirm': {
    en: 'Block this user? Their access stops immediately until you unblock them.',
    ru: 'Заблокировать пользователя? Доступ прекратится сразу — до разблокировки.',
  },
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
  'detail.renameTitle': { en: 'Rename', ru: 'Изменение имени' },
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
  'detail.installToApp': { en: 'Add to app', ru: 'Установить в приложение' },
  'detail.chooseApp': { en: 'Choose an app', ru: 'Выберите приложение' },
  'detail.step1Title': { en: '1. Install the app', ru: '1. Установка приложения' },
  'detail.step1Body': {
    en: "Open the app's store page below and install it. Launch it and tap Allow in the VPN-configuration prompt.",
    ru: 'Откройте страницу приложения по ссылке ниже и установите его. Запустите и в окне разрешения VPN-конфигурации нажмите «Разрешить» (Allow).',
  },
  'detail.step1BodyDesktop': {
    en: 'Download the app for your OS from the page below and install it.',
    ru: 'Скачайте приложение для вашей ОС по ссылке ниже и установите.',
  },
  'detail.step2Title': { en: '2. Add the subscription', ru: '2. Добавление подписки' },
  'detail.step2Body': {
    en: 'Tap the button below — the app opens and the subscription is added automatically.',
    ru: 'Нажмите кнопку ниже — приложение откроется, и подписка добавится автоматически.',
  },
  'detail.step2BodyDesktop': {
    en: 'Copy the subscription link and add it in the app (paste the URL).',
    ru: 'Скопируйте ссылку на подписку и добавьте её в приложении (вставьте URL).',
  },
  'detail.addSub': { en: 'Add subscription', ru: 'Добавить подписку' },
  'detail.step3Title': { en: '3. Connect and use', ru: '3. Подключение и использование' },
  'detail.step3Body': {
    en: 'On the main screen, tap the big power button in the centre to connect. Pick a server from the list, and switch to another if needed.',
    ru: 'В главном разделе нажмите большую кнопку включения в центре для подключения к VPN. Не забудьте выбрать сервер в списке. При необходимости выберите другой сервер.',
  },

  // ── create config ──────────────────────────────────────────────────────────
  'create.title': { en: 'New config', ru: 'Создание конфига' },
  'create.location': { en: 'Location', ru: 'Локация' },
  'create.protocolHeader': { en: 'Protocol', ru: 'Протокол' },
  'create.recommended': { en: 'recommended', ru: 'рекомендовано' },
  'create.awgNote': {
    en: 'One config = one device.',
    ru: 'Один конфиг = одно устройство.',
  },
  'create.advanced': { en: 'Advanced settings', ru: 'Дополнительные настройки' },
  'create.enhanced': { en: 'Enhanced mode', ru: 'Усиленный режим' },
  'create.game': { en: 'Game mode', ru: 'Игровой режим' },

  // ── devices ────────────────────────────────────────────────────────────────
  'devices.title': { en: 'Connected devices', ru: 'Подключённые устройства' },
  'devices.empty': { en: 'No connected devices', ru: 'Нет подключённых устройств' },
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

  // ── settings ───────────────────────────────────────────────────────────────
  'settings.title': { en: 'Settings', ru: 'Настройки' },
  'settings.admin': { en: 'admin', ru: 'админ' },
  'settings.account': { en: 'Account', ru: 'Аккаунт' },
  'settings.profile': { en: 'Profile', ru: 'Профиль' },
  'settings.usage': { en: 'Usage', ru: 'Использование' },
  'settings.usageSoon': { en: 'Coming soon', ru: 'Скоро' },
  'settings.logout': { en: 'Log out', ru: 'Выйти' },
  'settings.logoutConfirm': { en: 'Log out?', ru: 'Выйти из аккаунта?' },
  'settings.language': { en: 'Language', ru: 'Язык' },
  'settings.adminPanel': { en: 'Admin panel', ru: 'Админ-панель' },
  'settings.about': { en: 'About', ru: 'О сервисе' },
  'settings.notifyTitle': { en: 'Telegram notifications', ru: 'Уведомления в Telegram' },
  'settings.haptics': { en: 'Haptic feedback', ru: 'Тактильный отклик' },
  'settings.appearance': { en: 'App', ru: 'Приложение' },
  'settings.theme': { en: 'Theme', ru: 'Тема' },
  'settings.themeSystem': { en: 'System', ru: 'Система' },
  'settings.themeLight': { en: 'Light', ru: 'Светлая' },
  'settings.themeDark': { en: 'Dark', ru: 'Тёмная' },
  'settings.darkShade': { en: 'Dark background', ru: 'Тёмный фон' },
  'settings.shadeWarm': { en: 'Warm', ru: 'Тёплый' },
  'settings.shadeBlack': { en: 'Black', ru: 'Чёрный' },
  'settings.shadeFragment': { en: 'Fragment', ru: 'Fragment' },
  'settings.devices': { en: 'Connected devices', ru: 'Подключённые устройства' },
  'settings.subSettings': { en: 'Device limit', ru: 'Лимит устройств' },
  'settings.deviceLimit': { en: 'Maximum devices', ru: 'Максимум устройств' },
  'settings.noLimit': { en: 'No limit', ru: 'Без лимита' },
  'settings.subSaved': { en: 'Device limit saved', ru: 'Лимит устройств сохранён' },
  'settings.reset': { en: 'Reset configs', ru: 'Сбросить конфиги' },
  'settings.walletConnected': { en: 'Wallet connected', ru: 'Кошелёк подключён' },
  'settings.walletNotConnected': { en: 'Wallet not connected', ru: 'Кошелёк не подключён' },
  'settings.walletConnect': { en: 'Connect', ru: 'Подключить' },
  'settings.walletDisconnect': { en: 'Disconnect', ru: 'Отключить' },
  'settings.resetConfirm': {
    en: 'Delete ALL your configs and devices? This cannot be undone.',
    ru: 'Удалить ВСЕ ваши конфиги и устройства? Действие необратимо.',
  },
  'settings.resetDone': { en: 'Everything reset', ru: 'Всё сброшено' },
  'settings.resetFailed': { en: 'Failed to reset link', ru: 'Не удалось сбросить ссылку' },
  'settings.deleteAccount': { en: 'Delete account', ru: 'Удалить аккаунт' },
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
  'about.github': { en: 'Source code', ru: 'Исходный код' },
  'about.whatsnew': { en: 'Changelog', ru: 'История изменений' },
  'about.latest': { en: 'latest', ru: 'свежее' },
  'about.added': { en: 'Added', ru: 'Добавлено' },
  'about.changed': { en: 'Changed', ru: 'Изменено' },
  'about.fixed': { en: 'Fixed', ru: 'Исправлено' },
  'about.legal': { en: 'Legal', ru: 'Правовая информация' },
  'about.terms': { en: 'Usage policy', ru: 'Политика использования' },
  'about.privacy': { en: 'Privacy policy', ru: 'Политика конфиденциальности' },
  'about.licenses': { en: 'Licenses', ru: 'Лицензии' },
  'about.licensesHint': {
    en: 'mvp-n is open source (AGPL-3.0). The third-party components it ships or runs, by area — the full (incl. transitive) list lives in the source repositories:',
    ru: 'mvp-n — открытый код (AGPL-3.0). Сторонние компоненты, которые мы поставляем или запускаем, по областям — полный (включая транзитивные) список в репозиториях:',
  },
  'lic.app': { en: 'This service', ru: 'Этот сервис' },
  'lic.miniApp': { en: 'Mini App', ru: 'Мини-приложение' },
  'lic.bot': { en: 'Telegram bot', ru: 'Telegram-бот' },
  'lic.backend': { en: 'Backend (Go)', ru: 'Бэкенд (Go)' },
  'lic.vpn': { en: 'VPN core & proxy', ru: 'Ядро VPN и прокси' },
  'lic.infra': { en: 'Infrastructure', ru: 'Инфраструктура' },
  'lic.fonts': { en: 'Fonts', ru: 'Шрифты' },

  // ── charts / server stats ─────────────────────────────────────────────────
  'chart.at': { en: 'at', ru: 'в' },
  'stats.title': { en: 'Server statistics', ru: 'Статистика сервера' },
  'stats.location': { en: 'Netherlands', ru: 'Нидерланды' },
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
