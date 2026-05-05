import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { AdminUyarisi } from '../../types';

export function useKrizAlarmlari() {
  const [alarmlar, setAlarmlar] = useState<(AdminUyarisi & { id: string })[]>([]);
  const [cozulmamisSayisi, setCozulmamisSayisi] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sort by boolean is not natively supported directly, we fetch and sort in memory
    // or we just fetch ordered by date descending
    const q = query(collection(db, 'adminUyarilari'), orderBy('olusturmaTarihi', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let activeCount = 0;
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        if (!d.cozuldu) activeCount++;
        return { id: doc.id, ...d } as (AdminUyarisi & { id: string });
      });
      
      // Sort: unresolved first, then by date descending
      data.sort((a, b) => {
        if (a.cozuldu === b.cozuldu) return 0;
        return a.cozuldu ? 1 : -1;
      });

      setAlarmlar(data);
      setCozulmamisSayisi(activeCount);
      setLoading(false);
    }, (error) => {
      console.error("Firebase adminUyarilari onSnapshot error (useKrizAlarmlari):", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { alarmlar, cozulmamisSayisi, loading };
}
