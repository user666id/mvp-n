// External script (the Mini App CSP is script-src 'self' — inline scripts are
// blocked, so this must be a same-origin file, not an inline <script>).
;(function () {
  var p = new URLSearchParams(location.search)
  var app = p.get('app') || ''
  var u = p.get('u') || '' // subscription URL (already decoded by URLSearchParams)
  // Follow the app/bot language (passed as ?lang=en|ru); default ru.
  var lang = p.get('lang') === 'en' ? 'en' : 'ru'
  var T = {
    ru: { title: 'Открываем приложение…', btn: 'Открыть приложение' },
    en: { title: 'Opening the app…', btn: 'Open the app' },
  }
  document.documentElement.lang = lang
  document.getElementById('status').textContent = T[lang].title
  document.getElementById('manual').textContent = T[lang].btn
  function deeplink(app, u) {
    switch (app) {
      case 'happ':
        return 'happ://add/' + u
      case 'v2raytun':
        return 'v2raytun://import/' + u
      case 'v2rayng':
        return 'v2rayng://install-sub?url=' + encodeURIComponent(u)
      case 'amneziavpn':
        return u // u is the raw vless:// link; AmneziaVPN imports it
      default:
        return u
    }
  }
  var dl = deeplink(app, u)
  document.getElementById('manual').setAttribute('href', dl)
  // Auto-open the app shortly after the page loads (gives the browser a tick).
  setTimeout(function () {
    try {
      location.href = dl
    } catch (e) {}
  }, 250)
})()
