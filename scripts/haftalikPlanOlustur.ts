import { db, Timestamp, FieldValue } from './lib/firebaseAdminInit.ts';
import { tieBreakerSirala } from './lib/tieBreaker.ts';
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

  // 2. Dinamik Tarih Hesaplama
  const simdi = new Date();
  const bugunDay = simdi.getDay(); // 0: Pazar, 1: Pazartesi...
  const diff = simdi.getDate() - (bugunDay === 0 ? 6 : bugunDay - 1); // Pazartesiye git
  const pazartesi = new Date(simdi.setDate(diff));
  pazartesi.setHours(0, 0, 0, 0);

  const haftaBaslangicStr = pazartesi.toISOString().split('T')[0];
  const haftaId = `W${haftaBaslangicStr}`; // Örn: W2026-04-20
  
  const gunler: string[] = [];
  for(let i=0; i<7; i++) {
    const gun = new Date(pazartesi);
    gun.setDate(pazartesi.getDate() + i);
    gunler.push(gun.toISOString().split('T')[0]);
  }
  const haftaBitisStr = gunler[6];

  const planDoc = await db.collection('haftaPlanlari').doc(haftaId).get();
  if (planDoc.exists) {
    console.log(`Plan (${haftaId}) zaten var, atlandı.`);
    process.exit(0);
  }

  // 3. Atama algoritması - buHaftakiYukler takibi
  const buHaftakiYukler: Record<string, number> = {};
  muezzinler.forEach(m => buHaftakiYukler[m.id] = 0);

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
        durum: 'bekliyor', pendingAck: false, olusturmaTarihi: Timestamp.now(),
        sonGuncelleme: Timestamp.now()
      });

      const bildirimYedekRef = db.collection('bildirimler').doc();
      batch.set(bildirimYedekRef, {
        haftaId, tarih: gun, vakit, uid: yedek.id, tip: 'yedek',
        durum: 'bekliyor', pendingAck: false, olusturmaTarihi: Timestamp.now(),
        sonGuncelleme: Timestamp.now()
      });
    }
  }

  // 4. Yazma
  batch.set(db.collection('haftaPlanlari').doc(haftaId), {
    haftaBaslangic: haftaBaslangicStr,
    haftaBitis: haftaBitisStr,
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
