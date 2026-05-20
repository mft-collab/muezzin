import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Bildirim } from '../types';
import { getTurkeyDateString } from '../lib/dateUtils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useAuthStore } from '../store/useAuthStore';

export function useBugunkuGorevlerim() {
  const [gorevler, setGorevler] = useState<Bildirim[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTarih, setCurrentTarih] = useState(getTurkeyDateString());

  // Reaktif olarak store'dan al — auth.currentUser doğrudan kullanımı
  // oturum açılışında hook'u yeniden tetiklemez
  const uid = useAuthStore(s => s.user?.uid);

  useEffect(() => {
    if (!uid) {
      setGorevler([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, 'bildirimler'),
      where('uid', '==', uid),
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
  }, [uid, currentTarih]);

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
