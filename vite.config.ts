import { VitePWA } from 'vite-plugin-pwa';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  server: {
    port: 3000,
    strictPort: true, // Port kaymasını engelle (Firebase Auth için kritik)
    headers: {
      'Cross-Origin-Opener-Policy': 'unsafe-none',
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      manifestFilename: 'manifest.json',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true,
        type: 'module',
        suppressWarnings: true
      },
      includeAssets: ['favicon.svg', 'pwa-192x192.svg', 'pwa-512x512.svg'],
      manifest: {
        name: "Cami Hizmetleri Koordinasyon Sistemi",
        short_name: "Cami Hizmetleri",
        description: "Cami ve Din Görevlileri Hizmet Planlama Sistemi",
        theme_color: "#F5F5F7",
        background_color: "#F5F5F7",
        display: "standalone",
        id: "/",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "tr",
        categories: ["productivity", "utilities"],
        icons: [
          {
            src: '/pwa-192x192.svg?v=3',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.svg?v=3',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.svg?v=3',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globDirectory: 'dist',
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        importScripts: ['/firebase-messaging-sw.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // 1. Core Framework (strictly isolated — must not share with others)
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/') ||
            id.includes('/object-assign/')
          ) {
            return 'vendor-react';
          }

          // 2. Firebase (large, self-contained)
          if (id.includes('firebase') || id.includes('@firebase')) {
            return 'vendor-firebase';
          }

          // 3. Animation library
          if (id.includes('motion') || id.includes('framer-motion')) {
            return 'vendor-motion';
          }

          // 4. Routing
          if (id.includes('react-router') || id.includes('@remix-run')) {
            return 'vendor-router';
          }

          // 5. State management
          if (id.includes('zustand')) {
            return 'vendor-state';
          }

          // 6. Everything else (date-fns, lucide, etc.)
          return 'vendor-utils';
        }
      }
    }
  }
}));

