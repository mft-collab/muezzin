import { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { HaftaPlan, Muezzin } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export function useHaftaPlan(haftaId: string) {
  const [plan, setPlan] = useState<(HaftaPlan & { id: string }) | null>(null);
  const [muezzinler, setMuezzinler] = useState<Record<string, Muezzin>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!haftaId) {
      setPlan(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubPlan = onSnapshot(doc(db, 'haftaPlanlari', haftaId), (snapshot) => {
      if (snapshot.exists()) {
        setPlan({ id: snapshot.id, ...snapshot.data() } as (HaftaPlan & { id: string }));
      } else {
        setPlan(null);
      }
      // Note: We only set loading false after both or if plan fails. 
      // For simplicity, we assume muezzins load fast.
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `haftaPlanlari/${haftaId}`);
      setLoading(false);
    });
    
    const qMuezzins = query(collection(db, 'muezzins'), orderBy('displayName', 'asc'));
    const unsubMuezzinler = onSnapshot(qMuezzins, (snapshot) => {
      const data: Record<string, Muezzin> = {};
      snapshot.forEach(d => data[d.id] = d.data() as Muezzin);
      setMuezzinler(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'muezzins');
      setLoading(false);
    });

    return () => { unsubPlan(); unsubMuezzinler(); };
  }, [haftaId]);

  return { plan, muezzinler, loading };
}
