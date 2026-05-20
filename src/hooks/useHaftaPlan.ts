import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { HaftaPlan } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export function useHaftaPlan(haftaId: string) {
  const [plan, setPlan] = useState<(HaftaPlan & { id: string }) | null>(null);
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
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `haftaPlanlari/${haftaId}`);
      setLoading(false);
    });
    
    return () => unsubPlan();
  }, [haftaId]);

  return { plan, loading };
}
