import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the built bundle works behind any static path (app.mvp-n.net / sub-path).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Allow tunnels (ngrok/cloudflared) while testing inside Telegram.
    allowedHosts: true,
  },
})
