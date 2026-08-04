import { collection, query, where, getDocs, getDoc, doc, writeBatch, Timestamp, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Muezzin, Vakit, VakitAtama } from '../types';
import { haftalikPlanUret, OnayliIzin, VAKITLER } from '../lib/planlamaCekirdegi';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { telemetryService } from './telemetryService';

const KORUNAN_DURUMLAR = ['onaylandi', 'reddedildi'];

type BildirimDoc = QueryDocumentSnapshot<DocumentData>;
type GunPlanMap = Record<string, Record<Vakit, VakitAtama>>;

function haftaGunleri(haftaId: string) {
 const startStr = haftaId.substring(1);
 const [year, month, day] = startStr.split('-').map(Number);
 const pazartesi = new Date(year, month - 1, day);

 return Array.from({ length: 7 }, (_, index) => {
 const gun = new Date(pazartesi);
 gun.setDate(pazartesi.getDate() + index);
 const y = gun.getFullYear();
 const m = String(gun.getMonth() + 1).padStart(2, '0');
 const d = String(gun.getDate()).padStart(2, '0');
 return `${y}-${m}-${d}`;
 });
}

function bildirimleriSlotlaraAyir(docs: BildirimDoc[]) {
 return docs.reduce((acc, bildirimDoc) => {
 const data = bildirimDoc.data();
 const key = `${data.tarih}_${data.vakit}`;
 if (!acc[key]) acc[key] = [];
 acc[key].push(bildirimDoc);
 return acc;
 }, {} as Record<string, BildirimDoc[]>);
}

function korumaliSlotMu(slotBildirimleri: BildirimDoc[]) {
 return slotBildirimleri.some((bildirimDoc) => {
 const data = bildirimDoc.data();
 return KORUNAN_DURUMLAR.includes(data.durum) || data.tip === 'gorev_cagrisi';
 });
}

export interface VakitAtamasiGuncelleParams {
  haftaId: string;
  tarih: string;
  vakit: Vakit;
  asilUid: string;
  yedekUid: string;
  /** Yalnızca denetim izi mesajında gösterilir. */
  asilAdi: string;
  yedekAdi: string;
}

/**
 * Tek bir gün/vakit hücresi için elle (admin) atama günceller. Vaktin
 * onaylanmış/reddedilmiş veya görev-çağrılı bir geçmişi varsa güvenli
 * güncelleme reddedilir — bu durumda 'protected' döner, hiçbir yazım yapılmaz.
 */
