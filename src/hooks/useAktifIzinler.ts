import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Izin } from '../types';
import { getTurkeyDateString } from '../lib/dateUtils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export function useAktifIzinler() {
  const [aktifIzinler, setAktifIzinler] = useState<Izin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = getTurkeyDateString();
    const path = 'izinler';
    
    // Sadece onaylanmış izinleri getir
    const q = query(
      collection(db, path),
      where('durum', '==', 'onaylandi')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allApproved = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Izin[];
      
      // Bugün aktif olanları filtrele (client-side because Firestore doesn't support complex range queries on different fields easily without composite indexes)
      const active = allApproved.filter(izin => {
        return today >= izin.baslangic && today <= izin.bitis;
      });
      
      setAktifIzinler(active);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { aktifIzinler, loading };
}
