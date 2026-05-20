import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Bildirim } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

export function useHaftaBildirimleri(haftaId: string | undefined) {
  const [bildirimler, setBildirimler] = useState<Bildirim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!haftaId) {
      setBildirimler([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'bildirimler'),
      where('haftaId', '==', haftaId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBildirimler(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Bildirim, 'id'>) } as Bildirim)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bildirimler');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [haftaId]);

  return { bildirimler, loading };
}
