process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
import assert from 'node:assert/strict';
import { db, Timestamp } from '../../scripts/lib/firebaseAdminInit.ts';
import { processMazeretDevirleri } from '../../scripts/mazeretDevirleriniIsle.ts';

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
    name: 'Yedek gorevli varsa asil olarak atanir',
    run: async () => {
      await clearCollections();

      // Seed Muezzins
      await db.collection('muezzins').doc('muezzin_asil').set({
        displayName: 'Asil',
        role: 'muezzin',
        aktif: true
      });
      await db.collection('muezzins').doc('muezzin_yedek').set({
        displayName: 'Yedek',
        role: 'muezzin',
        aktif: true
      });

      // Seed Hafta Plani
      await db.collection('haftaPlanlari').doc('W2026-05-18').set({
        gunler: {
          '2026-05-22': {
            sabah: { asil: 'muezzin_asil', yedek: 'muezzin_yedek' }
          }
        }
      });

      // Seed Notifications
      const mazeretRef = db.collection('bildirimler').doc('bildirim_asil');
      await mazeretRef.set({
        haftaId: 'W2026-05-18',
        tarih: '2026-05-22',
        vakit: 'sabah',
        uid: 'muezzin_asil',
        tip: 'asil',
        durum: 'reddedildi', // Mazeret bildirilmis
        devirIslendi: false
      });

      const yedekRef = db.collection('bildirimler').doc('bildirim_yedek');
      await yedekRef.set({
        haftaId: 'W2026-05-18',
        tarih: '2026-05-22',
        vakit: 'sabah',
        uid: 'muezzin_yedek',
        tip: 'yedek',
        durum: 'bekliyor'
      });

      // Act
      await processMazeretDevirleri(false);

      // Assert
      const mazeretDoc = await mazeretRef.get();
      assert.equal(mazeretDoc.data()?.devirIslendi, true);
      assert.equal(mazeretDoc.data()?.devirSonucu, 'yedek_atandi');

      const yedekDoc = await yedekRef.get();
      assert.equal(yedekDoc.data()?.tip, 'asil');
      assert.equal(yedekDoc.data()?.durum, 'bekliyor');
      assert.equal(yedekDoc.data()?.pendingAck, true);

      const haftaDoc = await db.collection('haftaPlanlari').doc('W2026-05-18').get();
      assert.equal(haftaDoc.data()?.gunler['2026-05-22'].sabah.asil, 'muezzin_yedek');
      assert.equal(haftaDoc.data()?.gunler['2026-05-22'].sabah.yedek, 'Sistem');
    }
  },
  {
    name: 'Yedek yoksa admin uyarisi uretilir',
    run: async () => {
      await clearCollections();

      // Seed Muezzins
      await db.collection('muezzins').doc('muezzin_asil').set({
        displayName: 'Asil',
        role: 'muezzin',
        aktif: true
      });
      // No active yedek

      // Seed Notifications
      const mazeretRef = db.collection('bildirimler').doc('bildirim_asil_2');
      await mazeretRef.set({
        haftaId: 'W2026-05-18',
        tarih: '2026-05-23',
        vakit: 'ogle',
        uid: 'muezzin_asil',
        tip: 'asil',
        durum: 'reddedildi', // Mazeret
        devirIslendi: false
      });

      // Act
      await processMazeretDevirleri(false);

      // Assert
      const mazeretDoc = await mazeretRef.get();
      assert.equal(mazeretDoc.data()?.devirIslendi, true);
      assert.equal(mazeretDoc.data()?.devirSonucu, 'alarm_uretildi');

      const alarmSnap = await db.collection('adminUyarilari').get();
      assert.equal(alarmSnap.size, 1);
      const alarm = alarmSnap.docs[0].data();
      assert.equal(alarm.tip, 'zincirTukendi');
      assert.equal(alarm.cozuldu, false);
      assert.equal(alarm.tarih, '2026-05-23');
      assert.equal(alarm.vakit, 'ogle');
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
