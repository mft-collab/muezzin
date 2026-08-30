process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
import assert from 'node:assert/strict';
import { db } from '../../scripts/lib/firebaseAdminInit.ts';
import { processDuyuruBildirimleri } from '../../scripts/duyuruBildirimGonder.ts';

type TestCase = {
  name: string;
  run: () => Promise<void>;
};

async function clearCollections() {
  const collections = ['muezzins', 'duyurular'];
  for (const collection of collections) {
    const snapshot = await db.collection(collection).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

const tests: TestCase[] = [
  {
    // Gercek FCM gonderimi bu entegrasyon suitinde (yalnizca Firestore
    // emule edilir, FCM edilmez) tetiklenmemeli — bu yuzden test SIFIR
    // alicili bir senaryo kurar: fcmGonderVeTemizle mesaj listesi bos
    // oldugunda ag cagrisi yapmadan hemen doner (bkz. scripts/lib/
    // fcmNotify.ts), boylece bildirimGonderildi'nin gercekten true'ya
    // cevrildigi ag'a hic dokunmadan dogrulanabilir.
    name: 'Alici yoksa yine de bildirimGonderildi true olarak isaretlenir (idempotency)',
    run: async () => {
      await clearCollections();
      // Aktif muezzin yok — hicbir alici bulunamayacak.
      const duyuruRef = db.collection('duyurular').doc('duyuru1');
      await duyuruRef.set({
        baslik: 'Test Duyurusu',
        icerik: 'Icerik',
        tip: 'duyuru',
        bildirimGonderildi: false
      });

      const sonuc = await processDuyuruBildirimleri(false);
      assert.equal(sonuc.duyuruSayisi, 1);
      assert.equal(sonuc.mesajSayisi, 0);

      const duyuruDoc = await duyuruRef.get();
      assert.equal(duyuruDoc.data()?.bildirimGonderildi, true);
    }
  },
  {
    name: 'Zaten bildirilmis bir duyuru tekrar islenmez',
    run: async () => {
      await clearCollections();
      const duyuruRef = db.collection('duyurular').doc('duyuru2');
      await duyuruRef.set({
        baslik: 'Eski Duyuru',
        icerik: 'Icerik',
        tip: 'bilgi',
        bildirimGonderildi: true
      });

      const sonuc = await processDuyuruBildirimleri(false);
      assert.equal(sonuc.duyuruSayisi, 0);
    }
  },
  {
    // duyurular:false tercihi olan aktif bir muezzin varsa bile (alici
    // olmadigindan) ag'a dokunulmadan idempotency dogrulanir; ayrica bu
    // kullanicinin tercihinin dogru sekilde ELENDIGI (mesajSayisi'ne
    // katkida bulunmadigi) dry-run modunda sayimla ayrica dogrulanir.
    name: 'duyurular tercihi kapali olan aktif muezzin mesaj sayisina dahil edilmez (dry-run)',
    run: async () => {
      await clearCollections();
      await db.collection('muezzins').doc('muezzin_optout').set({
        displayName: 'Optout',
        role: 'muezzin',
        aktif: true,
        notificationSettings: { duyurular: false },
        fcmTokens: { fake_token_1: new Date() }
      });
      await db.collection('duyurular').doc('duyuru3').set({
        baslik: 'Test',
        icerik: 'Icerik',
        tip: 'onemli',
        bildirimGonderildi: false
      });

      const sonuc = await processDuyuruBildirimleri(true);
      assert.equal(sonuc.duyuruSayisi, 1);
      assert.equal(sonuc.mesajSayisi, 0);

      // dry-run oldugundan bayrak degismemis olmali.
      const duyuruDoc = await db.collection('duyurular').doc('duyuru3').get();
      assert.equal(duyuruDoc.data()?.bildirimGonderildi, false);
    }
  },
  {
    name: 'duyurular tercihi acik olan aktif muezzinin tokeni mesaj sayisina dahil edilir (dry-run)',
    run: async () => {
      await clearCollections();
      await db.collection('muezzins').doc('muezzin_optin').set({
        displayName: 'Optin',
        role: 'muezzin',
        aktif: true,
        fcmTokens: { fake_token_a: new Date(), fake_token_b: new Date() }
      });
      await db.collection('duyurular').doc('duyuru4').set({
        baslik: 'Test',
        icerik: 'Icerik',
        tip: 'onemli',
        bildirimGonderildi: false
      });

      const sonuc = await processDuyuruBildirimleri(true);
      assert.equal(sonuc.duyuruSayisi, 1);
      assert.equal(sonuc.mesajSayisi, 2);
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
