import React from 'react'
import ReactDOM from 'react-dom/client'
import { Buffer } from 'buffer'
import App from './App'

// @ton/core (loaded later in the lazy WalletPay chunk) uses the Node Buffer API
// at module-eval time, so it must be a global BEFORE that chunk loads. Set it
// here at boot — cheap, and guarantees availability for the jetton transfer.
if (!(globalThis as { Buffer?: unknown }).Buffer) (globalThis as { Buffer?: unknown }).Buffer = Buffer
import './index.css'
import { initTelegram } from './lib/telegram'
import { LangProvider } from './lib/i18n'
import { ErrorBoundary } from './components/ErrorBoundary'

// Self-heal a stale-deploy chunk 404: an open session holding an old index.html
// may request a hashed chunk a newer deploy replaced. Vite fires this on a failed
// dynamic import — reload ONCE (guarded) to fetch the fresh, no-store index.
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('mvpn_chunk_reloaded')) {
    sessionStorage.setItem('mvpn_chunk_reloaded', '1')
    location.reload()
  }
})

// Telegram's in-app WebView caches index.html aggressively and can keep serving
// an OLD build across re-opens — so new deploys silently don't reach the user
// (their edits/theme "don't update"). On boot, compare the running bundle hash
// to the server's current one (fetched no-store + cache-busted) and, if they
// differ, navigate once to a cache-busted URL to pull the latest. No-op in dev
// (the entry isn't a hashed /assets/ file) and offline (fetch just fails).
async function checkForUpdate() {
  try {
    const running = [...document.scripts]
      .map((s) => s.src)
      .find((s) => /\/assets\/index-[^/]+\.js/.test(s))
      ?.match(/index-([\w-]+)\.js/)?.[1]
    if (!running) return
    const html = await fetch('index.html?ts=' + Date.now(), { cache: 'no-store' }).then((r) => r.text())
    const latest = html.match(/index-([\w-]+)\.js/)?.[1]
    if (latest && latest !== running && !sessionStorage.getItem('mvpn_updated')) {
      sessionStorage.setItem('mvpn_updated', '1')
      location.replace(location.pathname + '?v=' + latest)
    }
  } catch {
    /* offline / parse failure — ignore, the app runs as-is */
  }
}
checkForUpdate()

// Never let a regression in init prevent the render (that would blank the app).
try {
  initTelegram()
} catch (e) {
  console.error('[mvp-n] initTelegram failed', e)
}

// Note: the TON Connect provider is NOT mounted here — it lives in the lazily
// loaded WalletPay component (loaded only when the user opens the GRAM payment),
// so the heavy @tonconnect/ui SDK stays out of the initial bundle.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <LangProvider>
        <App />
      </LangProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
