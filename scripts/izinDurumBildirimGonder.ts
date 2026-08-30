import { db } from './lib/firebaseAdminInit.ts';
import { fcmGonderVeTemizle, kullaniciFcmTokenleriniTopla, type FcmMessage } from './lib/fcmNotify.ts';

type IzinData = {
  uid: string;
  baslangic: string;
  bitis: string;
  tip: 'haftalik' | 'yillik' | 'mazeret';
  durum: 'onay_bekliyor' | 'onaylandi' | 'reddedildi';
  redSebebi?: string;
  bildirimGonderildi?: boolean;
};

type MuezzinData = {
  notificationSettings?: { mazeretDurumu?: boolean };
  fcmTokens?: Record<string, unknown>;
  fcmToken?: string | null;
};

const TIP_ETIKETI: Record<IzinData['tip'], string> = {
  haftalik: 'Haftalık izin',
  yillik: 'Yıllık izin',
  mazeret: 'Mazeret'
};

/**
 * `izinler` koleksiyonunda `bildirimGonderildi: false` olan (henüz push
 * bildirimi gönderilmemiş) her karara varılmış talep için, talebi
 * gönderen kişiye — `notificationSettings.mazeretDurumu !== false` ise —
 * FCM push gönderir.
 *
 * `izinGuncelle` karar anında (`onaylandi`/`reddedildi`) bu bayrağı
 * `false` yazar, `izinGeriAl` kararı geri alırken siler (bkz.
 * useAdminIzinlerStore.ts) — bu sorgu tek bir eşitlik filtresi (`== false`)
 * olduğundan, işlenen her karar anında `true`'ya çevrildiğinden bu küme
 * her zaman küçük/geçici kalır (bkz. Firebase/GitHub veri akışı
 * optimizasyonu — mazeretDevirleriniIsle.ts'teki AYNI prensip, kaynağında
 * baştan sınırlı bir bayrakla).
 */
export async function processIzinDurumBildirimleri(dryRun = false): Promise<{ kararSayisi: number; mesajSayisi: number }> {
  console.log(`İzin durumu bildirimleri gönderiliyor${dryRun ? ' (dry-run)' : ''}...`);

  const izinSnap = await db.collection('izinler')
    .where('bildirimGonderildi', '==', false)
    .get();

  if (izinSnap.empty) {
    console.log('Bildirilecek yeni izin kararı yok.');
    return { kararSayisi: 0, mesajSayisi: 0 };
  }

  const tumMesajlar: FcmMessage[] = [];
  const tokenToUidMap: Record<string, string> = {};
  const markBatch = db.batch();
  let kararSayisi = 0;
  let mesajSayisi = 0;

  for (const docSnap of izinSnap.docs) {
    const izin = docSnap.data() as IzinData;

    // Yalnızca kararı verilmiş talepler ilgilenir — `bildirimGonderildi`
    // yalnızca izinGuncelle'de (durum değişimiyle AYNI transaction'da)
    // false yazıldığından bu dal normalde hiç tetiklenmez; yine de taze
    // veriyle yeniden doğrulanır (bkz. mazeretDevirleriniIsle.ts'teki AYNI
    // savunma derinliği ilkesi).
    if (izin.durum !== 'onaylandi' && izin.durum !== 'reddedildi') {
      if (!dryRun) markBatch.update(docSnap.ref, { bildirimGonderildi: true });
      continue;
    }
    kararSayisi++;

    const muezzinSnap = await db.collection('muezzins').doc(izin.uid).get();
    const muezzin = muezzinSnap.exists ? (muezzinSnap.data() as MuezzinData) : null;

    if (!dryRun) markBatch.update(docSnap.ref, { bildirimGonderildi: true });

    if (!muezzin || muezzin.notificationSettings?.mazeretDurumu === false) continue;
    const tokens = kullaniciFcmTokenleriniTopla(muezzin);
    if (tokens.length === 0) continue;

    const tipEtiketi = TIP_ETIKETI[izin.tip];
    const title = izin.durum === 'onaylandi' ? 'İzin Talebiniz Onaylandı ✅' : 'İzin Talebiniz Reddedildi';
    const body = izin.durum === 'onaylandi'
      ? `${tipEtiketi} talebiniz (${izin.baslangic} - ${izin.bitis}) onaylandı.`
      : `${tipEtiketi} talebiniz (${izin.baslangic} - ${izin.bitis}) reddedildi.${izin.redSebebi ? ` Gerekçe: ${izin.redSebebi}` : ''}`;

    tokens.forEach((token) => {
      tokenToUidMap[token] = izin.uid;
      tumMesajlar.push({
        token,
        notification: { title, body },
        data: { type: 'izin_durumu', izinId: docSnap.id, durum: izin.durum }
      });
    });
    mesajSayisi += tokens.length;
  }

  console.log(`${kararSayisi} yeni izin kararı, ${mesajSayisi} alıcı cihaza gönderilecek.`);

  if (dryRun) {
    console.log(`Tamamlandi (dry-run). kararSayisi=${kararSayisi}, mesajSayisi=${mesajSayisi}`);
    return { kararSayisi, mesajSayisi };
  }

  await fcmGonderVeTemizle(tumMesajlar, tokenToUidMap, 'FCM izin durumu bildirimi');
  await markBatch.commit();
  console.log(`Tamamlandi. kararSayisi=${kararSayisi}`);
  return { kararSayisi, mesajSayisi };
}

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  const isDryRun = process.argv.includes('--dry-run');
  processIzinDurumBildirimleri(isDryRun).catch((err) => {
    console.error('İzin durumu bildirimleri gönderilemedi:', err);
    process.exit(1);
  });
}
