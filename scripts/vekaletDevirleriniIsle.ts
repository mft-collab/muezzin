import { db, Timestamp } from './lib/firebaseAdminInit.ts';

type BildirimData = {
  haftaId: string;
  tarih: string;
  vakit: string;
  uid: string;
  tip: 'asil' | 'yedek' | 'gorev_cagrisi';
  durum: string;
  vekaletDevredildi?: boolean;
  vekaletPlanSenkronEdildi?: boolean;
};

/**
 * `src/services/vekaletServisi.ts`'teki `vekaletKabulEt` istemci
 * transaction'ının GERÇEK ZAMANLI olarak yapamadığı (admin SDK gerektiren,
 * Spark planında istemciden `haftaPlanlari` yazma yetkisi olmadığı için)
 * yan etkiyi uzlaştırır: kabul edilen bir vekalet devri yalnızca
 * `bildirimler` belgesini günceller (`uid` + `vekaletDevredildi: true`),
 * `haftaPlanlari` önbelleği eski uid'i göstermeye devam eder.
 *
 * Bu, `mazeretDevirleriniIsle.ts` ile aynı mimari boşluğun vekalet
 * karşılığıdır (bkz. mimari denetim O8): `haftaPlanlari` senkronize
 * kalmazsa hem haftalık çizelge görünümü eski ismi gösterir hem de
 * `oncekiHaftaSonEkibi` (SOS/dinlenme kuralının hafta sınırını taşıyan
 * girdisi) yanlış kişiye uygulanabilir.
 *
 * İşlenen belge `vekaletPlanSenkronEdildi: true` ile işaretlenir ki bu iş
 * tekrar tekrar aynı kaydı işlemesin (idempotent).
 *
 * NOT: bu bayrak, `mazeretDevirleriniIsle.ts`'in kullandığı
 * `mazeretPlanSenkronEdildi`'den KASITLI OLARAK AYRI bir alandır — bkz. o
 * dosyadaki NOT ve mimari denetim Y2.
 */
export async function processVekaletDevirleri(dryRun = false) {
  console.log(`Vekalet devirleri uzlaştırılıyor${dryRun ? ' (dry-run)' : ''}...`);

  const devirSnap = await db.collection('bildirimler')
    .where('vekaletDevredildi', '==', true)
    .get();

  const islenecekler = devirSnap.docs.filter((docSnap) => {
    const data = docSnap.data() as BildirimData;
    return data.vekaletPlanSenkronEdildi !== true;
  });

  let planSenkronlandi = 0;

  for (const devirDoc of islenecekler) {
    const devir = devirDoc.data() as BildirimData;

    console.log(`${devir.tarih} ${devir.vakit} (${devir.tip}): haftaPlanlari senkronize ediliyor (-> ${devir.uid}).`);
    planSenkronlandi++;

    if (dryRun) continue;

    await db.runTransaction(async (transaction) => {
      const freshDevir = await transaction.get(devirDoc.ref);
      if (!freshDevir.exists) return;
      const freshDevirData = freshDevir.data() as BildirimData;
      if (freshDevirData.vekaletPlanSenkronEdildi === true) return;

      const planRef = db.collection('haftaPlanlari').doc(devir.haftaId);
      const planSnap = await transaction.get(planRef);
      if (!planSnap.exists) {
        // Plan belgesi (henüz) yoksa senkronize edilecek bir şey yok — yine
        // de işaretle ki bu iş sonsuza kadar aynı belgeyi denemesin.
        transaction.update(devirDoc.ref, { vekaletPlanSenkronEdildi: true, sonGuncelleme: Timestamp.now() });
        return;
      }

      transaction.update(planRef, {
        [`gunler.${devir.tarih}.${devir.vakit}.${devir.tip}`]: freshDevirData.uid
      });
      transaction.update(devirDoc.ref, {
        vekaletPlanSenkronEdildi: true,
        sonGuncelleme: Timestamp.now()
      });
    });
  }

  console.log(`Tamamlandi. planSenkronlandi=${planSenkronlandi}`);
}

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  const isDryRun = process.argv.includes('--dry-run');
  processVekaletDevirleri(isDryRun).catch((err) => {
    console.error('Vekalet devirleri islenemedi:', err);
    process.exit(1);
  });
}
