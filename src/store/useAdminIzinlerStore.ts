import { create } from 'zustand';
import { collection, query, onSnapshot, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Izin } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { telemetryService } from '../services/telemetryService';
import { haftalikPlanOlustur } from '../services/planServisi';
import { getHaftaIdFromDate } from '../lib/dateUtils';

/**
 * Bir iznin [baslangic, bitis] aralığını kapsayan tüm haftaId'leri (Pazartesi
 * başlangıçlı, 7 günlük adımlarla) hesaplar — izin onaylandığında/geri
 * alındığında bu haftaların HEPSİNİN yeniden planlanması gerekir (bkz. Y1).
 */
function izinAraligindakiHaftaIdleri(baslangic: string, bitis: string): string[] {
  const haftaIdSeti = new Set<string>();
  const [by, bm, bd] = baslangic.split('-').map(Number);
  const [ey, em, ed] = bitis.split('-').map(Number);
  const gun = new Date(by, bm - 1, bd);
  const sonGun = new Date(ey, em - 1, ed);

  // Sonsuz döngü koruması: geçersiz/ters bir aralık (bitis < baslangic) gelse
  // bile en fazla ~5 yıl (260 hafta) tarar, sonra durur.
  let guvenlikSayaci = 0;
  while (gun <= sonGun && guvenlikSayaci < 260) {
    const gunStr = `${gun.getFullYear()}-${String(gun.getMonth() + 1).padStart(2, '0')}-${String(gun.getDate()).padStart(2, '0')}`;
    haftaIdSeti.add(getHaftaIdFromDate(gunStr));
    gun.setDate(gun.getDate() + 7);
    guvenlikSayaci++;
  }
  return Array.from(haftaIdSeti);
}

/**
 * İzin kararı (onay/geri alma) sonrası, izin aralığını kapsayan haftaların
 * planını yeniden üretmeyi dener. Cron zaten mevcut bir plan belgesini asla
 * yeniden yazmadığından (bkz. scripts/haftalikPlanOlustur.ts), bir izin
 * onaylandığında bu tetiklenmezse kişi haftalarca izinliyken nöbete atanmış
 * kalabiliyordu (bkz. mimari denetim Y1). Hatalar yutulur — izin kararının
 * kendisini engellememeli.
 */
async function izinEtkilenenHaftalariYenile(izinId: string): Promise<void> {
  try {
    const izinSnap = await getDoc(doc(db, 'izinler', izinId));
    if (!izinSnap.exists()) return;
    const { baslangic, bitis } = izinSnap.data() as Izin;
    if (!baslangic || !bitis) return;

    const haftaIdler = izinAraligindakiHaftaIdleri(baslangic, bitis);
    for (const haftaId of haftaIdler) {
      try {
        await haftalikPlanOlustur(haftaId);
      } catch (err) {
        console.warn(`İzin kararı sonrası plan yenilenemedi (${haftaId}):`, err);
      }
    }
  } catch (err) {
    console.warn('İzin kararı sonrası etkilenen haftalar hesaplanamadı:', err);
  }
}

interface AdminIzinlerState {
  izinler: (Izin & { id: string })[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  init: () => () => void;
  izinGuncelle: (id: string, durum: 'onaylandi' | 'reddedildi') => Promise<void>;
  /** Yanlışlıkla verilmiş bir onay/red kararını geri alır, talebi tekrar bekleme durumuna döndürür. */
  izinGeriAl: (id: string) => Promise<void>;
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
      // Yalnızca onayda plan yenilemesi gerekir — reddedilen izin zaten
      // atamayı hiç etkilemiyordu (bkz. mimari denetim Y1).
      if (durum === 'onaylandi') {
        await izinEtkilenenHaftalariYenile(id);
      }
    } catch (err) {
      throw handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  izinGeriAl: async (id) => {
    const path = `izinler/${id}`;
    try {
      await updateDoc(doc(db, 'izinler', id), { durum: 'onay_bekliyor' });
      await telemetryService.logAudit('İzin Talebi Kararı Geri Alındı', id, 'Talep durumu tekrar \'ONAY BEKLİYOR\' olarak ayarlandı.');
      // Geri alınan bir onay da plan yenilemesi gerektirir — kişi artık
      // yeniden atanabilir olmalı (bkz. mimari denetim Y1).
      await izinEtkilenenHaftalariYenile(id);
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
