import { create } from 'zustand';
import { collection, query, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Izin } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { telemetryService } from '../services/telemetryService';

interface AdminIzinlerState {
  izinler: (Izin & { id: string })[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  init: () => () => void;
  izinGuncelle: (id: string, durum: 'onaylandi' | 'reddedildi') => Promise<void>;
  izinSil: (id: string) => Promise<void>;
}

// Admin panelinde birden fazla bileşen (ExecutiveHeroScreen, IzinYonetimi,
// AdminPanel'in bekleyen-izin rozet sayacı) tüm `izinler` koleksiyonuna
// ihtiyaç duyar. Her biri kendi onSnapshot'ını açmak yerine tek paylaşılan
// abonelik burada tutulur; bekleyen sayısı da buradan türetilir.
export const useAdminIzinlerStore = create<AdminIzinlerState>((set, get) => ({
  izinler: [],
  loading: true,
  error: null,
  initialized: false,

  init: () => {
    if (get().initialized) return () => {};

    const path = 'izinler';
    const q = query(collection(db, path));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (Izin & { id: string })[];

      data.sort((a, b) => {
        const timeA = a.olusturmaTarihi?.toMillis() || 0;
        const timeB = b.olusturmaTarihi?.toMillis() || 0;
        return timeB - timeA;
      });

      set({ izinler: data, loading: false, initialized: true });
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
      set({ error: err instanceof Error ? err.message : String(err), loading: false, initialized: true });
    });

    return unsubscribe;
  },

  izinGuncelle: async (id, durum) => {
    const path = `izinler/${id}`;
    try {
      await updateDoc(doc(db, 'izinler', id), { durum });
      await telemetryService.logAudit('İzin Talebi Kararı', id, `Talep durumu '${durum.toUpperCase()}' olarak güncellendi.`);
    } catch (err) {
      throw handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  izinSil: async (id) => {
    const path = `izinler/${id}`;
    try {
      await deleteDoc(doc(db, 'izinler', id));
      await telemetryService.logAudit('İzin Talebi Silme', id, 'İzin kaydı sistemden kalıcı olarak silindi.');
    } catch (err) {
      throw handleFirestoreError(err, OperationType.DELETE, path);
    }
  },
}));
