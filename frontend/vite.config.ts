import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' so the built bundle works behind any static path (app.mvp-n.net / sub-path).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split the React runtime (react + react-dom/client + scheduler) into its
        // own chunk so it stays cached across deploys (app-code changes don't
        // invalidate it) → faster repeat loads.
        manualChunks(id) {
          if (
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react/') ||
            id.includes('node_modules/scheduler')
          ) {
            return 'react'
          }
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    // Allow tunnels (ngrok/cloudflared) while testing inside Telegram.
    allowedHosts: true,
  },
})
