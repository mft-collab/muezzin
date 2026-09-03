import { initializeApp } from 'firebase/app';
// import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'; // bkz. aşağıdaki geri alma notu
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInWithCustomToken } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);

// App Check GEÇİCİ OLARAK DEVRE DIŞI (P2.7 girişimi geri alındı):
// initializeAppCheck ilk deploy'dan hemen sonra production'da Google ile
// girişi kırdı ("Giriş yapılamadı" — muhtemelen reCAPTCHA Enterprise site
// key'i yalnızca localhost için kayıtlıydı, gerçek domain için değil).
// try/catch'siz ve modül yüklenirken (React render'dan ÖNCE) çalıştığından
// zarar yarıçapı tüm uygulamaydı. Kök neden (site key'in domain listesi +
// App Check'in Authentication API'si için ayrı bir enforcement anahtarı
// olup olmadığı) doğrulanana kadar kapalı tutuluyor — bkz. premium denetim
// P2.7, geri alma notu.
// const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
// if (recaptchaSiteKey && import.meta.env.VITE_USE_EMULATOR !== '1') {
//   initializeAppCheck(app, {
//     provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
//     isTokenAutoRefreshEnabled: true,
//   });
// }

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
