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

initTelegram()

// Note: the TON Connect provider is NOT mounted here — it lives in the lazily
// loaded WalletPay component (loaded only when the user opens the GRAM payment),
// so the heavy @tonconnect/ui SDK stays out of the initial bundle.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
  </React.StrictMode>,
)
