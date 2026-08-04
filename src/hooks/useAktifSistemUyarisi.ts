import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AdminUyarisi } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

/** Oturum sahibine (herhangi bir müezzine), çözülmemiş en güncel sistem
 * uyarısını canlı dinler — saha tarafının admin müdahalesi gereken bir
 * arızadan (ör. zincir tükenmesi) tamamen habersiz kalmaması için
 * (bkz. tasarım denetimi). Firestore kuralı yalnızca cozuldu==false olan
 * belgeleri müezzinlere açar; admin'e özel çözüm notları sızmaz. */
export function useAktifSistemUyarisi(uid: string | undefined) {
  const [uyari, setUyari] = useState<(AdminUyarisi & { id: string }) | null>(null);

  const [lastUid, setLastUid] = useState(uid);
  if (uid !== lastUid) {
    setLastUid(uid);
    setUyari(null);
  }

  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, 'adminUyarilari'),
      where('cozuldu', '==', false),
      orderBy('olusturmaTarihi', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const doc = snapshot.docs[0];
      setUyari(doc ? ({ id: doc.id, ...doc.data() } as AdminUyarisi & { id: string }) : null);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'adminUyarilari');
    });

    return () => unsubscribe();
  }, [uid]);

  return uyari;
}
