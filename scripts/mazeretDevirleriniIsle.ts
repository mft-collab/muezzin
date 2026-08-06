import { db, Timestamp } from './lib/firebaseAdminInit.ts';

type BildirimData = {
  haftaId: string;
  tarih: string;
  vakit: string;
  uid: string;
  tip: 'asil' | 'yedek' | 'gorev_cagrisi';
  durum: string;
  devirSonucu?: 'yedek_atandi' | 'alarm_bekliyor' | 'alarm_uretildi';
  mazeretPlanSenkronEdildi?: boolean;
};

/**
 * Bu iş, src/services/mazeretServisi.ts'deki `mazeretBildir` istemci
 * transaction'ının GERÇEK ZAMANLI olarak yapamadığı (admin SDK gerektiren)
 * iki yan etkiyi uzlaştırır (reconcile eder):
 *
 *  - devirSonucu === 'yedek_atandi': istemci zaten yedeği 'asil' rolüne
 *    terfi ettirdi (bkz. firestore.rules `isBackupPromotionFromMazeret`).
 *    Bu iş yalnızca haftaPlanlari önbelleğini bu değişikliği yansıtacak
 *    şekilde günceller.
 *  - devirSonucu === 'alarm_bekliyor': istemci uygun bir yedek bulamadı.
 *    Bu iş admin'i uyaran bir adminUyarilari kaydı oluşturur.
 *
 * Her iki durumda da işlenen belge `mazeretPlanSenkronEdildi: true` ile
 * işaretlenir ki bu iş tekrar tekrar aynı kaydı işlemesin (idempotent).
 *
 * NOT: bu bayrak, `vekaletDevirleriniIsle.ts`'in kullandığı
 * `vekaletPlanSenkronEdildi`'den KASITLI OLARAK AYRI bir alandır — ikisi
 * eskiden tek bir paylaşılan `planSenkronEdildi` alanını kullanıyordu. Aynı
 * bildirim belgesi önce bir vekalet devriyle senkronlanıp sonra (yeni
 * sahibi tarafından) mazeretle reddedilirse, paylaşılan bayrak zaten
 * `true` olduğundan bu iş belgeyi "zaten işlenmiş" sanıp tamamen
 * atlıyordu — vakit görevlisiz kalıyor, hiçbir admin uyarısı üretilmiyordu
 * (bkz. mimari denetim Y2). Alanlar ayrıldığından beri her iş yalnızca
 * kendi yaşam döngüsü olayını takip ediyor.
 */

async function alarmVarMi(tarih: string, vakit: string): Promise<boolean> {
  const alarmSnap = await db.collection('adminUyarilari')
    .where('tarih', '==', tarih)
    .where('vakit', '==', vakit)
    .where('cozuldu', '==', false)
    .limit(1)
    .get();

  return !alarmSnap.empty;
}

