import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export interface Duyuru {
  id: string;
  baslik: string;
  icerik: string;
  tip: 'onemli' | 'bilgi' | 'duyuru';
  yazar?: string;
  tarih: import('firebase/firestore').Timestamp | string;
}

export function useDuyurular(count = 3) {
  const [duyurular, setDuyurular] = useState<Duyuru[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const path = 'duyurular';

    const fetchDuyurular = async () => {
      if (isMounted) setLoading(true);
      const q = query(
        collection(db, path),
        orderBy('tarih', 'desc'),
        limit(count)
      );

      try {
        const snapshot = await getDocs(q);
        if (!isMounted) return;
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Duyuru[];
        setDuyurular(data);
      } catch (err) {
        if (!isMounted) return;
        handleFirestoreError(err, OperationType.GET, path);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDuyurular();

    return () => {
      isMounted = false;
    };
  }, [count]);

  return { duyurular, loading };
}

