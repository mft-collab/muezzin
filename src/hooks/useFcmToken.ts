import { useState, useEffect } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { app, db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

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
