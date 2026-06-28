import { ref, onValue, getDatabase } from 'firebase/database';
import { app } from './firebase';

/**
 * Initializes the server time offset synchronization.
 * Firebase Realtime Database provides a special /.info/serverTimeOffset location
 * which estimates the client's clock skew with respect to the Firebase servers.
 * It is free and does not consume Firestore reads/writes.
 */
export function initTimeSync() {
  try {
    // If we're in a Node environment (like smoke tests), skip RTDB initialization
    if (typeof window === 'undefined') return;

    const db = getDatabase(app);
    const offsetRef = ref(db, '.info/serverTimeOffset');

    onValue(offsetRef, (snap) => {
      const offset = snap.val() || 0;
      // Store in globalThis so it can be synchronously accessed by dateUtils
      // without needing React state or store subscriptions (avoids re-renders).
      (globalThis as any).__timeOffset = offset;
    });
  } catch (err) {
    console.warn('Time synchronization failed to initialize:', err);
  }
}
