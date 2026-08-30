process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
import assert from 'node:assert/strict';
import { db } from '../../scripts/lib/firebaseAdminInit.ts';
import { processVekaletDevirleri } from '../../scripts/vekaletDevirleriniIsle.ts';
import { getTurkeyDateString, getTurkeyNow } from '../../src/lib/dateUtils.ts';

// scripts/vekaletDevirleriniIsle.ts artık sorgularını `tarih >= otuzGunOnce`
// ile son 30 günle sınırlıyor (bkz. Firebase/GitHub veri akışı optimizasyonu)
// — bu yüzden test verisi sabit 2026 tarihleri yerine "bugün - N gün" olarak
// hesaplanır, aksi halde zaman geçtikçe testler pencerenin dışına düşüp
// sessizce hiçbir belgeyi bulamaz.
function gunOnce(n: number): string {
  return getTurkeyDateString(new Date(getTurkeyNow().getTime() - n * 24 * 60 * 60 * 1000));
}

// haftalikIzinGunu ile AYNI ölçekte (Pazartesi=1 ... Pazar=7) — scripts/
// vekaletDevirleriniIsle.ts'teki haftaGunuNumarasi ile AYNI formül.
function haftaGunuNumarasi(tarihStr: string): number {
  const [y, m, d] = tarihStr.split('-').map(Number);
  const gunTarihi = new Date(y!, m! - 1, d!);
  return ((gunTarihi.getDay() + 6) % 7) + 1;
}

const TARIH_1 = gunOnce(3);
const TARIH_2 = gunOnce(2);

type TestCase = {
  name: string;
  run: () => Promise<void>;
};

