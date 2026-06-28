import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Bildirim } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

export function useMazeretGecmisi() {
 const [reddedilenler, setReddedilenler] = useState<(Bildirim & { id: string })[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 const q = query(
 collection(db, 'bildirimler'),
 where('durum', '==', 'reddedildi')
 );

 const unsubscribe = onSnapshot(q, (snapshot) => {
 const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (Bildirim & { id: string })[];
 // Client side sort to avoid requiring a composite index
 data.sort((a, b) => b.tarih.localeCompare(a.tarih));
 setReddedilenler(data);
 setLoading(false);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'bildirimler');
    setLoading(false);
  });

 return () => unsubscribe();
 }, []);

 return { gecmis: reddedilenler, loading };
}
