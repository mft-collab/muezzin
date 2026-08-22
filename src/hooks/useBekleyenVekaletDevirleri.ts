import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { VekaletTalebi } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useChangeKey } from './useChangeKey';

/**
 * Oturum sahibinin kabul ettiği ama scripts/vekaletDevirleriniIsle.ts
 * tarafından henüz UYGULANMAMIŞ vekalet devirlerini canlı dinler ("1000
 * ifade tavanı" kök neden çözümü — transfer artık anlık değil, script'in
 * bir sonraki çalışmasına kadar ~10-15 dk gecikmeli, bkz. src/services/
 * vekaletServisi.ts yorumu). `bildirimUygulandi` filtresi istemci
 * tarafında uygulanır (Firestore'da `!=` + başka `where` kombinasyonu ek
 * composite index gerektirir; talep sayısı kullanıcı başına çok küçük
 * olduğundan bu maliyetsiz).
 */
export function useBekleyenVekaletDevirleri(uid: string | undefined) {
  const [bekleyenDevirler, setBekleyenDevirler] = useState<(VekaletTalebi & { id: string })[]>([]);

  if (useChangeKey(uid)) {
    setBekleyenDevirler([]);
  }

  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, 'vekalet_talepleri'),
      where('aliciUid', '==', uid),
      where('durum', '==', 'kabul_edildi')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tumu = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as VekaletTalebi) }));
      setBekleyenDevirler(tumu.filter(talep => talep.bildirimUygulandi !== true));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'vekalet_talepleri');
    });

    return () => unsubscribe();
  }, [uid]);

  return bekleyenDevirler;
}
