import { db, Timestamp } from './lib/firebaseAdminInit.ts';

type BildirimData = {
  haftaId: string;
  tarih: string;
  vakit: string;
  uid: string;
  tip: 'asil' | 'yedek' | 'gorev_cagrisi';
  durum: string;
  pendingAck?: boolean;
  devirIslendi?: boolean;
};

// const dryRun = process.argv.includes('--dry-run');

async function alarmVarMi(tarih: string, vakit: string): Promise<boolean> {
  const alarmSnap = await db.collection('adminUyarilari')
    .where('tarih', '==', tarih)
    .where('vakit', '==', vakit)
    .where('cozuldu', '==', false)
    .limit(1)
    .get();

  return !alarmSnap.empty;
}

async function yedekAktifMuezzinMi(uid: string): Promise<boolean> {
  const personelDoc = await db.collection('muezzins').doc(uid).get();
  const personel = personelDoc.data();
  return personelDoc.exists && personel?.aktif === true && personel?.role === 'muezzin';
}

export async function processMazeretDevirleri(dryRun = false) {
  console.log(`Mazeret devirleri isleniyor${dryRun ? ' (dry-run)' : ''}...`);

  const mazeretSnap = await db.collection('bildirimler')
    .where('tip', '==', 'asil')
    .where('durum', '==', 'reddedildi')
    .get();

  const bekleyenMazeretler = mazeretSnap.docs.filter((docSnap) => {
    const data = docSnap.data() as BildirimData;
    return data.devirIslendi !== true;
  });

  let yedekAtandi = 0;
  let alarmUretildi = 0;
  let atlandi = 0;

  for (const mazeretDoc of bekleyenMazeretler) {
    const mazeret = mazeretDoc.data() as BildirimData;

    const yedekSnap = await db.collection('bildirimler')
      .where('haftaId', '==', mazeret.haftaId)
      .where('tarih', '==', mazeret.tarih)
      .where('vakit', '==', mazeret.vakit)
      .where('tip', '==', 'yedek')
      .limit(1)
      .get();

    const yedekDoc = yedekSnap.docs[0];
    const yedek = yedekDoc?.data() as BildirimData | undefined;
    const yedekUygun =
      !!yedekDoc &&
      !!yedek &&
      yedek.durum !== 'reddedildi' &&
      yedek.uid !== mazeret.uid &&
      await yedekAktifMuezzinMi(yedek.uid);

    if (yedekUygun) {
      console.log(`${mazeret.tarih} ${mazeret.vakit}: ${mazeret.uid} -> ${yedek.uid}`);
      yedekAtandi++;

      if (!dryRun) {
        await db.runTransaction(async (transaction) => {
          const freshMazeret = await transaction.get(mazeretDoc.ref);
          const freshYedek = await transaction.get(yedekDoc.ref);
          if (!freshMazeret.exists || !freshYedek.exists) return;

          const freshMazeretData = freshMazeret.data() as BildirimData;
          const freshYedekData = freshYedek.data() as BildirimData;
          if (freshMazeretData.devirIslendi === true) return;
          if (freshYedekData.durum === 'reddedildi') return;

          transaction.update(yedekDoc.ref, {
            tip: 'asil',
            durum: 'bekliyor',
            pendingAck: true,
            sonGuncelleme: Timestamp.now(),
            devirKaynakBildirimId: mazeretDoc.id
          });

          transaction.update(db.collection('haftaPlanlari').doc(mazeret.haftaId), {
            [`gunler.${mazeret.tarih}.${mazeret.vakit}.asil`]: yedek.uid,
            [`gunler.${mazeret.tarih}.${mazeret.vakit}.yedek`]: 'Sistem'
          });

          transaction.update(mazeretDoc.ref, {
            devirIslendi: true,
            devirSonucu: 'yedek_atandi',
            sonGuncelleme: Timestamp.now()
          });
        });
      }

      continue;
    }

    const alarmZatenVar = await alarmVarMi(mazeret.tarih, mazeret.vakit);
    if (alarmZatenVar) {
      console.log(`${mazeret.tarih} ${mazeret.vakit}: aktif alarm zaten var, atlandi.`);
      atlandi++;
      continue;
    }

    console.log(`${mazeret.tarih} ${mazeret.vakit}: uygun yedek yok, admin alarmi olusturulacak.`);
    alarmUretildi++;

    if (!dryRun) {
      const batch = db.batch();
      batch.set(db.collection('adminUyarilari').doc(), {
        tip: 'zincirTukendi',
        mesaj: 'Mazeret sonrasi gorevi devralacak uygun yedek bulunamadi. Admin mudahalesi gerekir.',
        tarih: mazeret.tarih,
        vakit: mazeret.vakit,
        cozuldu: false,
        olusturmaTarihi: Timestamp.now()
      });
      batch.update(mazeretDoc.ref, {
        devirIslendi: true,
        devirSonucu: 'alarm_uretildi',
        sonGuncelleme: Timestamp.now()
      });
      await batch.commit();
    }
  }

  console.log(`Tamamlandi. yedekAtandi=${yedekAtandi}, alarmUretildi=${alarmUretildi}, atlandi=${atlandi}`);
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
