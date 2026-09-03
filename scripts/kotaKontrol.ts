import { db, Timestamp } from './lib/firebaseAdminInit.ts';

/**
 * Günlük Firestore yazma kotası "erken uyarı" kontrolü.
 *
 * ÖNEMLİ — BU BİR TAHMİNDİR, GERÇEK KULLANIM DEĞİLDİR:
 * Firestore'un "bugün kaç okuma/yazma yapıldı" sayacı Spark planda
 * programatik olarak OKUNAMAZ (yalnızca Firebase Console / GCP Billing
 * arayüzünde görünür; Cloud Monitoring API'si Blaze gerektirir ve bu proje
 * bilerek Spark'ta kalıyor). Bu yüzden burada gerçek kota tüketimi değil,
 * ona VEKİL (proxy) olan tek bir gösterge ölçülür: son 24 saatte
 * `error_logs` + `telemetry_logs` koleksiyonlarına düşen belge sayısı.
 *
 * Neden bu iki koleksiyon: uygulamanın diğer tüm yazımları (bildirimler,
 * haftaPlanlari, izinler, vekalet_talepleri...) insan eylemine bağlı ve
 * doğal olarak sınırlı — bir müezzin ekibi günde birkaç yüz yazımdan
 * fazlasını üretemez. Kotayı gerçekten patlatabilecek tek yol, KENDİ
 * KENDİNE tekrar eden bir makine yazımıdır; bu kod tabanında böyle bir
 * risk taşıyan tek yer telemetri/hata günlükleridir (bkz.
 * src/services/telemetryService.ts: logError önceden dedup/rate-limit'siz
 * yazıyordu ve tek bir render döngüsü 20K/gün yazma kotasını tek bir
 * sekmede tüketebiliyordu — premium denetim P0.4'te MAX_ERROR_WRITES_PER_
 * SIGNATURE / MAX_ERROR_WRITES_PER_MINUTE ile sınırlandı).
 *
 * Yani bu script'in amacı "kota %kaç doldu"yu doğru söylemek DEĞİL, o
 * rate-limit'in bir gün sessizce devre dışı kaldığı/bozulduğu bir
 * REGRESYONU, kota tükenip uygulama durmadan önce yakalamaktır. Rapor
 * edilen yüzde bu nedenle her yerde "TAHMİNİ" olarak etiketlenir ve diğer
 * koleksiyonlara yapılan yazımları İÇERMEZ.
 *
 * Tetikleyici: .github/workflows/kota-kontrol.yml (günlük).
 */

/** Spark planının günlük ücretsiz yazma kotası (belge yazımı/gün). */
const GUNLUK_YAZMA_KOTASI = 20000;

/**
 * Uyarı eşiği: son 24 saatte bu iki koleksiyona düşen toplam belge sayısı.
 *
 * 2000, kotanın %10'u — normal kullanımın ~4-10 katı, ama kota tükenmesine
 * hâlâ çok uzak bir nokta. Gerekçe: ekip birkaç on kişilik, telemetri
 * olayları 5'lik gruplar hâlinde (telemetryService BATCH_SIZE) yazılıyor ve
 * hata yazımları dizge genelinde dakikada 5 ile sınırlı. Sağlıklı bir günde
 * beklenen toplam birkaç yüz belgedir; 2000'i aşmak "bir şey döngüye
 * girmiş" demektir. Eşiği düşürmek gürültü (her gün uyarı), yükseltmek ise
 * erken uyarı penceresini kaybetmek anlamına gelir.
 */
const ESIK_BELGE_SAYISI = 2000;

/**
 * Açık (çözülmemiş) bir kota uyarısı ararken taranacak en güncel uyarı
 * sayısı. Doğrudan `tip == 'kotaUyarisi' && cozuldu == false` sorgusu YENİ
 * bir bileşik index (ve bir index deploy'u) gerektirirdi; bunun yerine
 * `useAktifSistemUyarisi`'nin zaten kullandığı mevcut
 * (cozuldu, olusturmaTarihi) index'i üzerinden en güncel N açık uyarı
 * okunup `tip` istemci tarafında elenir. N belge okuma günde bir kez
 * ihmal edilebilir bir maliyettir.
 */
const TARANACAK_ACIK_UYARI_SAYISI = 50;

const UYARI_TIPI = 'kotaUyarisi';

