import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Bildirim, Vakit } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export function useVakitBildirimleri(tarih: string | undefined, vakit: Vakit | undefined) {
  const [bildirimler, setBildirimler] = useState<Bildirim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tarih || !vakit) {
      setBildirimler([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'bildirimler'),
      where('tarih', '==', tarih),
      where('vakit', '==', vakit)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBildirimler(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Bildirim, 'id'>) } as Bildirim)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bildirimler');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tarih, vakit]);

  return { bildirimler, loading };
}
