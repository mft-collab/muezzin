import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { HaftaPlan } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useChangeKey } from './useChangeKey';

import { SizeLimitedCache } from '../lib/cache';

// Sayfa geçişlerinde skeleton 'zıplamasını' engellemek için Global Memory Cache
const globalHaftaPlanCache = new SizeLimitedCache<string, HaftaPlan & { id: string }>(10);

export function useHaftaPlan(haftaId: string) {
 const [plan, setPlan] = useState<(HaftaPlan & { id: string }) | null>(() => globalHaftaPlanCache.get(haftaId) || null);
 const [loading, setLoading] = useState(!globalHaftaPlanCache.has(haftaId));

 if (useChangeKey(haftaId)) {
 setPlan(haftaId ? (globalHaftaPlanCache.get(haftaId) || null) : null);
 setLoading(haftaId ? !globalHaftaPlanCache.has(haftaId) : false);
 }

 useEffect(() => {
 if (!haftaId) {
 return;
 }

 const unsubPlan = onSnapshot(doc(db, 'haftaPlanlari', haftaId), (snapshot) => {
 if (snapshot.exists()) {
 const data = { id: snapshot.id, ...snapshot.data() } as (HaftaPlan & { id: string });
 globalHaftaPlanCache.set(haftaId, data);
 setPlan(data);
 } else {
 globalHaftaPlanCache.delete(haftaId);
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