/** Son 24 saatte koleksiyona düşen belge sayısı — `count()` toplaması
 * belgeleri ÇEKMEZ, bu yüzden ölçümün kendisi kotayı kayda değer şekilde
 * tüketmez (bkz. src/services/veriSifirlamaServisi.ts'teki istemci
 * eşdeğeri, getCountFromServer). Her iki koleksiyon da `timestamp` alanını
 * yazar (bkz. firestore.rules isValidErrorLog / isValidTelemetryLog), tek
 * alanlı index otomatik mevcuttur — bileşik index gerekmez. */
async function son24SaatBelgeSayisi(koleksiyon: string, esik: Timestamp): Promise<number> {
  const snap = await db.collection(koleksiyon).where('timestamp', '>=', esik).count().get();
  return snap.data().count;
}

/** Zaten açık bir kota uyarısı varsa her gün yenisini üretmeyelim — admin
 * paneli aynı sorunun kopyalarıyla dolar ve gerçek uyarılar kaybolur (bkz.
 * scripts/mazeretDevirleriniIsle.ts'teki `alarmVarMi` ile aynı gerekçe). */
async function acikKotaUyarisiVarMi(): Promise<boolean> {
  const snap = await db.collection('adminUyarilari')
    .where('cozuldu', '==', false)
    .orderBy('olusturmaTarihi', 'desc')
    .limit(TARANACAK_ACIK_UYARI_SAYISI)
    .get();

  return snap.docs.some((d) => d.data().tip === UYARI_TIPI);
}

async function main() {
  const esik = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);

  const [hataSayisi, telemetriSayisi] = await Promise.all([
    son24SaatBelgeSayisi('error_logs', esik),
    son24SaatBelgeSayisi('telemetry_logs', esik),
  ]);

  const toplam = hataSayisi + telemetriSayisi;
  const yuzde = Math.round((toplam / GUNLUK_YAZMA_KOTASI) * 1000) / 10;

  console.log(
    `Son 24 saat — error_logs: ${hataSayisi}, telemetry_logs: ${telemetriSayisi}, toplam: ${toplam} belge ` +
    `(günlük ${GUNLUK_YAZMA_KOTASI} yazma kotasının TAHMİNİ %${yuzde}'i; eşik: ${ESIK_BELGE_SAYISI}).`
  );

  if (toplam < ESIK_BELGE_SAYISI) {
    console.log('Kota kullanımı normal aralıkta, uyarı üretilmedi.');
    return;
  }

  if (await acikKotaUyarisiVarMi()) {
    console.log('Eşik aşıldı ancak çözülmemiş bir kota uyarısı zaten açık — yenisi üretilmedi.');
    return;
  }

  await db.collection('adminUyarilari').add({
    tip: UYARI_TIPI,
    mesaj:
      `Kota erken uyarısı (TAHMİNİ): son 24 saatte error_logs (${hataSayisi}) + telemetry_logs (${telemetriSayisi}) = ` +
      `${toplam} belge yazıldı; bu, günlük ${GUNLUK_YAZMA_KOTASI} yazma kotasının yaklaşık %${yuzde}'ine denk geliyor ve ` +
      `${ESIK_BELGE_SAYISI} eşiğini aştı. Bu bir TAHMİNDİR, gerçek toplam kullanım (diğer koleksiyonlara yazımlar dahil) ` +
      `daha yüksektir. Olası neden: telemetryService.ts'teki hata yazma sınırının (rate-limit) devre dışı kalması veya ` +
      `bir render döngüsünde tekrarlayan hata. Firebase Console > Kullanım ekranından gerçek kotayı doğrulayın.`,
    cozuldu: false,
    olusturmaTarihi: Timestamp.now(),
  });

  // BİLEREK process.exit(1) YOK: eşik aşımı bir "iş hatası" değil, bir
  // UYARIDIR. Çıkışı 1 yapsaydık workflow'un `if: failure()` adımı ayrıca
  // bir 'otomasyonHatasi' uyarısı daha açar ve admin paneline aynı olay
  // için iki farklı kayıt düşerdi. Gerçek script hataları (Firestore'a
  // ulaşılamaması vb.) aşağıdaki catch'te 1 ile çıkar.
  console.warn(`Eşik aşıldı — admin uyarısı oluşturuldu (${UYARI_TIPI}).`);
}

main().catch((err) => {
  console.error('Kota kontrolü başarısız:', err);
  process.exit(1);
});
