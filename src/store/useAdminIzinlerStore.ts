import { create } from 'zustand';
import { collection, query, onSnapshot, updateDoc, doc, deleteDoc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Izin } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { telemetryService } from '../services/telemetryService';
import { haftalikPlanOlustur } from '../services/planServisi';
import { getHaftaIdFromDate, izinGunSayisi } from '../lib/dateUtils';

/** Yıllık izin kotası (takvim yılı başına gün) — bkz. firestore.rules
 *  isValidMuezzin (yillikIzinKullanilanGun <= 30), aynı sabit orada da
 *  ayrıca tanımlıdır (Firestore Rules TS sabitlerini import edemez). Bu
 *  sabiti değiştirirsen firestore.rules'taki karşılığını da güncelle. */
const YILLIK_IZIN_KOTASI = 30;

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
      const izinSnap = await getDoc(doc(db, 'izinler', id));
      if (!izinSnap.exists()) throw new Error('İzin talebi bulunamadı.');
      const izinData = izinSnap.data() as Izin;

      // Yıllık izin onayı, 30 gün/yıl kotasını muezzins.yillikIzinKullanilanGun
      // kalıcı sayacına ATOMİK olarak işlemek zorunda — aksi halde iki ayrı
      // yazım arasında kota kontrolsüz kalırdı. firestore.rules (isValidMuezzin)
      // bu sayacın 30'u AŞACAK şekilde yazılmasını tamamen reddeder; kota
      // aşan bir onay burada transaction'ın kendisinde başarısız olur, izin
      // durumu da değişmeden 'onay_bekliyor' kalır (bkz. kullanıcı kararı:
      // sert engel, admin override'ı yok).
      if (durum === 'onaylandi' && izinData.tip === 'yillik') {
        const gunSayisi = izinGunSayisi(izinData.baslangic, izinData.bitis);
        await runTransaction(db, async (transaction) => {
          const izinRef = doc(db, 'izinler', id);
          const muezzinRef = doc(db, 'muezzins', izinData.uid);
          const [tazeIzinSnap, muezzinSnap] = await Promise.all([
            transaction.get(izinRef),
            transaction.get(muezzinRef),
          ]);
          if (!tazeIzinSnap.exists()) throw new Error('İzin talebi bulunamadı.');
          if (tazeIzinSnap.data().durum !== 'onay_bekliyor') throw new Error('Bu talep zaten sonuçlandırılmış.');
          if (!muezzinSnap.exists()) throw new Error('Personel kaydı bulunamadı.');

          const mevcutKullanilan = muezzinSnap.data().yillikIzinKullanilanGun || 0;
          const yeniKullanilan = mevcutKullanilan + gunSayisi;
          if (yeniKullanilan > YILLIK_IZIN_KOTASI) {
            throw new Error(
              `Bu onay yıllık izin kotasını aşıyor: talep ${gunSayisi} gün, kullanılan ${mevcutKullanilan}/${YILLIK_IZIN_KOTASI} gün. Kalan kota: ${Math.max(0, YILLIK_IZIN_KOTASI - mevcutKullanilan)} gün.`
            );
          }

          transaction.update(izinRef, { durum });
          transaction.update(muezzinRef, { yillikIzinKullanilanGun: yeniKullanilan });
        });
      } else {
        await updateDoc(doc(db, 'izinler', id), { durum });
      }

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
      const izinSnap = await getDoc(doc(db, 'izinler', id));
      if (!izinSnap.exists()) throw new Error('İzin talebi bulunamadı.');
      const izinData = izinSnap.data() as Izin;

      // Onaylanmış bir yıllık izin geri alınırsa, daha önce sayaca eklenen
      // gün sayısı da aynı transaction içinde geri düşülmeli — aksi halde
      // sayaç yapay olarak şişik kalır ve kişinin kalan kotasını haksız
      // yere azaltmaya devam eder.
      if (izinData.tip === 'yillik') {
        const gunSayisi = izinGunSayisi(izinData.baslangic, izinData.bitis);
        await runTransaction(db, async (transaction) => {
          const izinRef = doc(db, 'izinler', id);
          const muezzinRef = doc(db, 'muezzins', izinData.uid);
          const [tazeIzinSnap, muezzinSnap] = await Promise.all([
            transaction.get(izinRef),
            transaction.get(muezzinRef),
          ]);
          if (!tazeIzinSnap.exists()) throw new Error('İzin talebi bulunamadı.');

          transaction.update(izinRef, { durum: 'onay_bekliyor' });
          if (muezzinSnap.exists()) {
            const mevcutKullanilan = muezzinSnap.data().yillikIzinKullanilanGun || 0;
            transaction.update(muezzinRef, { yillikIzinKullanilanGun: Math.max(0, mevcutKullanilan - gunSayisi) });
          }
        });
      } else {
        await updateDoc(doc(db, 'izinler', id), { durum: 'onay_bekliyor' });
      }

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
