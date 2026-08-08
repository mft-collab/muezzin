import { db, Timestamp } from './lib/firebaseAdminInit.ts';
import { isFriday } from '../src/lib/dateUtils.ts';

type Role = 'muezzin' | 'admin' | 'gozlemci' | string;
type MuezzinDoc = { displayName?: string; role?: Role; aktif?: boolean };
type VakitAtama = { asil?: string; yedek?: string };

const VAKITLER = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'] as const;

function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pickMostFrequent(values: string[], excluded = new Set<string>()): string | null {
  const freq = new Map<string, number>();
  for (const v of values) {
    if (!v || excluded.has(v)) continue;
    freq.set(v, (freq.get(v) || 0) + 1);
  }
  let best: string | null = null;
  let max = -1;
  for (const [uid, count] of freq.entries()) {
    if (count > max) {
      best = uid;
      max = count;
    }
  }
  return best;
}

async function main() {
  const today = getTodayStr();
  console.log(`Tarama başlıyor. Referans tarih (TR): ${today}`);

  const muezzinSnap = await db.collection('muezzins').get();
  const userMap = new Map<string, MuezzinDoc>();
  const aktifMuezzinler: string[] = [];

  muezzinSnap.docs.forEach((d) => {
    const data = d.data() as MuezzinDoc;
    userMap.set(d.id, data);
    if (data.aktif === true && data.role === 'muezzin') aktifMuezzinler.push(d.id);
  });

  if (aktifMuezzinler.length < 2) {
    throw new Error('Düzeltme için en az 2 aktif müezzin gerekli.');
  }

  const plansSnap = await db.collection('haftaPlanlari').get();
  let scannedSlots = 0;
  let invalidSlots = 0;
  let fixedDays = 0;
  let pastInvalidDays = 0;

  for (const planDoc of plansSnap.docs) {
    const plan = planDoc.data() as { gunler?: Record<string, Record<string, VakitAtama>> };
    const gunler = plan.gunler || {};
    const planRef = db.collection('haftaPlanlari').doc(planDoc.id);
    const batch = db.batch();
    let hasPlanUpdate = false;
    let hasBatchWork = false;

    for (const tarih of Object.keys(gunler)) {
      const day = gunler[tarih] || {};

      const asilVals: string[] = [];
      const yedekVals: string[] = [];
      let dayHasInvalid = false;

      for (const vakit of VAKITLER) {
        const atama = day[vakit] || {};
        const asil = atama.asil || '';
        const yedek = atama.yedek || '';
        if (asil) asilVals.push(asil);
        if (yedek) yedekVals.push(yedek);

        const asilRole = asil ? userMap.get(asil)?.role : undefined;
        const yedekRole = yedek ? userMap.get(yedek)?.role : undefined;
        const asilValid = !asil || asil === 'Sistem' || (userMap.get(asil)?.aktif === true && asilRole === 'muezzin');
        const yedekValid = !yedek || yedek === 'Sistem' || (userMap.get(yedek)?.aktif === true && yedekRole === 'muezzin');
        if (!asilValid || !yedekValid) {
          dayHasInvalid = true;
          invalidSlots++;
        }
        scannedSlots++;
      }

      if (!dayHasInvalid) continue;
      if (tarih < today) {
        pastInvalidDays++;
        continue;
      }

      const validAsilCandidates = asilVals.filter((uid) => userMap.get(uid)?.aktif === true && userMap.get(uid)?.role === 'muezzin');
      const validYedekCandidates = yedekVals.filter((uid) => userMap.get(uid)?.aktif === true && userMap.get(uid)?.role === 'muezzin');

      const asil = pickMostFrequent(validAsilCandidates) || aktifMuezzinler[0];
      let yedek = pickMostFrequent(validYedekCandidates, new Set([asil])) || aktifMuezzinler.find((uid) => uid !== asil) || aktifMuezzinler[1];
      if (yedek === asil) {
        const fallback = aktifMuezzinler.find((uid) => uid !== asil);
        if (!fallback) throw new Error(`Yedek seçiminde farklı müezzin bulunamadı: ${tarih}`);
        yedek = fallback;
      }

      for (const vakit of VAKITLER) {
        const current = day[vakit] || {};
        if (current.asil !== asil || current.yedek !== yedek) {
          batch.update(planRef, {
            [`gunler.${tarih}.${vakit}.asil`]: asil,
            [`gunler.${tarih}.${vakit}.yedek`]: yedek,
          });
          hasPlanUpdate = true;
          hasBatchWork = true;
        }
      }

      // Bildirimleri senkronize et (bugün ve sonrası): sadece asil/yedek kalacak.
      const bildirimSnap = await db.collection('bildirimler')
        .where('haftaId', '==', planDoc.id)
        .where('tarih', '==', tarih)
        .get();

      bildirimSnap.docs.forEach((d) => {
        const tip = d.data().tip as string | undefined;
        if (tip === 'asil' || tip === 'yedek' || tip === 'gorev_cagrisi') {
          batch.delete(d.ref);
          hasBatchWork = true;
        }
      });

      // scripts/haftalikPlanOlustur.ts ve src/services/planServisi.ts'in
      // her bildirim oluşturma yolu cumaMi'yi hesaplayıp yazıyor —
      // burada eksikti. firestore.rules'taki cumaMiIsaretli() eksik alanda
      // "Cuma değil" sayarak fail-open olduğundan, bu onarım scripti bir
      // Cuma gününün bildirimlerini dokunursa (ör. arşivlenmiş bir
      // müezzinin bayat atamasını düzeltmek için) o Cuma'nın sunucu
      // tarafı mazeret/vekalet kısıtlaması sessizce devre dışı kalıyordu
      // (bkz. code-review, dördüncü denetim turu).
      const [cY, cM, cD] = tarih.split('-').map(Number);
      const cumaMi = isFriday(new Date(cY, cM - 1, cD));

      for (const vakit of VAKITLER) {
        const base = {
          haftaId: planDoc.id,
          tarih,
          vakit,
          durum: 'bekliyor',
          pendingAck: true,
          retSebebi: null,
          cumaMi,
          olusturmaTarihi: Timestamp.now(),
          sonGuncelleme: Timestamp.now(),
        };
        batch.set(db.collection('bildirimler').doc(`${planDoc.id}_${tarih}_${vakit}_asil`), { ...base, uid: asil, tip: 'asil' });
        batch.set(db.collection('bildirimler').doc(`${planDoc.id}_${tarih}_${vakit}_yedek`), { ...base, uid: yedek, tip: 'yedek' });
        hasBatchWork = true;
      }

      fixedDays++;
    }

    if (hasBatchWork) {
      await batch.commit();
    }
  }

  console.log('--- Özet ---');
  console.log(`Toplam taranan slot: ${scannedSlots}`);
  console.log(`Tespit edilen kural dışı slot: ${invalidSlots}`);
  console.log(`Bugün/gelecek için düzeltilen gün: ${fixedDays}`);
  console.log(`Geçmişte (dokunulmadı) kural dışı gün: ${pastInvalidDays}`);
}

main().catch((err) => {
  console.error('Düzeltme hatası:', err);
  process.exit(1);
});
