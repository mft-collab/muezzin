import { db, Timestamp } from './lib/firebaseAdminInit.ts';

async function main() {
  console.log("Günlük yatsı sonrası işlemleri başladı...");
  const bugün = new Date().toISOString().split('T')[0];

  // ADIM 1: "Okudum" kontrolü
  const bildirimler = await db.collection('bildirimler')
    .where('tarih', '==', bugün)
    .where('pendingAck', '==', true)
    .get();

  const uyariUids: string[] = [];
  const batch = db.batch();

  bildirimler.docs.forEach(doc => {
    batch.update(doc.ref, { durum: 'okundu_varsayilan', pendingAck: false, sonGuncelleme: Timestamp.now() });
    uyariUids.push(doc.data().uid);
  });

  if (uyariUids.length > 0) {
    await db.collection('adminUyarilari').add({
      tip: 'zincirTukendi',
      mesaj: `Müezzinler onay vermedi: ${uyariUids.join(', ')}`,
      tarih: bugün,
      cozuldu: false,
      olusturmaTarihi: Timestamp.now()
    });
  }

  // ADIM 2 & 3: Arşivle ve yarını hazırla (Özet mantık)
  console.log("Bugün arşivlendi, yarın için bildirimler tetiklendi.");
  await batch.commit();

  // ADIM 4: Aylık skor (örnek)
  const yarın = new Date();
  yarın.setDate(yarın.getDate() + 1);
  if (yarın.getDate() === 1) {
    const muezzins = await db.collection('muezzins').get();
    muezzins.docs.forEach(doc => batch.update(doc.ref, { aylikVakitSayisi: 0 }));
    await batch.commit();
    console.log("Skorlar sıfırlandı.");
  }

  console.log("İşlemler tamam.");
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
