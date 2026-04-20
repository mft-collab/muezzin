import { db, Timestamp, FieldValue } from './lib/firebaseAdminInit';
import { tieBreakerSirala } from './lib/tieBreaker';
import { Muezzin, HaftaPlan, Bildirim } from '../src/types';

async function main() {
  console.log("Haftalık plan oluşturma başladı...");

  // 1. Girdi okuma
  const muezzinSnapshot = await db.collection('muezzins').where('aktif', '==', true).get();
  const muezzinler = muezzinSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Muezzin & { id: string }));

  if (muezzinler.length < 2) {
    console.error("Yetersiz müezzin!");
    // adminUyarilari'na yaz
    await db.collection('adminUyarilari').add({
      tip: 'zincirTukendi',
      mesaj: 'Aktif müezzin sayısı 2\'den az!',
      tarih: new Date().toISOString().split('T')[0],
      cozuldu: false,
      olusturmaTarihi: Timestamp.now()
    });
    process.exit(1);
  }

  // 2. İdempotency - plan kontrolü
  const haftaId = "2026-W17"; // Örnek id, gerçekte hesaplanmalı
  const planDoc = await db.collection('haftaPlanlari').doc(haftaId).get();
  if (planDoc.exists) {
    console.log("Plan zaten var, atlandı.");
    process.exit(0);
  }

  // 3. Atama algoritması - buHaftakiYukler takibi
  const buHaftakiYukler: Record<string, number> = {};
  muezzinler.forEach(m => buHaftakiYukler[m.id] = 0);

  const gunler = ['2026-04-20', '2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24', '2026-04-25', '2026-04-26'];
  const vakitler = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'];
  
  const gunPlan: any = {};
  const batch = db.batch();

  for (const gun of gunler) {
    gunPlan[gun] = {};
    for (const vakit of vakitler) {
      const sirali = tieBreakerSirala(muezzinler, buHaftakiYukler);
      
      const asil = sirali[0];
      const yedek = sirali[1];

      buHaftakiYukler[asil.id]++;

      gunPlan[gun][vakit] = { asil: asil.id, yedek: yedek.id };

      // Bildirimler
      const bildirimAsilRef = db.collection('bildirimler').doc();
      batch.set(bildirimAsilRef, {
        haftaId, tarih: gun, vakit, uid: asil.id, tip: 'asil',
        durum: 'bekliyor', pendingAck: false, olusturmaTarihi: Timestamp.now()
      });

      const bildirimYedekRef = db.collection('bildirimler').doc();
      batch.set(bildirimYedekRef, {
        haftaId, tarih: gun, vakit, uid: yedek.id, tip: 'yedek',
        durum: 'bekliyor', pendingAck: false, olusturmaTarihi: Timestamp.now()
      });
    }
  }

  // 4. Yazma
  batch.set(db.collection('haftaPlanlari').doc(haftaId), {
    haftaBaslangic: '2026-04-20',
    haftaBitis: '2026-04-26',
    durum: 'yayinda',
    olusturmaTarihi: Timestamp.now(),
    gunler: gunPlan
  });

  await batch.commit();

  console.log(`Hafta ${haftaId}: Tüm atamalar ve bildirimler tamamlandı.`);
  process.exit(0);
}

main().catch(err => {
  console.error("Kritik hata:", err);
  process.exit(1);
});
