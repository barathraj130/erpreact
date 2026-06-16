import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/icon-192.png', 'icons/icon-512.png'],
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      },
      manifest: {
        name: 'Fluxora ERP',
        short_name: 'Fluxora',
        description: 'Business Enterprise Resource Planning System',
        display: 'standalone',
        start_url: '/',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    // Split heavy third-party libs into separate chunks so the main bundle
    // stays small and individual chunks can be cached independently.
    rollupOptions: {
      output: {
        manualChunks: {
          // PDF generation (~500 KB)
          pdf: ['jspdf'],
          // React ecosystem
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Chart / visualisation libs (recharts etc.) if present
          charts: ['recharts'],
          // Icon library
          icons: ['react-icons'],
        }
      }
    },
    // Warn but do not fail on chunks > 600 KB (Vite default is 500 KB)
    chunkSizeWarningLimit: 600,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})