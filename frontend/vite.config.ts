import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' so the built bundle works behind any static path (app.mvp-n.net / sub-path).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    // Allow tunnels (ngrok/cloudflared) while testing inside Telegram.
    allowedHosts: true,
  },
})
