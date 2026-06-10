import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png'],
      // Raise precache limit to 5 MB — jsPDF + chart libs push the main
      // chunk over the default 2 MiB threshold and turn the build into an error.
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
      },
      manifest: {
        name: 'ERP System',
        short_name: 'ERP',
        description: 'Business Enterprise Resource Planning System',
        theme_color: '#1a73e8',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
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