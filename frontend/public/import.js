// External script (the Mini App CSP is script-src 'self' — inline scripts are
// blocked, so this must be a same-origin file, not an inline <script>).
;(function () {
  // Theme follows the saved in-app choice (same origin as the Mini App), else
  // the OS colour scheme: light / warm dark / true black. Mirrors index.css.
  ;(function theme() {
    var PAL = {
      light: { bg: '#faf9f5', ink: '#1f1e1d', muted: '#6b6a65', accent: '#d97757', scheme: 'light' },
      warm: { bg: '#1c1c1c', ink: '#f7f7f5', muted: '#9f9f9d', accent: '#d97757', scheme: 'dark' },
      black: { bg: '#000000', ink: '#f7f7f5', muted: '#9f9f9d', accent: '#d97757', scheme: 'dark' },
    }
    var key
    // The app passes ?theme=light|warm|black so the page matches the in-app theme
    // even when opened in an EXTERNAL browser (where the Mini App's localStorage
    // isn't shared). Fall back to same-origin localStorage / OS scheme otherwise.
    var pTheme = new URLSearchParams(location.search).get('theme')
    if (pTheme === 'light' || pTheme === 'warm' || pTheme === 'black') {
      key = pTheme
    } else {
      try {
        var t = localStorage.getItem('mvpn_theme')
        var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        var dark = t === 'dark' || (t !== 'light' && prefersDark)
        key = !dark ? 'light' : localStorage.getItem('mvpn_dark_shade') === 'black' ? 'black' : 'warm'
      } catch (e) {
        key = 'warm'
      }
    }
    var c = PAL[key]
    document.documentElement.style.colorScheme = c.scheme
    var st = document.createElement('style')
    st.textContent =
      'body{background:' + c.bg + ';color:' + c.ink + '}' +
      '.m{color:' + c.muted + '}' +
      '.t{color:' + c.ink + '}' +
      'a.btn{background:' + c.accent + ';color:#fff}'
    document.head.appendChild(st)
  })()

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
