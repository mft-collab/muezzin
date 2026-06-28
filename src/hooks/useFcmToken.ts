import { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { app, db, auth } from '../lib/firebase';

const VAPID_KEY =
 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuB22m3G_Q-6TpH8p-81mD0XN8';

async function saveTokenToFirestore(uid: string, token: string) {
  const now = new Date().toISOString();
  await setDoc(
    doc(db, 'muezzins', uid),
    {
      fcmToken: token,
      fcmTokens: {
        [token]: now
      }
    },
    { merge: true }
  );
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
