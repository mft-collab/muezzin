import { useState, useEffect } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { messaging, db, auth } from '../lib/firebase';

const VAPID_KEY =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuB22m3G_Q-6TpH8p-81mD0XN8';

async function saveTokenToFirestore(uid: string, token: string) {
  await setDoc(doc(db, 'muezzins', uid), { fcmToken: token }, { merge: true }).catch(() => {});
}

export function useFcmToken() {
  const [token, setToken] = useState<string | null>(null);
  const [notificationPermissionStatus, setNotificationPermissionStatus] =
    useState<NotificationPermission | null>(null);

  useEffect(() => {
    let unsubscribeAuth: (() => void) | null = null;

    const retrieveToken = async () => {
      try {
        if (typeof window === 'undefined' || !('Notification' in window)) return;

        const permission = await Notification.requestPermission();
        setNotificationPermissionStatus(permission);

        if (permission !== 'granted' || !messaging) return;

        const registration = await navigator.serviceWorker.ready;
        const currentToken = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration,
        });

        if (!currentToken) return;

        setToken(currentToken);

        const user = auth.currentUser;
        if (user) {
          await saveTokenToFirestore(user.uid, currentToken);
        } else {
          unsubscribeAuth = onAuthStateChanged(auth, async (freshUser) => {
            if (freshUser) {
              await saveTokenToFirestore(freshUser.uid, currentToken);
              unsubscribeAuth?.();
              unsubscribeAuth = null;
            }
          });
        }
      } catch (error) {
        // Silently fail
      }
    };

    const timeoutId = setTimeout(retrieveToken, 300);

    return () => {
      clearTimeout(timeoutId);
      unsubscribeAuth?.();
    };
  }, []);

  return { token, notificationPermissionStatus };
}
