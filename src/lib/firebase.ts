import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import * as firestore from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);

// Initialize Firestore with persistent cache for PWA support
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' ? firebaseConfig.firestoreDatabaseId : undefined);

export const auth = getAuth(app);

// Track active listeners globally at runtime
try {
  const originalOnSnapshot = firestore.onSnapshot;
  (window as any).__activeFirestoreListeners = 0;
  
  Object.defineProperty(firestore, 'onSnapshot', {
    value: function(...args: any[]) {
      (window as any).__activeFirestoreListeners = ((window as any).__activeFirestoreListeners || 0) + 1;
      if ((window as any).__onFirestoreListenersChange) {
        (window as any).__onFirestoreListenersChange((window as any).__activeFirestoreListeners);
      }
      
      const unsubscribe = originalOnSnapshot.apply(this, args as any);
      return () => {
        unsubscribe();
        (window as any).__activeFirestoreListeners = Math.max(0, ((window as any).__activeFirestoreListeners || 0) - 1);
        if ((window as any).__onFirestoreListenersChange) {
          (window as any).__onFirestoreListenersChange((window as any).__activeFirestoreListeners);
        }
      };
    },
    writable: true,
    configurable: true
  });
} catch (e) {
  console.warn("Could not patch onSnapshot for telemetry:", e);
}
