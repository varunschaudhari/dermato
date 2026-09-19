import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// In Docker, the backend is reachable at the service name (see docker-compose.yml's
// BACKEND_URL), not localhost — everywhere else this just defaults to localhost.
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Dermato — Skin Analysis',
        short_name: 'Dermato',
        description: 'AI-assisted dermatology skin analysis and progress tracking',
        theme_color: '#0d9488',
        background_color: '#f9fafb',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell only — patient data (/api) and photos (/uploads)
        // must never be served stale from a cache, so navigation fallback skips them.
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
      },
    }),
  ],
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api': backendUrl,
      '/uploads': backendUrl,
      '/health': backendUrl,
    },
  },
})
