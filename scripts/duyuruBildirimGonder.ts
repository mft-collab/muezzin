import { db } from './lib/firebaseAdminInit.ts';
import { fcmGonderVeTemizle, kullaniciFcmTokenleriniTopla, type FcmMessage, type FcmGonderici } from './lib/fcmNotify.ts';

type DuyuruData = {
  baslik: string;
  icerik: string;
  tip: 'onemli' | 'bilgi' | 'duyuru';
  bildirimGonderildi?: boolean;
};

type MuezzinData = {
  aktif?: boolean;
  notificationSettings?: { duyurular?: boolean };
  fcmTokens?: Record<string, unknown>;
  fcmToken?: string | null;
};

const ICERIK_ONIZLEME_UZUNLUGU = 200;

/**
 * `duyurular` koleksiyonunda `bildirimGonderildi: false` olan (henüz push
 * bildirimi gönderilmemiş) her yeni duyuru için, `notificationSettings.duyurular
 * !== false` olan tüm aktif müezzinlere FCM push gönderir.
 *
 * `duyuruYayinla` (src/services/duyuruServisi.ts) her yeni duyuruyu
 * `bildirimGonderildi: false` ile oluşturur — bu sorgu tek bir eşitlik
 * filtresi (`== false`) olduğundan, mazeretDevirleriniIsle.ts/
 * vekaletDevirleriniIsle.ts'in daha önce sınırsız büyüyen koleksiyonları tam
 * taradığı sınıftan bir sorunu baştan taşımaz (bkz. Firebase/GitHub veri
 * akışı optimizasyonu) — işlenen her duyuru anında `true`'ya çevrildiğinden
 * bu küme her zaman küçük/geçici kalır.
 *
 * @param gonderici Yalnızca testler için — bkz. `fcmGonderVeTemizle`.
 */
export async function processDuyuruBildirimleri(
  dryRun = false,
  gonderici?: FcmGonderici
): Promise<{ duyuruSayisi: number; mesajSayisi: number }> {
  console.log(`Duyuru bildirimleri gönderiliyor${dryRun ? ' (dry-run)' : ''}...`);

  const duyuruSnap = await db.collection('duyurular')
    .where('bildirimGonderildi', '==', false)
    .get();

  if (duyuruSnap.empty) {
    console.log('Bildirilecek yeni duyuru yok.');
    return { duyuruSayisi: 0, mesajSayisi: 0 };
  }

  const muezzinSnap = await db.collection('muezzins').where('aktif', '==', true).get();
  const tokenToUidMap: Record<string, string> = {};
  const alicilarinFcmTokenleri: string[] = [];
  muezzinSnap.docs.forEach((docSnap) => {
    const m = docSnap.data() as MuezzinData;
    if (m.notificationSettings?.duyurular === false) return;
    const tokens = kullaniciFcmTokenleriniTopla(m);
    tokens.forEach((t) => { tokenToUidMap[t] = docSnap.id; });
    alicilarinFcmTokenleri.push(...tokens);
  });

  const tumMesajlar: FcmMessage[] = [];
  const markBatch = db.batch();
  let duyuruSayisi = 0;

  duyuruSnap.docs.forEach((docSnap) => {
    const duyuru = docSnap.data() as DuyuruData;
    duyuruSayisi++;

    const icerikOnizleme = duyuru.icerik.length > ICERIK_ONIZLEME_UZUNLUGU
      ? `${duyuru.icerik.slice(0, ICERIK_ONIZLEME_UZUNLUGU)}…`
      : duyuru.icerik;

    alicilarinFcmTokenleri.forEach((token) => {
      tumMesajlar.push({
        token,
        notification: { title: duyuru.baslik, body: icerikOnizleme },
        data: { type: 'duyuru_yayinlandi', duyuruId: docSnap.id, duyuruTip: duyuru.tip }
      });
    });

    if (!dryRun) {
      markBatch.update(docSnap.ref, { bildirimGonderildi: true });
    }
  });

  console.log(`${duyuruSayisi} yeni duyuru, ${alicilarinFcmTokenleri.length} alıcı cihaza gönderilecek.`);

  if (dryRun) {
    console.log(`Tamamlandi (dry-run). duyuruSayisi=${duyuruSayisi}, mesajSayisi=${tumMesajlar.length}`);
    return { duyuruSayisi, mesajSayisi: tumMesajlar.length };
  }

  // SIRA ÖNEMLİ: gönderim TAMAMEN başarısız olursa fcmGonderVeTemizle
  // FIRLATIR (bkz. FcmGonderimBasarisizHatasi) ve aşağıdaki commit hiç
  // çalışmaz — `bildirimGonderildi` false kalır, duyuru bir sonraki koşuda
  // yeniden denenir. Ayrıca hata bu fonksiyonun çağıranına (CLI sarmalayıcı)
  // kadar çıkıp process.exit(1) ürettiğinden, workflow'un `if: success()`
  // adımı (reportWorkflowSuccess.ts) çalışmaz ve önceki arıza uyarısı
  // yanlışlıkla "çözüldü" işaretlenmez.
  await fcmGonderVeTemizle(tumMesajlar, tokenToUidMap, 'FCM duyuru bildirimi', gonderici);
  await markBatch.commit();
  console.log(`Tamamlandi. duyuruSayisi=${duyuruSayisi}`);
  return { duyuruSayisi, mesajSayisi: tumMesajlar.length };
}

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  const isDryRun = process.argv.includes('--dry-run');
  processDuyuruBildirimleri(isDryRun).catch((err) => {
    console.error('Duyuru bildirimleri gönderilemedi:', err);
    process.exit(1);
  });
}
