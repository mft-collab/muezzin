import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Izin } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

export function useAdminIzinler() {
  const [izinler, setIzinler] = useState<Izin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const path = 'izinler';
    const q = query(
      collection(db, path)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Izin[];
      
      data.sort((a, b) => {
        const timeA = a.olusturmaTarihi?.toMillis() || 0;
        const timeB = b.olusturmaTarihi?.toMillis() || 0;
        return timeB - timeA;
      });

      setIzinler(data);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const izinGuncelle = async (id: string, durum: 'onaylandi' | 'reddedildi') => {
    const path = `izinler/${id}`;
    try {
      await updateDoc(doc(db, 'izinler', id), { durum });
    } catch (err) {
      throw handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const izinSil = async (id: string) => {
    const path = `izinler/${id}`;
    try {
      await deleteDoc(doc(db, 'izinler', id));
    } catch (err) {
      throw handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  return { izinler, loading, error, izinGuncelle, izinSil };
}
