import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { AdminUyarisi } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

export function useKrizAlarmlari() {
  const [alarmlar, setAlarmlar] = useState<(AdminUyarisi & { id: string })[]>([]);
  const [cozulmamisSayisi, setCozulmamisSayisi] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'adminUyarilari'), orderBy('olusturmaTarihi', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let activeCount = 0;
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        if (!d.cozuldu) activeCount++;
        return { id: doc.id, ...d } as (AdminUyarisi & { id: string });
      });

      // Çözülmemişler önce, ardından tarihe göre azalan sıra
      data.sort((a, b) => {
        if (a.cozuldu === b.cozuldu) return 0;
        return a.cozuldu ? 1 : -1;
      });

      setAlarmlar(data);
      setCozulmamisSayisi(activeCount);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'adminUyarilari');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { alarmlar, cozulmamisSayisi, loading };
}

