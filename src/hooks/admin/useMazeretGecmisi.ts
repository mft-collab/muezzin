import { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
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

 // retSebebi artık bildirimler snapshot'ında gelmiyor — ayrı,
 // yalnızca kendisi+admin'in okuyabildiği mazeret_detaylari
 // koleksiyonuna taşındı (bkz. firestore.rules yorumu, mimari denetim
 // — altıncı tur). Doc ID karşılık gelen bildirim ile aynı olduğundan
 // doğrudan eşleştirilir. Sabit/immutable bir kayıt olduğundan canlı
 // dinlemeye gerek yok, tek seferlik okunur.
 Promise.all(
 data.map(async (b) => {
 try {
 const detaySnap = await getDoc(doc(db, 'mazeret_detaylari', b.id));
 return { id: b.id, retSebebi: detaySnap.exists() ? (detaySnap.data().retSebebi as string) : null };
 } catch {
 return { id: b.id, retSebebi: null };
 }
 })
 ).then((detaylar) => {
 setReddedilenler((prev) =>
 prev.map((b) => {
 const eslesen = detaylar.find((d) => d.id === b.id);
 return eslesen ? { ...b, retSebebi: eslesen.retSebebi } : b;
 })
 );
 });
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'bildirimler');
    setLoading(false);
  });

 return () => unsubscribe();
 }, []);

 return { gecmis: reddedilenler, loading };
}
