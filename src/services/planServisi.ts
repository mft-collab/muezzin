import { collection, query, where, getDocs, getDoc, doc, runTransaction, writeBatch, Timestamp, QueryDocumentSnapshot, DocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Muezzin, Vakit, VakitAtama } from '../types';
import { haftalikPlanUret, tekKisiliGunleriBul, kapsamsizGunleriBul, nobeteAtanabilirMi, OnayliIzin, VAKITLER } from '../lib/planlamaCekirdegi';
import { isFriday, getOncekiHafta } from '../lib/dateUtils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { telemetryService } from './telemetryService';

// 'okundu_varsayilan': yatsiSonuIslemleri.ts'in gün sonunda dokunulmamış
// bekleyen bildirimlere verdiği "tamamlandı" durumu — bu listede olmazsa
// tamamlanmış GEÇMİŞ günler bile bir sonraki plan yeniden üretiminde silinip
// farklı bir kişiye atanabiliyordu (bkz. mimari denetim K7).
const KORUNAN_DURUMLAR = ['onaylandi', 'reddedildi', 'okundu_varsayilan'];

// İyimser eşzamanlılık denetiminin (aşağıda) attığı çakışma hatasını genel
// Firestore hatalarından ayırt etmek için — böylece dışarıdaki tek seferlik
// otomatik tekrar deneme yalnızca gerçek bir çakışmada devreye girer, başka
// bir hatayı (izin, ağ vb.) yutmaz (bkz. algoritma denetimi).
class PlanEszamanlilikCakismasi extends Error {}

type BildirimQueryDoc = QueryDocumentSnapshot<DocumentData>;
type BildirimDoc = BildirimQueryDoc | DocumentSnapshot<DocumentData>;
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

// İyimser eşzamanlılık denetiminin (haftalikPlanOlusturTekSeferlik) tek
// başına haftaPlanlari.sonGuncelleme'yi karşılaştırması yeterli değildi —
// mazeretBildir/vekaletKabulEt kendi bildirimler yazımlarını YALNIZCA o
// belgede yapar, haftaPlanlari'na hiç dokunmaz (bunu yalnızca ayrı,
// asenkron bir uzlaştırma cron'u — mazeretDevirleriniIsle.ts/
// vekaletDevirleriniIsle.ts — daha sonra yapar). Bu yüzden eskiBildirimler
// okunduktan (T1) SONRA ama commit'ten (T2) ÖNCE bir müezzin mazeret
// bildirirse, haftaPlanlari.sonGuncelleme değişmediğinden freshness
// kontrolü çakışmayı hiç görmüyor, ve commit T1'deki BAYAT bildirim
// durumuna göre hesaplanmış bir plan yazıp mazeretin az önce güncellediği
// bildirim belgesini (delete+set ile) sessizce üzerine yazıyordu — mazeret
// reddi ve varsa yedek terfisi kayboluyordu (bkz. code-review, dördüncü
// denetim turu). Bu parmak izi haftaPlanlari.sonGuncelleme kontrolüne EK
// olarak bildirimler koleksiyonunun da T1-T2 arasında değişmediğini
// doğrular.
function bildirimlerParmakIzi(docs: BildirimQueryDoc[]): string {
  return docs
    .map((d) => `${d.id}:${(d.data().sonGuncelleme as Timestamp | undefined)?.toMillis() ?? 'null'}`)
    .sort()
    .join('|');
}

function bildirimleriSlotlaraAyir(docs: BildirimQueryDoc[]) {
 return docs.reduce((acc, bildirimDoc) => {
 const data = bildirimDoc.data();
 const key = `${data.tarih}_${data.vakit}`;
 if (!acc[key]) acc[key] = [];
 acc[key].push(bildirimDoc);
 return acc;
 }, {} as Record<string, BildirimQueryDoc[]>);
}

