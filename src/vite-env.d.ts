/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// vite.config.ts `define` bloğunda gömülen build-zamanı sabitleri
declare const __APP_VERSION__: string;
declare const __BUILD_TIMESTAMP__: string;

// Modüller arası döngüsel bağımlılık kurmadan (React state/store aboneliği
// gerektirmeden) senkron erişim için globalThis'e yazılan zaman/hicri
// düzeltme değerleri — bkz. lib/timeSync.ts, lib/dateUtils.ts,
// store/useSystemSettingsStore.ts. Önceden her çağrı noktasında ayrı ayrı
// `as any` ile erişiliyordu; tek bir ambient tip bildirimine taşındı.
// NOT: Bu dosya import/export içermeyen bir "global script" — `declare global`
// sarmalayıcısı yalnızca modül dosyalarında gereklidir, burada üst düzeyde
// bildirim doğrudan global kapsama girer.
// eslint-disable-next-line no-var -- globalThis üzerinde ambient bildirim için `var` şart.
declare var __timeOffset: number | undefined;
// eslint-disable-next-line no-var -- globalThis üzerinde ambient bildirim için `var` şart.
declare var __hicriOffset: number | undefined;

interface Window {
  /** Yalnızca Playwright E2E ortamında enjekte edilir (bkz. lib/firebase.ts). */
  __testSignIn?: (token: string) => Promise<unknown>;
  /** Eski Safari/WebKit'in vendor-prefixli AudioContext'i (bkz. lib/sounds.ts). */
  webkitAudioContext?: typeof AudioContext;
}
