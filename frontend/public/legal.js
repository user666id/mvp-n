// External script (the Mini App CSP is script-src 'self' — inline scripts are
// blocked, so this must be a same-origin file, not an inline <script>).
;(function () {
  var p = new URLSearchParams(location.search)
  // Initial language follows the app (passed as ?lang=en|ru); the on-page
  // EN/RU switch lets the reader change it without a reload.
  var lang = p.get('lang') === 'en' ? 'en' : 'ru'
  // Doc comes from the page (terms.html/privacy.html set <body data-doc>) or, on
  // the shared legal.html, from ?doc=. Defaults to terms.
  var doc =
    (document.body && document.body.dataset && document.body.dataset.doc) ||
    (p.get('doc') === 'privacy' ? 'privacy' : 'terms')
  if (doc !== 'privacy') doc = 'terms'
  var UPDATED = '2026-06-15'

  var C = {
    terms: {
      ru: {
        title: 'Политика использования',
        html:
          '<p>Используя mvp-n («Сервис»), вы соглашаетесь с настоящими Правилами. Если вы не согласны — не пользуйтесь Сервисом.</p>' +
          '<h2>1. Сервис</h2><p>mvp-n предоставляет персональный доступ к VPN через Telegram-приложение. Доступ предназначен для личного использования и защиты приватности.</p>' +
          '<h2>2. Допустимое использование</h2><p>Запрещено использовать Сервис для противоправных действий, рассылки спама, атак, нарушения прав третьих лиц или обхода закона. Мы можем заблокировать доступ при нарушении.</p>' +
          '<h2>3. Подписка и оплата</h2><ul>' +
          '<li>Доступ предоставляется по ключу (бессрочно) или по платной подписке на срок (7/30/90/365 дней).</li>' +
          '<li>Оплата производится в криптовалюте; платежи невозвратны.</li>' +
          '<li>По истечении срока доступ приостанавливается, конфигурации удаляются; аккаунт сохраняется, продление восстанавливает доступ.</li></ul>' +
          '<h2>4. Аккаунт</h2><p>Аккаунт привязан к вашему Telegram. Вы отвечаете за сохранность доступа к Telegram. Вы можете удалить аккаунт в любой момент в приложении.</p>' +
          '<h2>5. Отсутствие гарантий</h2><p>Сервис предоставляется «как есть», без гарантий бесперебойной работы. Мы не несём ответственности за убытки, связанные с использованием или невозможностью использования Сервиса.</p>' +
          '<h2>6. Изменения</h2><p>Правила могут обновляться. Актуальная версия всегда доступна по этой ссылке.</p>',
      },
      en: {
        title: 'Usage Policy',
        html:
          '<p>By using mvp-n (the “Service”) you agree to these Terms. If you do not agree, do not use the Service.</p>' +
          '<h2>1. The service</h2><p>mvp-n provides personal VPN access via a Telegram app, intended for personal use and privacy protection.</p>' +
          '<h2>2. Acceptable use</h2><p>You may not use the Service for unlawful activity, spam, attacks, infringing others’ rights, or circumventing the law. We may suspend access on violation.</p>' +
          '<h2>3. Subscription &amp; payment</h2><ul>' +
          '<li>Access is granted by a key (lifetime) or a paid subscription for a term (7/30/90/365 days).</li>' +
          '<li>Payments are made in cryptocurrency and are non-refundable.</li>' +
          '<li>On expiry, access is suspended and configurations are removed; the account is kept and renewing restores access.</li></ul>' +
          '<h2>4. Account</h2><p>Your account is tied to your Telegram. You are responsible for keeping access to your Telegram. You may delete your account at any time in the app.</p>' +
          '<h2>5. No warranty</h2><p>The Service is provided “as is”, without warranty of uninterrupted operation. We are not liable for damages arising from use or inability to use the Service.</p>' +
          '<h2>6. Changes</h2><p>These Terms may be updated. The current version is always available at this link.</p>',
      },
    },
    privacy: {
      ru: {
        title: 'Политика конфиденциальности',
        html:
          '<p>mvp-n построен на принципе <b>отсутствия логов</b>. Мы не пишем и не храним журналы вашего трафика.</p>' +
          '<h2>Что мы НЕ собираем</h2><ul>' +
          '<li>Историю посещений, DNS-запросы, содержимое или адреса вашего трафика.</li>' +
          '<li>Журналы подключений к VPN.</li></ul>' +
          '<h2>Что мы храним</h2><ul>' +
          '<li>Telegram ID, имя и username (из Telegram), внутренний номер профиля.</li>' +
          '<li>Статус и срок подписки.</li>' +
          '<li>Метаданные конфигураций и устройств: название, дата создания, лимит устройств.</li>' +
          '<li>Суммарный счётчик трафика (в байтах) — без детализации по адресам.</li>' +
          '<li>Записи о платежах: сумма, валюта, хеш транзакции, дата.</li></ul>' +
          '<h2>Зачем</h2><p>Эти данные нужны только для работы Сервиса: выдачи доступа, учёта подписки и приёма оплаты.</p>' +
          '<h2>Третьи стороны</h2><p>Для подтверждения оплаты мы обращаемся к публичным блокчейн-сервисам (tonapi, trongrid). Данные о транзакциях уже публичны в блокчейне. Мы не продаём и не передаём ваши данные третьим лицам.</p>' +
          '<h2>Хранение и удаление</h2><p>Данные хранятся, пока существует аккаунт. При удалении аккаунта в приложении связанные данные удаляются.</p>',
      },
      en: {
        title: 'Privacy Policy',
        html:
          '<p>mvp-n is built on a <b>zero-logs</b> principle. We do not write or keep logs of your traffic.</p>' +
          '<h2>What we do NOT collect</h2><ul>' +
          '<li>Browsing history, DNS queries, the content or destinations of your traffic.</li>' +
          '<li>VPN connection logs.</li></ul>' +
          '<h2>What we store</h2><ul>' +
          '<li>Telegram ID, name and username (from Telegram), an internal profile number.</li>' +
          '<li>Subscription status and expiry.</li>' +
          '<li>Configuration and device metadata: name, creation date, device limit.</li>' +
          '<li>An aggregate traffic counter (in bytes) — never per-destination detail.</li>' +
          '<li>Payment records: amount, asset, transaction hash, date.</li></ul>' +
          '<h2>Why</h2><p>This data is used only to operate the Service: granting access, tracking the subscription, and accepting payment.</p>' +
          '<h2>Third parties</h2><p>To confirm payments we query public blockchain services (tonapi, trongrid). Transaction data is already public on-chain. We do not sell or share your data with third parties.</p>' +
          '<h2>Retention &amp; deletion</h2><p>Data is kept while the account exists. Deleting your account in the app removes the associated data.</p>',
      },
    },
  }

  var L = { ru: { updated: 'Обновлено' }, en: { updated: 'Updated' } }

  // On-page language switch styles (style-src allows inline styles).
  var st = document.createElement('style')
  st.textContent =
    '.lang{display:flex;gap:6px;margin:0 0 22px}' +
    '.lang button{background:#191917;color:#9f9f9d;border:1px solid #2e2e2c;border-radius:999px;padding:5px 14px;font-size:13px;font-weight:500;cursor:pointer}' +
    '.lang button.on{background:#d97757;color:#fff;border-color:#d97757}'
  document.head.appendChild(st)

  var root = document.getElementById('root')
  function render() {
    var c = C[doc][lang]
    document.documentElement.lang = lang
    document.title = 'mvp-n — ' + c.title
    root.innerHTML =
      '<div class="lang">' +
      '<button type="button" data-l="en"' +
      (lang === 'en' ? ' class="on"' : '') +
      '>EN</button>' +
      '<button type="button" data-l="ru"' +
      (lang === 'ru' ? ' class="on"' : '') +
      '>RU</button>' +
      '</div>' +
      '<h1>' + c.title + '</h1>' +
      '<p class="upd">' + L[lang].updated + ': ' + UPDATED + '</p>' +
      c.html +
      '<div class="foot">mvp-n</div>'
    var btns = root.querySelectorAll('.lang button')
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        lang = this.getAttribute('data-l')
        render()
      })
    }
  }
  render()
})()
