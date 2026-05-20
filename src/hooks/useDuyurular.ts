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
    const fetchDuyurular = async () => {
      setLoading(true);
      const path = 'duyurular';
      const q = query(
        collection(db, path),
        orderBy('tarih', 'desc'),
        limit(count)
      );

      try {
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Duyuru[];
        setDuyurular(data);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, path);
      } finally {
        setLoading(false);
      }
    };

    fetchDuyurular();
  }, [count]);

  return { duyurular, loading };
}
