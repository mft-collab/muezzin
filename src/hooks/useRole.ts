import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export function useRole() {
  const [role, setRole] = useState<'admin' | 'muezzin' | 'gozlemci' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, 'muezzins', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setRole(docSnap.data().role);
          } else {
            // Check if bootstrap admin (by UID or Email)
            const currentEmail = user.email?.toLowerCase();
            const bootstrapUid = 'upOT-kFmqHPdYUH70bGQS87WUd37aPeJ3AjlMCUoYnE';
            if (user.uid === bootstrapUid || currentEmail === 'muftum@gmail.com'.toLowerCase()) {
              setRole('admin');
            } else {
              setRole(null);
            }
          }
        } catch (err) {
          console.error("useRole error:", err);
          setRole(null);
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { role, isAdmin: role === 'admin', loading };
}