export async function vakitAtamasiniGuncelle(params: VakitAtamasiGuncelleParams): Promise<'updated' | 'protected'> {
  const { haftaId, tarih, vakit, asilUid, yedekUid, asilAdi, yedekAdi } = params;
  const path = `haftaPlanlari/${haftaId}`;
  try {
    const gunBildirimleriSnap = await getDocs(query(
      collection(db, 'bildirimler'),
      where('haftaId', '==', haftaId),
      where('tarih', '==', tarih)
    ));

    const selectedVakitBildirimleri = gunBildirimleriSnap.docs.filter(d => d.data().vakit === vakit);
    if (korumaliSlotMu(selectedVakitBildirimleri)) {
      return 'protected';
    }

    const batch = writeBatch(db);

    selectedVakitBildirimleri.forEach((bildirimDoc) => {
      batch.delete(bildirimDoc.ref);
    });

    batch.update(doc(db, 'haftaPlanlari', haftaId), {
      [`gunler.${tarih}.${vakit}`]: { asil: asilUid, yedek: yedekUid }
    });

    // Bildirim ID'leri deterministiktir (haftaId_tarih_vakit_tip) — bkz.
    // firestore.rules `isBackupPromotionFromMazeret` ve scripts/haftalikPlanOlustur.ts.
    if (asilUid && asilUid !== 'Sistem') {
      batch.set(doc(db, 'bildirimler', `${haftaId}_${tarih}_${vakit}_asil`), {
        haftaId, tarih, vakit, uid: asilUid, tip: 'asil',
        durum: 'bekliyor', pendingAck: true, retSebebi: null, olusturmaTarihi: Timestamp.now(),
        sonGuncelleme: Timestamp.now()
      });
    }

    if (yedekUid && yedekUid !== 'Sistem') {
      batch.set(doc(db, 'bildirimler', `${haftaId}_${tarih}_${vakit}_yedek`), {
        haftaId, tarih, vakit, uid: yedekUid, tip: 'yedek',
        durum: 'bekliyor', pendingAck: true, retSebebi: null, olusturmaTarihi: Timestamp.now(),
        sonGuncelleme: Timestamp.now()
      });
    }

    await batch.commit();
    await telemetryService.logAudit('Manuel Görev Atama', tarih, `${vakit.toUpperCase()} vakti için asil: ${asilAdi}, yedek: ${yedekAdi} ataması yapıldı.`);
    return 'updated';
  } catch (err) {
    throw handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function haftalikPlanOlustur(haftaId: string): Promise<void> {
 const path = 'haftaPlanlari';
 try {
 const muezzinSnapshot = await getDocs(query(collection(db, 'muezzins'), where('aktif', '==', true)));
 const muezzinler = muezzinSnapshot.docs
 .map(doc => ({ id: doc.id, ...doc.data() } as Muezzin & { id: string }))
 .filter(m => m.role === 'muezzin');

 if (muezzinler.length < 1) {
 throw new Error('Planlama için en az 1 aktif müezzin gereklidir.');
 }

 const izinSnapshot = await getDocs(query(collection(db, 'izinler'), where('durum', '==', 'onaylandi')));
 const onayliIzinler = izinSnapshot.docs.map(doc => doc.data() as OnayliIzin);
 const gunler = haftaGunleri(haftaId);
 const haftaBitisStr = gunler[6];
 const startStr = haftaId.substring(1);

 const batch = writeBatch(db);
 const planRef = doc(db, 'haftaPlanlari', haftaId);
 const mevcutPlanSnap = await getDoc(planRef);
 const mevcutGunler = mevcutPlanSnap.exists()
 ? (mevcutPlanSnap.data().gunler || {}) as Partial<GunPlanMap>
 : {};

 const eskiBildirimler = await getDocs(query(collection(db, 'bildirimler'), where('haftaId', '==', haftaId)));
 const bildirimlerBySlot = bildirimleriSlotlaraAyir(eskiBildirimler.docs);

 // Korunan (zaten onaylanmış/reddedilmiş/görev-çağrılı) slotlar için taze
 // hesaplama atlanır — mevcut atama aynen korunur. Diğer tüm slotlar,
 // scripts/haftalikPlanOlustur.ts (gece cron'u) ile AYNI paylaşılan
 // çekirdekten (src/lib/planlamaCekirdegi.ts) taze hesaplanır.
 const gunPlan: GunPlanMap = haftalikPlanUret(gunler, muezzinler, onayliIzinler, (gun, vakit) => {
 const slotBildirimleri = bildirimlerBySlot[`${gun}_${vakit}`] || [];
 if (!korumaliSlotMu(slotBildirimleri)) return null;

 const mevcutAtama = mevcutGunler[gun]?.[vakit];
 const asilBildirim = slotBildirimleri.find((bildirimDoc) => bildirimDoc.data().tip === 'asil');
 const yedekBildirim = slotBildirimleri.find((bildirimDoc) => bildirimDoc.data().tip === 'yedek');
 return {
 asil: mevcutAtama?.asil || asilBildirim?.data().uid || 'Sistem',
 yedek: mevcutAtama?.yedek || yedekBildirim?.data().uid || 'Sistem'
 };
 });

 for (const gun of gunler) {
 for (const vakit of VAKITLER) {
 const slotKey = `${gun}_${vakit}`;
 const slotBildirimleri = bildirimlerBySlot[slotKey] || [];

 // Korunan slotlara dokunulmaz — atama zaten gunPlan'da korunmuş halde.
 if (korumaliSlotMu(slotBildirimleri)) continue;

 slotBildirimleri.forEach((bildirimDoc) => {
 batch.delete(bildirimDoc.ref);
 });

 const atama = gunPlan[gun][vakit];

 // Bildirim ID'leri deterministiktir (haftaId_tarih_vakit_tip) — bkz.
 // firestore.rules `isBackupPromotionFromMazeret` ve scripts/haftalikPlanOlustur.ts.
 if (atama.asil !== 'Sistem') {
 batch.set(doc(db, 'bildirimler', `${haftaId}_${gun}_${vakit}_asil`), {
 haftaId, tarih: gun, vakit, uid: atama.asil, tip: 'asil',
 durum: 'bekliyor', pendingAck: true, retSebebi: null, olusturmaTarihi: Timestamp.now(),
 sonGuncelleme: Timestamp.now()
 });
 }

 if (atama.yedek !== 'Sistem') {
 batch.set(doc(db, 'bildirimler', `${haftaId}_${gun}_${vakit}_yedek`), {
 haftaId, tarih: gun, vakit, uid: atama.yedek, tip: 'yedek',
 durum: 'bekliyor', pendingAck: true, retSebebi: null, olusturmaTarihi: Timestamp.now(),
 sonGuncelleme: Timestamp.now()
 });
 }
 }
 }

 batch.set(planRef, {
 haftaBaslangic: startStr,
 haftaBitis: haftaBitisStr,
 durum: 'yayinda',
 olusturmaTarihi: mevcutPlanSnap.exists() ? mevcutPlanSnap.data().olusturmaTarihi : Timestamp.now(),
 sonGuncelleme: Timestamp.now(),
 gunler: gunPlan
 }, { merge: true });

 await batch.commit();
 } catch (err) {
 throw handleFirestoreError(err, OperationType.WRITE, path);
 }
}
