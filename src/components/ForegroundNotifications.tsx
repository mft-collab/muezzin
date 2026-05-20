import { useEffect } from 'react';
import { onMessage } from 'firebase/messaging';
import { messaging } from '../lib/firebase';
import { useNotificationStore } from '../store/useNotificationStore';

export const ForegroundNotifications = () => {
  const { showNotification } = useNotificationStore();

  useEffect(() => {
    if (!messaging) return;

    // Listen for foreground messages
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);
      
      const { title, body } = payload.notification || {};
      const type = (payload.data?.type as any) || 'info';

      if (title || body) {
        showNotification(
          title || 'Yeni Bildirim', 
          body || '', 
          type
        );
      }
    });

    return () => unsubscribe();
  }, [showNotification]);

  return null; // This component doesn't render anything itself
};
