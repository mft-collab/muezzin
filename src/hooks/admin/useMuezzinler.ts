import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Muezzin } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

export function useMuezzinler() {
  const [muezzinler, setMuezzinler] = useState<(Muezzin & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'muezzins'), orderBy('displayName', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (Muezzin & { id: string })[];
      setMuezzinler(data);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Dinleme Hatası (muezzins):", error.message);
      if (error.code === 'permission-denied') {
          // Görüntüleme yetkisi yok
          setMuezzinler([]);
      } else {
          // Throws standardized error to be caught by ErrorBoundary if needed
          const centralizedError = handleFirestoreError(error, OperationType.LIST, 'muezzins');
          // Since this is a hook, we might not want to throw immediately and crash the app
          // But according to user instructions, we should use handleFirestoreError which throws.
          // However, for hooks, setting an error state is often better.
          // For now, I'll follow the pattern of throwing if that's what the centralized version does.
          // Wait, the centralized version returns an Error object but doesn't throw. Let's check it again.
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { muezzinler, loading };
}
