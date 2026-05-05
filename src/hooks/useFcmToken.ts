import { useState, useEffect } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { messaging, db, auth } from '../lib/firebase';

const VAPID_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuB22m3G_Q-6TpH8p-81mD0XN8'; // Lütfen kendi Firebase Console'unuzdan aldığınız VAPID anahtarı ile değiştirin

export function useFcmToken() {
  const [token, setToken] = useState<string | null>(null);
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    let unsubscribeMessage: (() => void) | undefined;
    
    const retrieveToken = async () => {
      try {
        if (typeof window !== 'undefined' && 'Notification' in window) {
          const permission = await Notification.requestPermission();
          setNotificationPermissionStatus(permission);

          if (permission === 'granted' && messaging) {
            
            // Wait for service worker to be ready
            const registration = await navigator.serviceWorker.ready;
            
            const currentToken = await getToken(messaging, {
              vapidKey: VAPID_KEY,
              serviceWorkerRegistration: registration,
            });
            
            if (currentToken) {
              setToken(currentToken);
              
              // Save token to Firestore if user is authenticated
              const user = auth.currentUser;
              if (user) {
                await setDoc(
                  doc(db, 'muezzins', user.uid),
                  { fcmToken: currentToken },
                  { merge: true }
                ).catch((e) => console.log('Error saving token', e));
              }
            } else {
              console.log('No registration token available. Request permission to generate one.');
            }

            // Also set up foreground message listener
            unsubscribeMessage = onMessage(messaging, (payload) => {
              console.log('Foreground notification received:', payload);
              if (payload.notification) {
                // If you want to show a toast message here you can.
                // toast(payload.notification.title || 'Yeni Bildirim', { description: payload.notification.body });
              }
            });
          }
        }
      } catch (error) {
        console.log('Error retrieving token:', error);
      }
    };

    // Give the auth a tiny bit of time to initialize just in case this component mounts immediately
    const timeoutId = setTimeout(retrieveToken, 1000);

    return () => {
      clearTimeout(timeoutId);
      if (unsubscribeMessage) {
        unsubscribeMessage();
      }
    };
  }, []);

  return { token, notificationPermissionStatus };
}
