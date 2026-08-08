import { VitePWA } from 'vite-plugin-pwa';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig(({ mode }) => ({
  server: {
    port: 3000,
    strictPort: true, // Port kaymasını engelle (Firebase Auth için kritik)
    headers: {
      'Cross-Origin-Opener-Policy': 'unsafe-none',
    },
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  define: {
    // package.json sürümü ve GERÇEK build zamanı, telemetride hata anının
    // değil derleme anının bilgisini taşısın diye derleme zamanında gömülür
    // (bkz. src/services/telemetryService.ts).
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
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
      includeAssets: ['favicon.svg', 'pwa-192x192.svg', 'pwa-512x512.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: "Müezzin - Hizmet Dizgesi",
        short_name: "Müezzin Dizgesi",
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
          },
          // PNG varyantları: bazı Android launcher'ları/OS entegrasyonları
          // SVG manifest ikonlarını desteklemez.
          {
            src: '/pwa-192x192.png?v=3',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png?v=3',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png?v=3',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globDirectory: 'dist',
        // Fontlar artık self-host (bkz. src/index.css @fontsource import'ları) — woff2/woff
        // build çıktısına dahil olduğundan burada da precache edilmesi gerekiyor. Google
        // Fonts CDN runtimeCaching kuralları bu nedenle kaldırıldı (artık hiçbir istek
        // fonts.googleapis.com/fonts.gstatic.com'a gitmiyor).
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,woff}'],
        // @fontsource-variable/inter ve jetbrains-mono paketleri (opsz.css/wght.css)
        // her zaman TÜM script alt kümelerini (latin, latin-ext, cyrillic,
        // cyrillic-ext, greek, greek-ext, vietnamese) ayrı @font-face + unicode-range
        // kuralları olarak üretir — tarayıcı normalde yalnızca sayfada gerçekten
        // kullanılan unicode-range'i indirir (bu kısım zaten optimal), ama workbox'ın
        // globPatterns'ı unicode-range'i anlamaz ve DIST'teki her font dosyasını
        // körü körüne precache eder. Uygulama yalnızca Türkçe (lang: "tr") olduğundan
        // kiril/yunan/vietnamca alt kümeleri hiçbir zaman render edilmiyor ama yine de
        // her PWA kurulumunda/güncellemesinde indirilip önbelleğe alınıyordu (~330KB,
        // toplam font payload'ının ~%33'ü — bkz. performans analizi). Bu üç desen
        // yalnızca precache'i hedefliyor; tarayıcının runtime unicode-range
        // davranışına dokunmuyor, bu yüzden işlevsel bir risk taşımıyor.
        globIgnores: ['**/*-cyrillic-*', '**/*-greek-*', '**/*-vietnamese-*'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        importScripts: ['/firebase-messaging-sw.js']
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

          // 2. Firebase Messaging is lazy-loaded after app boot.
          if (id.includes('firebase/messaging') || id.includes('@firebase/messaging')) {
            return 'vendor-firebase-messaging';
          }

          // 3. Firebase Auth — needed immediately at boot (login gate), kept
          // separate from Firestore so the login screen doesn't wait on the
          // larger Firestore bundle to parse.
          if (id.includes('firebase/auth') || id.includes('@firebase/auth')) {
            return 'vendor-firebase-auth';
          }

          // 4. Firebase core/Firestore
          if (id.includes('firebase') || id.includes('@firebase')) {
            return 'vendor-firebase';
          }

          // 5. Animation library
          if (id.includes('motion') || id.includes('framer-motion')) {
            return 'vendor-motion';
          }

          // 6. Routing
          if (id.includes('react-router') || id.includes('@remix-run')) {
            return 'vendor-router';
          }

          // 7. State management
          if (id.includes('zustand')) {
            return 'vendor-state';
          }

          // 8. Everything else (date-fns, lucide, etc.)
          return 'vendor-utils';
        }
      }
    }
  }
}));
