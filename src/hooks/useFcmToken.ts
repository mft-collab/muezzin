import { useState, useEffect } from 'react';
import { doc, serverTimestamp, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { app, db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { zamanAsimiIle } from '../lib/timeoutUtils';
import { useNotificationStore } from '../store/useNotificationStore';
import { telemetryService } from '../services/telemetryService';

// NOT: Bu değer Firebase Console → Proje Ayarları → Cloud Messaging →
// Web push sertifikaları'ndan alınan GERÇEK VAPID public key olmalı.
// Daha önce burada web-push codelab'lerinde dolaşan herkese açık ÖRNEK bir
// anahtar sabitlenmişti — bu, tarayıcının kayıtlı olduğu push aboneliğinin
// projenin gerçek gönderen kimliğiyle eşleşmemesine (SenderIdMismatch) ve
// admin SDK'nın bu token'lara bildirim göndermesinin sessizce başarısız
// olmasına yol açar.
const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;

async function saveTokenToFirestore(uid: string, token: string) {
  const path = `muezzins/${uid}`;
  try {
    await setDoc(
      doc(db, 'muezzins', uid),
      {
        fcmToken: token,
        fcmTokens: {
          [token]: serverTimestamp()
        }
      },
      { merge: true }
    );
  } catch (err) {
    // Push token kaydı arka planda, kullanıcıya görünmeden çalışır — ama
    // sessizce başarısız olursa kişi nöbet hatırlatıcısı almadığını hiç
    // fark etmez. handleFirestoreError ile telemetriye düşürülür ki bu
    // durum en azından geliştirici tarafında görünür olsun (bkz. algoritma
    // denetimi).
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function registerFcmToken(requestPermission = false): Promise<{
 token: string | null;
 permission: NotificationPermission | null;
}> {
 if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
 return { token: null, permission: null };
 }

 const permission = requestPermission
 ? await Notification.requestPermission()
 : Notification.permission;

 if (permission !== 'granted') {
 return { token: null, permission };
 }

 if (!VAPID_KEY) {
 console.warn('VITE_FCM_VAPID_KEY tanımlı değil; push bildirimleri devre dışı.');
 return { token: null, permission };
 }

 const [{ getMessaging, getToken }, registration] = await Promise.all([
 import('firebase/messaging'),
 navigator.serviceWorker.ready
 ]);
 const messaging = getMessaging(app);
 const currentToken = await getToken(messaging, {
 vapidKey: VAPID_KEY,
 serviceWorkerRegistration: registration,
 });

 if (!currentToken) {
 return { token: null, permission };
 }

 const user = auth.currentUser;
 if (user) {
 await saveTokenToFirestore(user.uid, currentToken);
 }

 return { token: currentToken, permission };
}

/**
 * Çıkış (logout) sırasında bu cihazın push aboneliğini iptal eder ve
 * Firestore'daki `fcmTokens` haritasından bu cihaza ait girdiyi siler.
 *
 * Önceden `logout()` yalnızca `auth.signOut()` çağırıyordu — cihazın FCM
 * token'ı hem tarayıcıda hem Firestore'da kayıtlı kalıyordu. Paylaşılan/ortak
 * bir cihazda (ör. cami ofisindeki tablet) bir müezzin çıkış yaptıktan sonra
 * bir başkası giriş yapsa bile, eski kullanıcının push aboneliği hâlâ aktif
 * kalıyor ve nöbet hatırlatıcı/mazeret bildirimleri o cihaza gelmeye devam
 * edebiliyordu. Ayrıca `fcmTokens` haritası yalnızca GÖNDERİM BAŞARISIZ
 * olduğunda sunucu tarafında budanıyor (bkz. scripts/haftalikPlanOlustur.ts,
 * scripts/yatsiSonuIslemleri.ts) — çıkış yapılsa da token teknik olarak
 * hâlâ geçerli olduğundan bu şekilde asla temizlenmiyordu ve
 * firestore.rules'taki `isValidFcmTokens` 20 girdi tavanına (bkz. mimari
 * denetim) zamanla çarpılabiliyordu.
 *
 * Firestore güncellemesi `auth.signOut()`'tan ÖNCE çağrılmalı — kendi
 * `muezzins/{uid}` belgesini güncelleme izni yalnızca oturum açıkken var.
 */
export async function unregisterFcmToken(uid: string | undefined): Promise<void> {
  if (!uid) return;
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return;
  if (!VAPID_KEY) return;

  try {
    const [{ getMessaging, getToken, deleteToken }, registration] = await Promise.all([
      import('firebase/messaging'),
      navigator.serviceWorker.getRegistration(),
    ]);
    if (!registration) return;

    const messaging = getMessaging(app);
    const currentToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    }).catch(() => null);

    await deleteToken(messaging).catch(() => {});

    if (currentToken) {
      await updateDoc(doc(db, 'muezzins', uid), {
        [`fcmTokens.${currentToken}`]: deleteField(),
      }).catch(() => {});
    }
  } catch {
    // Çıkış akışını asla engellemesin — en iyi çaba (best-effort) temizlik.
  }
}

/**
 * Uygulamadaki HER "Oturumu Kapat" düğmesinin çağırması gereken tek
 * çıkış yolu — `unregisterFcmToken` + `auth.signOut()` sırasını garanti eder.
 *
 * Bu tek fonksiyon olmadan üç ayrı ekran (AuthGuard.tsx, MuezzinAyarlari.tsx,
 * admin/AdminPanel.tsx) kendi `auth.signOut()` çağrısını doğrudan yapıyordu;
 * FCM token temizliği yalnızca AuthGuard'a eklenmişti (bkz. yukarıdaki
 * unregisterFcmToken yorumu) — normal kullanıcıların günlük akışta asıl
 * kullandığı MuezzinAyarlari.tsx'in çıkış düğmesi ve admin panelinin çıkış
 * düğmesi bu düzeltmeyi hiç görmüyordu (bkz. code-review, dördüncü denetim
 * turu). Yeni bir çıkış noktası eklenirse aynı sınıf regresyonu tekrarlamamak
 * için doğrudan `auth.signOut()` yerine bu fonksiyon çağrılmalı.
 *
 * `unregisterFcmToken` içindeki Firestore yazımı çevrimdışıyken (SDK'nın
 * persistentLocalCache'i etkinken) sonsuza dek askıda kalabiliyordu — bu da
 * `await`'in hiç dönmemesine, dolayısıyla `auth.signOut()`'un hiç
 * çağrılmamasına yol açıyordu: kullanıcı çevrimdışıyken "çıkış yapamaz"
 * halde kalıyordu (bkz. beşinci denetim turu). `unregisterFcmToken` zaten
 * en-iyi-çaba (best-effort) bir temizlik olduğundan, kısa bir zaman aşımı
 * sonrası beklemeden `auth.signOut()`'a devam edilir — Firestore'un kendi
 * offline kuyruğu token temizliğini arka planda tamamlar.
 */
export async function performLogout(): Promise<void> {
  try {
    await zamanAsimiIle(unregisterFcmToken(auth.currentUser?.uid), 4000);
  } catch {
    // Zaman aşımı ya da başka bir hata — temizlik en iyi çabaydı, çıkışı
    // engellemeden devam et.
  }
  await auth.signOut();
  // FCM token temizliğiyle AYNI sınıftan bir sızıntı: bildirim geçmişi
  // (localStorage, cihaz bazlı) ve breadcrumb tamponu (modül-seviyesi,
  // sekme ömrü boyunca) kullanıcı bazlı değil — paylaşılan bir cihazda
  // (ör. cami ofisi tableti) çıkış yapmadan temizlenmezse bir sonraki
  // kullanıcı öncekinin bildirim geçmişini/hata izlerini görmeye devam
  // eder (bkz. mimari denetim).
  useNotificationStore.getState().clearHistory();
  telemetryService.clearBreadcrumbs();
}

export function useFcmToken() {
 const [token, setToken] = useState<string | null>(null);
 const [notificationPermissionStatus, setNotificationPermissionStatus] =
 useState<NotificationPermission | null>(null);

 useEffect(() => {
 let unsubAuth: (() => void) | null = null;

 const retrieveToken = async () => {
 try {
 if (typeof window === 'undefined' || !('Notification' in window)) return;
 const { token: currentToken, permission } = await registerFcmToken(false);
 setNotificationPermissionStatus(permission);

 if (!currentToken) return;
 setToken(currentToken);

 if (!auth.currentUser) {
 unsubAuth = onAuthStateChanged(auth, async (freshUser) => {
 if (freshUser) {
 await saveTokenToFirestore(freshUser.uid, currentToken);
 unsubAuth?.();
 unsubAuth = null;
 }
 });
 }
 } catch (error) {
 console.warn('FCM token alinamadi:', error);
 }
 };

 const timeoutId = setTimeout(retrieveToken, 300);

 return () => {
 clearTimeout(timeoutId);
 if (unsubAuth) unsubAuth();
 };
 }, []);

 return { token, notificationPermissionStatus };
}
