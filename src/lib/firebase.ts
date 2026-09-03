import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInWithCustomToken } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);

// App Check: istemcinin GERÇEK uygulama olduğunu doğrulayan katman —
// firestore.rules yalnızca YETKİLENDİRMEyi doğruluyordu, isteğin meşru bir
// tarayıcı/istemciden geldiğini doğrulayan bir katman hiç yoktu (bkz.
// premium denetim, bölüm 6/P2.7). VITE_RECAPTCHA_SITE_KEY tanımsızsa (yerel
// geliştirme, PR preview vb.) bu blok atlanır — ölümcül değil, yalnızca
// App Check pasif kalır. Emülatör modunda BİLEREK başlatılmaz: App Check
// production Firebase projesine karşı reCAPTCHA doğrulaması yapar, yerel
// Firestore/Auth emülatörleriyle (ve bu emülatörlere karşı çalışan e2e
// testleriyle) bir ilgisi yoktur ve gereksiz ağ çağrıları/hata gürültüsü
// üretir.
// ÖNEMLİ: Bu yalnızca İZLEME modudur — Firebase Console'da "Enforce"
// açılmadığı sürece App Check hiçbir isteği REDDETMEZ, yalnızca
// Console'daki App Check panelinde doğrulanmış/doğrulanmamış istek
// oranını göstermeye başlar. Zorlamaya geçiş ayrı, bilinçli bir karar —
// bkz. docs/RUNBOOK.md.
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (recaptchaSiteKey && import.meta.env.VITE_USE_EMULATOR !== '1') {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

// Initialize Firestore with persistent cache for PWA support
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' ? firebaseConfig.firestoreDatabaseId : undefined);

export const auth = getAuth(app);

// E2E/yerel test modu: gerçek projeye değil, `firebase emulators:start`ile
// açılan yerel Firestore/Auth emülatörlerine bağlan. VITE_USE_EMULATOR=1
// olmadan bu blok hiç çalışmaz — production build'de etkisizdir.
if (import.meta.env.VITE_USE_EMULATOR === '1') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  // Playwright testlerinin gerçek bir Firebase Auth oturumu açabilmesi için
  // (bkz. tests/e2e/mazeret-flow.spec.ts) — yalnızca emülatör modunda. Bir
  // fonksiyon olarak dışa açılıyor çünkü page.evaluate() içine enjekte
  // edilen kod, uygulamanın kendi modül grafiğindeki bare import'ları
  // (ör. 'firebase/auth') çözemez.
  window.__testSignIn = (token: string) => signInWithCustomToken(auth, token);
}
