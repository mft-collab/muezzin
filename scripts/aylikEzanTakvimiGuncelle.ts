import { db, Timestamp } from './lib/firebaseAdminInit.ts';
import { aylikVakitleriCek, aylikVakitleriGrupla } from '../src/services/ezanVaktiServisi.ts';
import { getTurkeyNow } from '../src/lib/dateUtils.ts';
import { handleFirestoreError, OperationType } from './lib/errors.ts';

async function main() {
  const simdi = getTurkeyNow();

  try {
    // Uygulamanın gerçekten okuduğu ilçe hangisiyse veriyi ona göre çek ve
    // doküman ID'sini de aynı şekilde ilçe önekiyle yaz — aksi halde
    // (bkz. src/store/useVakitStore.ts `${ilceId}_${YYYY-MM}`) uygulama bu
    // güncellemeyi hiç görmez ve eski veri üzerinde donar.
    const settingsSnap = await db.collection('settings').doc('system').get();
    const settings = settingsSnap.data() as { ilceId?: string; ilceAdi?: string } | undefined;
    const ilceId = settings?.ilceId || '9148';
    const ilceAdi = settings?.ilceAdi || 'Ceyhan';

    // API her zaman yaklaşık 30-32 günlük veri döner (mevcut günden itibaren)
    const vakitData = await aylikVakitleriCek(simdi.getFullYear(), simdi.getMonth() + 1, ilceId, ilceAdi);

    // Verileri aylara göre grupla (bkz. src/services/ezanVaktiServisi.ts
    // aylikVakitleriGrupla — istemci senkronuyla paylaşılan tek gruplama
    // mantığı, mimari denetim O5).
    const aylar = aylikVakitleriGrupla(vakitData);

    // Gruplanmış verileri Firestore'a yaz
    for (const [ayId, data] of Object.entries(aylar)) {
      const docId = `${ilceId}_${ayId}`;
      await db.collection('vakitler').doc(docId).set({
        ...data,
        guncellenmeTarihi: Timestamp.now()
      }, { merge: true });
      console.log(`Başarılı: ${docId} (${Object.keys(data.gunler).length} gün güncellendi)`);
    }

  } catch (err: any) {
    if (err.message.includes('permission') || err.message.includes('NOT_FOUND') || err.message.includes('code: 5') || err.message.includes('code: 7')) {
       handleFirestoreError(err, OperationType.WRITE, `vakitler`);
    }
    
    console.error(`Hata:`, err.message);
    await db.collection('adminUyarilari').add({
      tip: 'apiHatasi',
      mesaj: `Vakit güncelleme hatası: ${err.message}`,
      cozuldu: false,
      olusturmaTarihi: Timestamp.now()
    });
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error("Kritik hata:", err);
  process.exit(1);
});
