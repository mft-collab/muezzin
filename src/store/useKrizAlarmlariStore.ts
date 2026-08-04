import { create } from 'zustand';
import { collection, doc, onSnapshot, query, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AdminUyarisi } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { telemetryService } from '../services/telemetryService';

interface KrizAlarmlariState {
  alarmlar: (AdminUyarisi & { id: string })[];
  cozulmamisSayisi: number;
  loading: boolean;
  initialized: boolean;
  init: () => () => void;
  /** Bir nöbet uyarısını çözüldü olarak işaretler ve denetim izine kaydeder. */
  alarmCoz: (id: string, auditBaslik: string, auditDetay: string) => Promise<void>;
}

// Admin paneli içinde birden fazla bileşen (AdminPanel rozet sayacı,
// ExecutiveHeroScreen dashboard'u, KrizAlarmlari drawer'ı) aynı anda monte
// olabiliyor. Her biri kendi onSnapshot'ını açan bir hook yerine, tek bir
// paylaşılan abonelik burada tutulur.
export const useKrizAlarmlariStore = create<KrizAlarmlariState>((set, get) => ({
  alarmlar: [],
  cozulmamisSayisi: 0,
  loading: true,
  initialized: false,

  init: () => {
    if (get().initialized) return () => {};

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

      set({ alarmlar: data, cozulmamisSayisi: activeCount, loading: false, initialized: true });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'adminUyarilari');
      set({ loading: false, initialized: true });
    });

    return unsubscribe;
  },

  alarmCoz: async (id, auditBaslik, auditDetay) => {
    const path = `adminUyarilari/${id}`;
    try {
      await updateDoc(doc(db, 'adminUyarilari', id), { cozuldu: true, cozulmeTarihi: new Date() });
      await telemetryService.logAudit(auditBaslik, id, auditDetay);
    } catch (err) {
      throw handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },
}));
