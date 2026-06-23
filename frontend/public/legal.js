// External script (the Mini App CSP is script-src 'self' — inline scripts are
// blocked, so this must be a same-origin file, not an inline <script>).
//
// English-only: the legal pages (legal.mvp-n.net/terms, /privacy) are standalone,
// shareable documents and are kept in English. (The Mini App itself is the only
// place with an RU/EN toggle.)
;(function () {
  var p = new URLSearchParams(location.search)
  // Doc comes from the page (terms.html/privacy.html set <body data-doc>) or, on
  // the shared legal.html, from ?doc=. Defaults to terms.
  var doc =
    (document.body && document.body.dataset && document.body.dataset.doc) ||
    (p.get('doc') === 'privacy' ? 'privacy' : 'terms')
  if (doc !== 'privacy') doc = 'terms'
  var UPDATED = '2026-06-18'

  var C = {
    terms: {
      title: 'Usage Policy',
      html:
        '<p>By using mvp-n (the “Service”) you agree to these Terms. If you do not agree, do not use the Service.</p>' +
        '<h2>1. The service</h2><p>mvp-n provides personal VPN access via a Telegram app, intended for personal use and privacy protection.</p>' +
        '<h2>2. Acceptable use</h2><p>You may not use the Service for unlawful activity, spam, attacks, infringing others’ rights, or circumventing the law. We may suspend access on violation.</p>' +
        '<h2>3. Subscription &amp; payment</h2><ul>' +
        '<li>Access is granted by a key (lifetime) or a paid subscription for a term (7/30/90/365 days).</li>' +
        '<li>Payment is in cryptocurrency or Telegram Stars.</li>' +
        '<li>Access is a digital service. By paying you expressly request that the service begin immediately and acknowledge that you thereby lose the 14-day right of withdrawal. Payments are non-refundable once access is activated.</li>' +
        '<li>On expiry, access is suspended and configurations are removed; the account is kept and renewing restores access.</li></ul>' +
        '<h2>4. Account</h2><p>Your account is tied to your Telegram. You are responsible for keeping access to your Telegram. You may delete your account at any time in the app.</p>' +
        '<h2>5. No warranty</h2><p>The Service is provided “as is”, without warranty of uninterrupted operation. We are not liable for damages arising from use or inability to use the Service.</p>' +
        '<h2>6. Changes</h2><p>These Terms may be updated. The current version is always available at this link.</p>',
    },
    privacy: {
      title: 'Privacy Policy',
      html:
        '<p>mvp-n is built on a <b>zero-logs</b> principle. We do not write or keep logs of your traffic.</p>' +
        '<h2>What we do NOT collect</h2><ul>' +
        '<li>Browsing history, DNS queries, the content or destinations of your traffic.</li>' +
        '<li>VPN connection logs.</li>' +
        '<li>Your IP address.</li></ul>' +
        '<h2>What we store</h2><ul>' +
        '<li>Telegram ID, name and username (from Telegram), and an internal profile identifier the service generates itself.</li>' +
        '<li>Subscription status and expiry.</li>' +
        '<li>The names of your configurations and devices.</li>' +
        '<li>An aggregate traffic counter (in bytes) — never per-destination detail.</li>' +
        '<li>Payment records: amount, asset, transaction hash, date.</li></ul>' +
        '<h2>Why</h2><p>This data is used only to operate the Service: granting access, tracking the subscription, and accepting payment.</p>' +
        '<h2>Third parties</h2><p>To confirm payments we query public blockchain services (tonapi, trongrid). Transaction data is already public on-chain. We do not sell or share your data with third parties.</p>' +
        '<h2>Analytics</h2><p>We use no analytics, advertising pixels or tracking cookies.</p>' +
        '<h2>Retention</h2><p>Data is kept while the account exists; deleting your account in the app removes the associated data.</p>' +
        '<h2>Where data is processed</h2><p>Servers are located in the Netherlands (EU). Third-party services (tonapi, trongrid) only receive what is already public on-chain.</p>' +
        '<h2>Deletion &amp; support</h2><p>You can delete your account and its associated data directly in the app. For anything else, contact support: @mvp_n_net_bot.</p>',
    },
  }

  // Theme follows the app: ?theme=light|warm|black|fragment (passed by the Mini
  // App), falling back to the OS colour scheme. Mirrors the in-app palettes.
  var PAL = {
    light: { bg: '#faf9f5', card: '#ffffff', border: '#e6e3d9', ink: '#1f1e1d', muted: '#6b6a65', body: '#44433d', accent: '#d97757', scheme: 'light' },
    warm: { bg: '#20201e', card: '#191917', border: '#2e2e2c', ink: '#f7f7f5', muted: '#9f9f9d', body: '#cfcec6', accent: '#d97757', scheme: 'dark' },
    black: { bg: '#000000', card: '#0e0e0e', border: '#222222', ink: '#f7f7f5', muted: '#9f9f9d', body: '#cfcec6', accent: '#d97757', scheme: 'dark' },
    fragment: { bg: '#1c1f24', card: '#232a33', border: '#384452', ink: '#fcfbfc', muted: '#747e89', body: '#c2c8d0', accent: '#2589db', scheme: 'dark' },
  }
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  var c = PAL[p.get('theme')] || (prefersDark ? PAL.warm : PAL.light)
  document.documentElement.style.colorScheme = c.scheme

  // On-page styles (style-src allows inline styles). Appended after the page's
  // own <style>, so these same-specificity rules win and re-theme it.
  var st = document.createElement('style')
  st.textContent =
    'html,body{background:' + c.bg + ';color:' + c.body + '}' +
    'h1,h2{color:' + c.ink + '}' +
    '.upd,.foot{color:' + c.muted + '}' +
    'p,li{color:' + c.body + '}' +
    'a{color:' + c.accent + '}'
  document.head.appendChild(st)

  var root = document.getElementById('root')
  var d = C[doc]
  document.documentElement.lang = 'en'
  document.title = 'mvp-n — ' + d.title
  root.innerHTML =
    '<h1>' + d.title + '</h1>' +
    '<p class="upd">Updated: ' + UPDATED + '</p>' +
    d.html +
    '<div class="foot">mvp-n</div>'
})()
