process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
import assert from 'node:assert/strict';
import { db } from '../../scripts/lib/firebaseAdminInit.ts';
import { processVekaletDevirleri } from '../../scripts/vekaletDevirleriniIsle.ts';

type TestCase = {
  name: string;
  run: () => Promise<void>;
};

async function clearCollections() {
  const collections = ['muezzins', 'bildirimler', 'haftaPlanlari', 'adminUyarilari'];
  for (const collection of collections) {
    const snapshot = await db.collection(collection).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
}

const tests: TestCase[] = [
  {
    name: 'Kabul edilen vekalet devri haftaPlanlari onbellegini senkronize eder',
    run: async () => {
      await clearCollections();

      await db.collection('haftaPlanlari').doc('W2026-05-18').set({
        gunler: {
          '2026-05-22': {
            ogle: { asil: 'muezzin1', yedek: 'Sistem' }
          }
        }
      });

      // vekaletKabulEt (istemci) zaten bildirim.uid'yi degistirip
      // vekaletDevredildi:true yazmis olarak kabul edilir — bu is yalnizca
      // haftaPlanlari'ni bununla senkronize eder.
      const bildirimRef = db.collection('bildirimler').doc('W2026-05-18_2026-05-22_ogle_asil');
      await bildirimRef.set({
        haftaId: 'W2026-05-18',
        tarih: '2026-05-22',
        vakit: 'ogle',
        uid: 'muezzin2', // devralan
        tip: 'asil',
        durum: 'bekliyor', // vekalet kabulunde durum DEGISMEZ
        vekaletDevredildi: true
      });

      await processVekaletDevirleri(false);

      const bildirimDoc = await bildirimRef.get();
      assert.equal(bildirimDoc.data()?.vekaletPlanSenkronEdildi, true);

      const haftaDoc = await db.collection('haftaPlanlari').doc('W2026-05-18').get();
      assert.equal(haftaDoc.data()?.gunler['2026-05-22'].ogle.asil, 'muezzin2');
    }
  },
  {
    name: 'Ayni kaydi tekrar isleme yapmaz (idempotent)',
    run: async () => {
      await clearCollections();

      await db.collection('haftaPlanlari').doc('W2026-05-18').set({
        gunler: {
          '2026-05-22': {
            ogle: { asil: 'muezzin2', yedek: 'Sistem' }
          }
        }
      });

      const bildirimRef = db.collection('bildirimler').doc('W2026-05-18_2026-05-22_ogle_asil');
      await bildirimRef.set({
        haftaId: 'W2026-05-18',
        tarih: '2026-05-22',
        vakit: 'ogle',
        uid: 'muezzin2',
        tip: 'asil',
        durum: 'bekliyor',
        vekaletDevredildi: true,
        vekaletPlanSenkronEdildi: true // onceki bir calistirmada zaten islenmis
      });

      await processVekaletDevirleri(false);

      // Plan degismeden kalmali — is bu kaydi zaten islenmis sayip atlamali.
      const haftaDoc = await db.collection('haftaPlanlari').doc('W2026-05-18').get();
      assert.equal(haftaDoc.data()?.gunler['2026-05-22'].ogle.asil, 'muezzin2');
    }
  },
  {
    // Y2 regresyonu (ters yon): bu belge daha once bir MAZERET olayiyla
    // senkronlanmis olsa bile (mazeretPlanSenkronEdildi:true), sonraki bir
    // vekalet devri hala islenmelidir — bayraklar ayri oldugu icin birbirini
    // susturmaz.
    name: 'Daha once mazeretle senkronlanmis bir bildirim, sonraki vekalet devri hala islenir (Y2 regresyonu)',
    run: async () => {
      await clearCollections();

      await db.collection('haftaPlanlari').doc('W2026-05-18').set({
        gunler: {
          '2026-05-22': {
            ogle: { asil: 'muezzin1', yedek: 'Sistem' }
          }
        }
      });

      const bildirimRef = db.collection('bildirimler').doc('W2026-05-18_2026-05-22_ogle_asil');
      await bildirimRef.set({
        haftaId: 'W2026-05-18',
        tarih: '2026-05-22',
        vakit: 'ogle',
        uid: 'muezzin2',
        tip: 'asil',
        durum: 'bekliyor',
        vekaletDevredildi: true,
        // Bu belge GECMISTE bir mazeret olayiyla senkronlanmis (baska bir
        // hafta dongusunde) — paylasilan bayrak kullanilsaydi bu is
        // belgeyi "zaten islenmis" sanirdi.
        mazeretPlanSenkronEdildi: true
      });

      await processVekaletDevirleri(false);

      const bildirimDoc = await bildirimRef.get();
      assert.equal(bildirimDoc.data()?.vekaletPlanSenkronEdildi, true);

      const haftaDoc = await db.collection('haftaPlanlari').doc('W2026-05-18').get();
      assert.equal(haftaDoc.data()?.gunler['2026-05-22'].ogle.asil, 'muezzin2');
    }
  },
  {
    name: 'Plan belgesi henuz yoksa yine de isaretlenir (sonsuz tekrar onlenir)',
    run: async () => {
      await clearCollections();
      // haftaPlanlari HICH olusturulmadi.

      const bildirimRef = db.collection('bildirimler').doc('W2026-06-01_2026-06-03_yatsi_asil');
      await bildirimRef.set({
        haftaId: 'W2026-06-01',
        tarih: '2026-06-03',
        vakit: 'yatsi',
        uid: 'muezzin2',
        tip: 'asil',
        durum: 'bekliyor',
        vekaletDevredildi: true
      });

      await processVekaletDevirleri(false);

      const bildirimDoc = await bildirimRef.get();
      assert.equal(bildirimDoc.data()?.vekaletPlanSenkronEdildi, true);
    }
  }
];

async function main() {
  try {
    for (const test of tests) {
      await test.run();
      console.log(`OK ${test.name}`);
    }

    assert.equal(tests.length > 0, true);
    console.log(`${tests.length} integration tests passed`);
  } catch (err) {
    console.error('Integration test failed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
