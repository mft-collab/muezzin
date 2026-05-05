import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Bildirim } from '../types';
import { getTurkeyDateString } from '../lib/dateUtils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export function useBugunkuGorevlerim() {
  const [gorevler, setGorevler] = useState<Bildirim[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTarih, setCurrentTarih] = useState(getTurkeyDateString());

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setGorevler([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'bildirimler'),
      where('uid', '==', user.uid),
      where('tarih', '==', currentTarih)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGorevler(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Bildirim, 'id'>) } as Bildirim)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bildirimler');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentTarih]);

  useEffect(() => {
    const interval = setInterval(() => {
      const yeniTarih = getTurkeyDateString();
      if (yeniTarih !== currentTarih) {
        setCurrentTarih(yeniTarih);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [currentTarih]);

  return { gorevler, loading };
}