async function clearCollections() {
  const collections = ['muezzins', 'bildirimler', 'haftaPlanlari', 'adminUyarilari', 'vekalet_talepleri', 'audit_logs'];
  for (const collection of collections) {
    const snapshot = await db.collection(collection).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
}

/**
 * "1000 ifade tavanı" kök neden çözümü sonrası GERÇEK sahiplik transferini
 * (bildirimler.uid flip'i) burada, taze veriyle yeniden doğrulayarak kuran
 * fixture — bkz. scripts/vekaletDevirleriniIsle.ts yorumu.
 */
async function seedKabulEdilmisTalep(overrides: {
  aliciAktif?: boolean;
  aliciOnayBekliyor?: boolean;
  aliciHaftalikIzinGunu?: number;
  bildirimCumaMi?: boolean;
  bildirimDurum?: string;
} = {}) {
  await db.collection('muezzins').doc('muezzin1').set({
    displayName: 'Muezzin One', role: 'muezzin', aktif: true, onayBekliyor: false
  });
  await db.collection('muezzins').doc('muezzin2').set({
    displayName: 'Muezzin Two',
    role: 'muezzin',
    aktif: overrides.aliciAktif ?? true,
    onayBekliyor: overrides.aliciOnayBekliyor ?? false,
    ...(overrides.aliciHaftalikIzinGunu !== undefined ? { haftalikIzinGunu: overrides.aliciHaftalikIzinGunu } : {})
  });

  const bildirimRef = db.collection('bildirimler').doc(`W2026-05-18_${TARIH_1}_ogle_asil`);
  await bildirimRef.set({
    haftaId: 'W2026-05-18',
    tarih: TARIH_1,
    vakit: 'ogle',
    uid: 'muezzin1',
    tip: 'asil',
    durum: overrides.bildirimDurum ?? 'bekliyor',
    pendingAck: true,
    cumaMi: overrides.bildirimCumaMi ?? false,
    vekaletDevriBekliyor: true
  });

  const talepRef = db.collection('vekalet_talepleri').doc(`W2026-05-18_${TARIH_1}_ogle_asil_muezzin2`);
  await talepRef.set({
    bildirimId: `W2026-05-18_${TARIH_1}_ogle_asil`,
    haftaId: 'W2026-05-18',
    gonderenUid: 'muezzin1',
    gonderenIsim: 'Muezzin One',
    aliciUid: 'muezzin2',
    aliciIsim: 'Muezzin Two',
    tarih: TARIH_1,
    vakit: 'ogle',
    saat: '12:45',
    tip: 'asil',
    durum: 'kabul_edildi'
  });

  return { bildirimRef, talepRef };
}

const tests: TestCase[] = [
  {
    // "1000 ifade tavanı" kök neden çözümü: GERÇEK sahiplik transferi
    // (uid flip'i) artık burada, Admin SDK ile gerçekleşiyor — istemci
    // yalnızca vekalet_talepleri.durum='kabul_edildi' + bildirimde dar bir
    // vekaletDevriBekliyor:true bayrağı yazar (bkz. firestore.rules
    // isVekaletDevriBekliyorIsareti, src/services/vekaletServisi.ts).
    name: 'Kabul edilmis talep bildirimi devralan kisiye transfer eder',
    run: async () => {
      await clearCollections();
      const { bildirimRef, talepRef } = await seedKabulEdilmisTalep({ aliciHaftalikIzinGunu: 1 });

      await processVekaletDevirleri(false);

      const bildirimDoc = await bildirimRef.get();
      assert.equal(bildirimDoc.data()?.uid, 'muezzin2');
      assert.equal(bildirimDoc.data()?.vekaletDevredildi, true);
      assert.equal(bildirimDoc.data()?.vekaletDevriBekliyor, false);

      const talepDoc = await talepRef.get();
      assert.equal(talepDoc.data()?.bildirimUygulandi, true);
      assert.equal(talepDoc.data()?.talepSonuc, 'uygulandi');

      const auditSnap = await db.collection('audit_logs').get();
      assert.equal(auditSnap.size, 1);
      assert.equal(auditSnap.docs[0]!.data().userId, 'muezzin2');
    }
  },
  {
    name: 'Ayni kabul edilmis talebi tekrar transfer etmez (idempotent)',
    run: async () => {
      await clearCollections();
      const { bildirimRef, talepRef } = await seedKabulEdilmisTalep({ aliciHaftalikIzinGunu: 1 });

      await processVekaletDevirleri(false);
      await processVekaletDevirleri(false);

      const bildirimDoc = await bildirimRef.get();
      assert.equal(bildirimDoc.data()?.uid, 'muezzin2');

      const talepDoc = await talepRef.get();
      assert.equal(talepDoc.data()?.bildirimUygulandi, true);
      assert.equal(talepDoc.data()?.talepSonuc, 'uygulandi');

      // Ikinci calistirma yeni bir audit-log yazmamali.
      const auditSnap = await db.collection('audit_logs').get();
      assert.equal(auditSnap.size, 1);
    }
  },
  {
    // Devreye alma penceresi güvenliği: rules+istemci deploy'u ile bu
    // script'in (cron, git push ile ayrı ayrı devreye giriyor) devreye alma
    // anları tam çakışmayabilir. Eski istemci, henüz eski kurallar
    // canlıyken, transferi ZATEN doğrudan tamamlamış olabilir (bildirim.uid
    // zaten aliciUid) — script bunu "artık devralamıyor" sanıp yanlış admin
    // uyarısı ÜRETMEMELİ, sessizce idempotent bir no-op yapmalı.
    name: 'Eski istemcinin zaten tamamladigi transfer icin yanlis admin uyarisi uretilmez',
    run: async () => {
      await clearCollections();
      const { bildirimRef, talepRef } = await seedKabulEdilmisTalep({ aliciHaftalikIzinGunu: 1 });
      // Eski istemci/kural yolu: uid zaten flip edilmis.
      await bildirimRef.update({ uid: 'muezzin2', vekaletDevredildi: true, vekaletDevriBekliyor: false });

      await processVekaletDevirleri(false);

      const bildirimDoc = await bildirimRef.get();
      assert.equal(bildirimDoc.data()?.uid, 'muezzin2');

      const talepDoc = await talepRef.get();
      assert.equal(talepDoc.data()?.bildirimUygulandi, true);
      assert.equal(talepDoc.data()?.talepSonuc, 'uygulandi');

      const alarmSnap = await db.collection('adminUyarilari').get();
      assert.equal(alarmSnap.size, 0);
      const auditSnap = await db.collection('audit_logs').get();
      assert.equal(auditSnap.size, 0);
    }
  },
  {
    // Talep oluşturulduğunda alıcının aktif müezzin olduğu doğrulanmıştı
    // (isValidVekaletCreate), ama talep beklerken (ve script'in ~10-15 dk'lık
    // gecikme penceresinde) admin alıcıyı arşivleyebilir — script kabul
    // anında değil UYGULAMA anında yeniden doğrular (bkz. eski O9 regresyonu,
    // artık CEL'den buraya taşındı).
    name: 'Kabul sonrasi arsivlenen alici transferi engeller, onceki sahip korunur, admin uyarisi olusturulur',
    run: async () => {
      await clearCollections();
      const { bildirimRef, talepRef } = await seedKabulEdilmisTalep({ aliciAktif: false, aliciHaftalikIzinGunu: 1 });

      await processVekaletDevirleri(false);

      const bildirimDoc = await bildirimRef.get();
      assert.equal(bildirimDoc.data()?.uid, 'muezzin1');
      assert.equal(bildirimDoc.data()?.vekaletDevredildi, undefined);
      // planServisi.ts korumaliSlotMu koruması artık gerekmediğinden bayrak
      // temizlenmeli — aksi halde önceki sahibin slotu sonsuza kadar
      // "korumalı" (dolayısıyla plan yeniden üretiminden muaf) kalırdı.
      assert.equal(bildirimDoc.data()?.vekaletDevriBekliyor, false);

      const talepDoc = await talepRef.get();
      assert.equal(talepDoc.data()?.bildirimUygulandi, true);
      assert.equal(talepDoc.data()?.talepSonuc, 'reddedildi');

      const alarmSnap = await db.collection('adminUyarilari').where('cozuldu', '==', false).get();
      assert.equal(alarmSnap.size, 1);
      assert.equal(alarmSnap.docs[0]!.data().tip, 'zincirTukendi');
    }
  },
  {
    // Sabit haftalık izin gününde asla atama yok kısıtlaması (bkz.
    // isValidBildirim'deki karşılığı) vekalet KABUL yolunda da uygulanmalı —
    // eskiden CEL'de, artık burada, taze veriyle.
    name: 'Alicinin sabit haftalik izin gunune denk gelen kabul transferi engellenir',
    run: async () => {
      await clearCollections();
      // TARIH_1'in gerçek haftanın-günü numarasıyla (Pazartesi=1..Pazar=7)
      // AYNI değer — hangi güne denk geldiği değil, çakışmanın kendisi test
      // ediliyor.
      const { bildirimRef, talepRef } = await seedKabulEdilmisTalep({ aliciHaftalikIzinGunu: haftaGunuNumarasi(TARIH_1) });

      await processVekaletDevirleri(false);

      const bildirimDoc = await bildirimRef.get();
      assert.equal(bildirimDoc.data()?.uid, 'muezzin1');

      const talepDoc = await talepRef.get();
      assert.equal(talepDoc.data()?.bildirimUygulandi, true);
      assert.equal(talepDoc.data()?.talepSonuc, 'reddedildi');
    }
  },
  {
    name: 'Cuma gorevi icin kabul transferi engellenir',
    run: async () => {
      await clearCollections();
      const { bildirimRef, talepRef } = await seedKabulEdilmisTalep({ aliciHaftalikIzinGunu: 1, bildirimCumaMi: true });

      await processVekaletDevirleri(false);

      const bildirimDoc = await bildirimRef.get();
      assert.equal(bildirimDoc.data()?.uid, 'muezzin1');

      const talepDoc = await talepRef.get();
      assert.equal(talepDoc.data()?.bildirimUygulandi, true);
      assert.equal(talepDoc.data()?.talepSonuc, 'reddedildi');
    }
  },
  {
    // Bildirim script calisana kadar baska bir yolla (ör. mazeretle)
    // 'bekliyor' disina cikmis olabilir — transfer atlanmali, talep yine
    // isaretlenmeli ki sonsuza kadar denenmesin.
    name: 'Bildirim artik bekliyor durumunda degilse transfer atlanir',
    run: async () => {
      await clearCollections();
      const { bildirimRef, talepRef } = await seedKabulEdilmisTalep({ aliciHaftalikIzinGunu: 1, bildirimDurum: 'reddedildi' });

      await processVekaletDevirleri(false);

      const bildirimDoc = await bildirimRef.get();
      assert.equal(bildirimDoc.data()?.uid, 'muezzin1');

      const talepDoc = await talepRef.get();
      assert.equal(talepDoc.data()?.bildirimUygulandi, true);
      assert.equal(talepDoc.data()?.talepSonuc, 'reddedildi');
    }
  },
  {
    name: 'Kabul edilen vekalet devri haftaPlanlari onbellegini senkronize eder',
    run: async () => {
      await clearCollections();

      await db.collection('haftaPlanlari').doc('W2026-05-18').set({
        gunler: {
          [TARIH_1]: {
            ogle: { asil: 'muezzin1', yedek: 'Sistem' }
          }
        }
      });

      // vekaletKabulEt (istemci) zaten bildirim.uid'yi degistirip
      // vekaletDevredildi:true yazmis olarak kabul edilir — bu is yalnizca
      // haftaPlanlari'ni bununla senkronize eder.
      const bildirimRef = db.collection('bildirimler').doc(`W2026-05-18_${TARIH_1}_ogle_asil`);
      await bildirimRef.set({
        haftaId: 'W2026-05-18',
        tarih: TARIH_1,
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
      assert.equal(haftaDoc.data()?.gunler[TARIH_1].ogle.asil, 'muezzin2');
    }
  },
  {
    name: 'Ayni kaydi tekrar isleme yapmaz (idempotent)',
    run: async () => {
      await clearCollections();

      await db.collection('haftaPlanlari').doc('W2026-05-18').set({
        gunler: {
          [TARIH_1]: {
            ogle: { asil: 'muezzin2', yedek: 'Sistem' }
          }
        }
      });

      const bildirimRef = db.collection('bildirimler').doc(`W2026-05-18_${TARIH_1}_ogle_asil`);
      await bildirimRef.set({
        haftaId: 'W2026-05-18',
        tarih: TARIH_1,
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
      assert.equal(haftaDoc.data()?.gunler[TARIH_1].ogle.asil, 'muezzin2');
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
          [TARIH_1]: {
            ogle: { asil: 'muezzin1', yedek: 'Sistem' }
          }
        }
      });

      const bildirimRef = db.collection('bildirimler').doc(`W2026-05-18_${TARIH_1}_ogle_asil`);
      await bildirimRef.set({
        haftaId: 'W2026-05-18',
        tarih: TARIH_1,
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
      assert.equal(haftaDoc.data()?.gunler[TARIH_1].ogle.asil, 'muezzin2');
    }
  },
  {
    name: 'Plan belgesi henuz yoksa yine de isaretlenir (sonsuz tekrar onlenir)',
    run: async () => {
      await clearCollections();
      // haftaPlanlari HICH olusturulmadi.

      const bildirimRef = db.collection('bildirimler').doc(`W2026-06-01_${TARIH_2}_yatsi_asil`);
      await bildirimRef.set({
        haftaId: 'W2026-06-01',
        tarih: TARIH_2,
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