export async function processMazeretDevirleri(dryRun = false) {
  console.log(`Mazeret devirleri uzlaştırılıyor${dryRun ? ' (dry-run)' : ''}...`);

  // NOT: tip filtresi kasıtlı olarak yalnızca 'asil' ile sınırlı değil — yedek
  // görevli de kendi mazeretini bildirebilir (bkz. src/services/mazeretServisi.ts),
  // bu durumda devirSonucu doğrudan 'alarm_bekliyor' olur ve aşağıdaki
  // yedek_atandi dalı hiç tetiklenmez (bir yedeğin yedeği olmadığından).
  const mazeretSnap = await db.collection('bildirimler')
    .where('durum', '==', 'reddedildi')
    .get();

  const islenecekler = mazeretSnap.docs.filter((docSnap) => {
    const data = docSnap.data() as BildirimData;
    return data.mazeretPlanSenkronEdildi !== true && !!data.devirSonucu;
  });

  let planSenkronlandi = 0;
  let alarmUretildi = 0;
  let atlandi = 0;

  for (const mazeretDoc of islenecekler) {
    const mazeret = mazeretDoc.data() as BildirimData;

    if (mazeret.devirSonucu === 'yedek_atandi') {
      const promotedRef = db.collection('bildirimler').doc(`${mazeret.haftaId}_${mazeret.tarih}_${mazeret.vakit}_yedek`);

      console.log(`${mazeret.tarih} ${mazeret.vakit}: haftaPlanlari senkronize ediliyor (${mazeret.uid} -> yedek terfisi).`);
      planSenkronlandi++;

      if (!dryRun) {
        await db.runTransaction(async (transaction) => {
          const freshMazeret = await transaction.get(mazeretDoc.ref);
          const freshPromoted = await transaction.get(promotedRef);
          if (!freshMazeret.exists || !freshPromoted.exists) return;

          const freshMazeretData = freshMazeret.data() as BildirimData;
          if (freshMazeretData.mazeretPlanSenkronEdildi === true) return;

          const promotedData = freshPromoted.data() as BildirimData;
          if (promotedData.tip !== 'asil') return; // istemci terfisi henüz/hiç gerçekleşmemiş

          transaction.update(db.collection('haftaPlanlari').doc(mazeret.haftaId), {
            [`gunler.${mazeret.tarih}.${mazeret.vakit}.asil`]: promotedData.uid,
            [`gunler.${mazeret.tarih}.${mazeret.vakit}.yedek`]: 'Sistem'
          });

          transaction.update(mazeretDoc.ref, {
            mazeretPlanSenkronEdildi: true,
            sonGuncelleme: Timestamp.now()
          });
        });
      }
      continue;
    }

    if (mazeret.devirSonucu === 'alarm_bekliyor') {
      const alarmZatenVar = await alarmVarMi(mazeret.tarih, mazeret.vakit);
      if (alarmZatenVar) {
        console.log(`${mazeret.tarih} ${mazeret.vakit}: aktif alarm zaten var, atlandi.`);
        atlandi++;
        if (!dryRun) {
          await mazeretDoc.ref.update({ mazeretPlanSenkronEdildi: true, sonGuncelleme: Timestamp.now() });
        }
        continue;
      }

      console.log(`${mazeret.tarih} ${mazeret.vakit}: uygun yedek yok, admin alarmi olusturuluyor.`);
      alarmUretildi++;

      if (!dryRun) {
        const batch = db.batch();
        batch.set(db.collection('adminUyarilari').doc(), {
          tip: 'zincirTukendi',
          mesaj: mazeret.tip === 'yedek'
            ? 'Yedek gorevli mazeret bildirdi; bu vakit icin artik yedek gorevli bulunmuyor. Admin mudahalesi gerekir.'
            : 'Mazeret sonrasi gorevi devralacak uygun yedek bulunamadi. Admin mudahalesi gerekir.',
          tarih: mazeret.tarih,
          vakit: mazeret.vakit,
          cozuldu: false,
          olusturmaTarihi: Timestamp.now()
        });
        batch.update(mazeretDoc.ref, {
          devirSonucu: 'alarm_uretildi',
          mazeretPlanSenkronEdildi: true,
          sonGuncelleme: Timestamp.now()
        });
        await batch.commit();
      }
      continue;
    }

    // devirSonucu === 'alarm_uretildi' (önceki bir çalıştırmada zaten işlenmiş): sadece işaretle.
    if (!dryRun) {
      await mazeretDoc.ref.update({ mazeretPlanSenkronEdildi: true, sonGuncelleme: Timestamp.now() });
    }
  }

  console.log(`Tamamlandi. planSenkronlandi=${planSenkronlandi}, alarmUretildi=${alarmUretildi}, atlandi=${atlandi}`);
}

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  const isDryRun = process.argv.includes('--dry-run');
  processMazeretDevirleri(isDryRun).catch((err) => {
    console.error('Mazeret devirleri islenemedi:', err);
    process.exit(1);
  });
}
