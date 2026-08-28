import { db, Timestamp } from './lib/firebaseAdminInit.ts';
import { aylikVakitleriGrupla } from '../src/services/ezanVaktiServisi.ts';
import { vakitleriCekOncelikli } from './lib/diyanetResmiApi.ts';
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

    // API her zaman yaklaşık 30-32 günlük veri döner (mevcut günden itibaren).
    // Önce resmi Diyanet API'sini dener, başarısız olursa (kimlik bilgisi
    // yok/kota/ağ hatası) mevcut public zincire (emushaf/Aladhan) düşer —
    // bkz. scripts/lib/diyanetResmiApi.ts.
    const vakitData = await vakitleriCekOncelikli(simdi.getFullYear(), simdi.getMonth() + 1, ilceId, ilceAdi);

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

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    // NOT: burada önceden Firestore-izin/not-found hatası tespit edilince
    // `handleFirestoreError` çağrılıyordu — o fonksiyon HER ZAMAN fırlatır
    // (dönüş tipi `never`), bu yüzden altındaki admin uyarısı yazımı bu
    // durumda HİÇ çalışmıyordu; tam da en ciddi hata sınıfının (izin/
    // not-found) admin panelinde görünmeyen tür olması riski vardı (bkz.
    // kod denetimi). Yalnızca ek yapılandırılmış konsol logu için çağrılır,
    // fırlatması yutulur — admin uyarısı koşulsuz olarak aşağıda yazılır.
    const isFirestoreHatasi = message.includes('permission') || message.includes('NOT_FOUND') || message.includes('code: 5') || message.includes('code: 7');
    if (isFirestoreHatasi) {
      try {
        handleFirestoreError(err, OperationType.WRITE, `vakitler`);
      } catch { /* handleFirestoreError zaten fırlatır — yalnızca yapılandırılmış log için çağrıldı */ }
    }

    console.error(`Hata:`, message);
    await db.collection('adminUyarilari').add({
      tip: 'apiHatasi',
      mesaj: `Vakit güncelleme hatası: ${message}`,
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