function korumaliSlotMu(slotBildirimleri: BildirimDoc[]) {
 return slotBildirimleri.some((bildirimDoc) => {
 const data = bildirimDoc.data();
 // vekaletDevredildi: true — vekaletServisi.ts'teki vekaletKabulEt bunu
 // yazar. Kabul edilen bir vekalet devri, bildirimin `durum`unu
 // DEĞİŞTİRMEZ (hâlâ 'bekliyor' kalabilir) — bu alan olmadan
 // korumaliSlotMu bu slotu korumasız sanıp plan yeniden üretiminde
 // sessizce eski sahibine geri döndürüyordu (bkz. mimari denetim K5).
 return !!data && (
 KORUNAN_DURUMLAR.includes(data.durum) ||
 data.tip === 'gorev_cagrisi' ||
 data.vekaletDevredildi === true
 );
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
    // Bildirim ID'leri deterministiktir (haftaId_tarih_vakit_tip) — bu sayede
    // slotu bulmak için bir sorgu yerine iki bilinen belge referansı okunabilir.
    // Bu da "koru mu?" kontrolünü ve yazımı TEK bir transaction'a almayı
    // mümkün kılar (bkz. algoritma denetimi — önceki sürüm oku-sonra-yaz
    // arasında bir yarış koşuluna açıktı: eş zamanlı bir mazeret/vekalet kabulü
    // bu okumadan sonra gerçekleşirse sessizce ezilebiliyordu).
    const asilRef = doc(db, 'bildirimler', `${haftaId}_${tarih}_${vakit}_asil`);
    const yedekRef = doc(db, 'bildirimler', `${haftaId}_${tarih}_${vakit}_yedek`);
    const planRef = doc(db, 'haftaPlanlari', haftaId);

    const [gY, gM, gD] = tarih.split('-').map(Number);
    const cumaMi = isFriday(new Date(gY, gM - 1, gD));

    const sonuc = await runTransaction(db, async (transaction) => {
      const asilSnap = await transaction.get(asilRef);
      const yedekSnap = await transaction.get(yedekRef);

      if (korumaliSlotMu([asilSnap, yedekSnap])) {
        return 'protected' as const;
      }

      if (asilSnap.exists()) transaction.delete(asilRef);
      if (yedekSnap.exists()) transaction.delete(yedekRef);

      transaction.update(planRef, {
        [`gunler.${tarih}.${vakit}`]: { asil: asilUid, yedek: yedekUid }
      });

      if (asilUid && asilUid !== 'Sistem') {
        transaction.set(asilRef, {
          haftaId, tarih, vakit, uid: asilUid, tip: 'asil',
          durum: 'bekliyor', pendingAck: true, retSebebi: null, cumaMi, olusturmaTarihi: Timestamp.now(),
          sonGuncelleme: Timestamp.now()
        });
      }

      if (yedekUid && yedekUid !== 'Sistem') {
        transaction.set(yedekRef, {
          haftaId, tarih, vakit, uid: yedekUid, tip: 'yedek',
          durum: 'bekliyor', pendingAck: true, retSebebi: null, cumaMi, olusturmaTarihi: Timestamp.now(),
          sonGuncelleme: Timestamp.now()
        });
      }

      return 'updated' as const;
    });

    if (sonuc === 'updated') {
      await telemetryService.logAudit('Manuel Görev Atama', tarih, `${vakit.toUpperCase()} vakti için asil: ${asilAdi}, yedek: ${yedekAdi} ataması yapıldı.`);
    }
    return sonuc;
  } catch (err) {
    throw handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function haftalikPlanOlustur(haftaId: string, denemeSayisi = 1): Promise<void> {
 try {
 await haftalikPlanOlusturTekSeferlik(haftaId);
 } catch (err) {
 if (err instanceof PlanEszamanlilikCakismasi) {
 if (denemeSayisi > 0) {
 return haftalikPlanOlustur(haftaId, denemeSayisi - 1);
 }
 // Tekrar denemeler tükendi — nadir ama kalıcı bir çakışma; telemetriye
 // düşür ki sık tekrarlarsa fark edilsin (bkz. algoritma denetimi).
 throw handleFirestoreError(err, OperationType.WRITE, 'haftaPlanlari');
 }
 throw err;
 }
}

async function haftalikPlanOlusturTekSeferlik(haftaId: string): Promise<void> {
 const path = 'haftaPlanlari';
 try {
 const muezzinSnapshot = await getDocs(query(collection(db, 'muezzins'), where('aktif', '==', true)));
 const muezzinler = muezzinSnapshot.docs
 .map(doc => ({ id: doc.id, ...doc.data() } as Muezzin & { id: string }))
 .filter(m => nobeteAtanabilirMi(m));

 if (muezzinler.length < 1) {
 throw new Error('Planlama için en az 1 aktif müezzin gereklidir.');
 }

 const izinSnapshot = await getDocs(query(collection(db, 'izinler'), where('durum', '==', 'onaylandi')));
 const onayliIzinler = izinSnapshot.docs.map(doc => doc.data() as OnayliIzin);
 const gunler = haftaGunleri(haftaId);
 const haftaBitisStr = gunler[6];
 const startStr = haftaId.substring(1);

 const planRef = doc(db, 'haftaPlanlari', haftaId);
 const mevcutPlanSnap = await getDoc(planRef);
 const mevcutGunler = mevcutPlanSnap.exists()
 ? (mevcutPlanSnap.data().gunler || {}) as Partial<GunPlanMap>
 : {};
 // İyimser eşzamanlılık denetimi (bkz. algoritma denetimi) — commit'ten hemen
 // önce plan belgesinin bu okumadan beri değişmediği doğrulanır.
 const okunanSonGuncelleme = mevcutPlanSnap.exists() ? mevcutPlanSnap.data().sonGuncelleme?.toMillis() ?? null : null;

 // Bir önceki haftanın son vaktinin (Pazar yatsı) ekibini oku — hafta
 // sınırında dinlenme kuralının (SOS) sıfırlanmasını önlemek için.
 const { haftaId: oncekiHaftaId, sonGun: oncekiSonGun } = getOncekiHafta(haftaId);
 const oncekiPlanSnap = await getDoc(doc(db, 'haftaPlanlari', oncekiHaftaId));
 const oncekiHaftaSonEkibi: string[] = [];
 if (oncekiPlanSnap.exists()) {
 const sonVakitAtama = (oncekiPlanSnap.data().gunler || {})[oncekiSonGun]?.yatsi;
 if (sonVakitAtama) {
 [sonVakitAtama.asil, sonVakitAtama.yedek].forEach((uid: string) => {
 if (uid && uid !== 'Sistem') oncekiHaftaSonEkibi.push(uid);
 });
 }
 }

 const eskiBildirimler = await getDocs(query(collection(db, 'bildirimler'), where('haftaId', '==', haftaId)));
 const bildirimlerBySlot = bildirimleriSlotlaraAyir(eskiBildirimler.docs);
 const okunanBildirimlerParmakIzi = bildirimlerParmakIzi(eskiBildirimler.docs);

 // Korunan (zaten onaylanmış/reddedilmiş/görev-çağrılı) slotlar için taze
 // hesaplama atlanır — mevcut atama aynen korunur. Diğer tüm slotlar,
 // scripts/haftalikPlanOlustur.ts (gece cron'u) ile AYNI paylaşılan
 // çekirdekten (src/lib/planlamaCekirdegi.ts) taze hesaplanır.
 const gunPlan: GunPlanMap = haftalikPlanUret(gunler, muezzinler, onayliIzinler, (gun, vakit) => {
 const slotBildirimleri = bildirimlerBySlot[`${gun}_${vakit}`] || [];
 if (!korumaliSlotMu(slotBildirimleri)) return null;

 const mevcutAtama = mevcutGunler[gun]?.[vakit];
 const asilBildirim = slotBildirimleri.find((bildirimDoc) => bildirimDoc.data()?.tip === 'asil');
 const yedekBildirim = slotBildirimleri.find((bildirimDoc) => bildirimDoc.data()?.tip === 'yedek');
 // Öncelik `bildirimler`'de (canlı gerçek) — `mevcutAtama` bu fonksiyon
 // başında okunan `haftaPlanlari` ÖNBELLEĞİnden gelir ve bir vekalet/mazeret
 // devri sonrası uzlaştırma cron'u çalışana kadar bayat kalabilir. Önceki
 // sıralama (önbellek > bildirim) bayat değeri tercih edip devredilen bir
 // slotu sessizce eski sahibine geri döndürebiliyordu (bkz. mimari denetim
 // O8). `mevcutAtama` yalnızca hiçbir bildirim belgesi yoksa devreye girer.
 return {
 asil: asilBildirim?.data()?.uid || mevcutAtama?.asil || 'Sistem',
 yedek: yedekBildirim?.data()?.uid || mevcutAtama?.yedek || 'Sistem'
 };
 }, oncekiHaftaSonEkibi);

 // Tek kişinin (yedeksiz) kaldığı günler için admin'e görünürlük bırak.
 const tekKisiliGunler = tekKisiliGunleriBul(gunPlan);
 // Hiç kimsenin müsait olmadığı (tamamen kapsamsız) günler — sistemdeki en
 // ağır durum, önceden hiçbir uyarı üretmiyordu (bkz. mimari denetim O3).
 const kapsamsizGunler = kapsamsizGunleriBul(gunPlan);

 // Commit'ten hemen önce eşzamanlılık kontrolü yapılıp SONRA batch kurulur —
 // aradaki pencere olabildiğince küçük tutulur. haftaPlanlari VE
 // bildirimler'in ikisi de yeniden kontrol edilir (bkz. bildirimlerParmakIzi
 // yorumu — yalnızca haftaPlanlari yeterli değildi).
 const tazeKontrolSnap = await getDoc(planRef);
 const tazeSonGuncelleme = tazeKontrolSnap.exists() ? tazeKontrolSnap.data().sonGuncelleme?.toMillis() ?? null : null;
 if (tazeSonGuncelleme !== okunanSonGuncelleme) {
 throw new PlanEszamanlilikCakismasi('Plan bu sırada başka bir işlem tarafından değiştirildi. Lütfen tekrar deneyin.');
 }
 const tazeBildirimlerSnap = await getDocs(query(collection(db, 'bildirimler'), where('haftaId', '==', haftaId)));
 if (bildirimlerParmakIzi(tazeBildirimlerSnap.docs) !== okunanBildirimlerParmakIzi) {
 throw new PlanEszamanlilikCakismasi('Bu hafta için bildirimler bu sırada başka bir işlem tarafından değiştirildi. Lütfen tekrar deneyin.');
 }

 const batch = writeBatch(db);

 for (const gun of gunler) {
 const [gY, gM, gD] = gun.split('-').map(Number);
 const cumaMi = isFriday(new Date(gY, gM - 1, gD));

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
 durum: 'bekliyor', pendingAck: true, retSebebi: null, cumaMi, olusturmaTarihi: Timestamp.now(),
 sonGuncelleme: Timestamp.now()
 });
 }

 if (atama.yedek !== 'Sistem') {
 batch.set(doc(db, 'bildirimler', `${haftaId}_${gun}_${vakit}_yedek`), {
 haftaId, tarih: gun, vakit, uid: atama.yedek, tip: 'yedek',
 durum: 'bekliyor', pendingAck: true, retSebebi: null, cumaMi, olusturmaTarihi: Timestamp.now(),
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

 if (kapsamsizGunler.length > 0) {
 batch.set(doc(collection(db, 'adminUyarilari')), {
 tip: 'planOlusturulamadi',
 mesaj: `${haftaId} haftasında şu günler için HİÇ KİMSE müsait değil (herkes izinli/haftalık izin gününde): ${kapsamsizGunler.join(', ')}. Acilen kadro/izin durumunu kontrol edin.`,
 tarih: kapsamsizGunler[0],
 cozuldu: false,
 olusturmaTarihi: Timestamp.now()
 });
 }
 if (tekKisiliGunler.length > 0) {
 batch.set(doc(collection(db, 'adminUyarilari')), {
 tip: 'zincirTukendi',
 mesaj: `${haftaId} haftasında şu günler yalnızca tek kişiyle (yedeksiz) planlandı: ${tekKisiliGunler.join(', ')}. Kadro müsaitliğini kontrol edin.`,
 tarih: tekKisiliGunler[0],
 cozuldu: false,
 olusturmaTarihi: Timestamp.now()
 });
 }

 await batch.commit();
 } catch (err) {
 if (err instanceof PlanEszamanlilikCakismasi) throw err;
 throw handleFirestoreError(err, OperationType.WRITE, path);
 }
}
