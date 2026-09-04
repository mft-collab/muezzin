import { db, Timestamp } from './lib/firebaseAdminInit.ts';
import { toTurkishUpperCase, getTurkeyDateString, getTurkeyNow } from '../src/lib/dateUtils.ts';

type BildirimData = {
  haftaId: string;
  tarih: string;
  vakit: string;
  uid: string;
  tip: 'asil' | 'yedek' | 'gorev_cagrisi';
  durum: string;
  cumaMi?: boolean;
  vekaletDevredildi?: boolean;
  vekaletDevriBekliyor?: boolean;
  vekaletPlanSenkronEdildi?: boolean;
};

type VekaletTalebiData = {
  bildirimId: string;
  haftaId: string;
  gonderenUid: string;
  gonderenIsim: string;
  aliciUid: string;
  aliciIsim: string;
  tarih: string;
  vakit: string;
  tip: 'asil' | 'yedek' | 'gorev_cagrisi';
  durum: 'beklemede' | 'kabul_edildi' | 'reddedildi';
  bildirimUygulandi?: boolean;
  /** `bildirimUygulandi` yalnızca "script bu talebi işledi mi" bilgisini
   * taşır, SONUCUNU değil — istemci tarafı (useBekleyenVekaletDevirleri,
   * "DEVİR İŞLENİYOR" banner'ı) hem başarı hem red durumunda bu alanı aynı
   * `true` değeriyle görüyordu, ikisini ayırt edemiyordu (bkz. mimari
   * denetim). */
  talepSonuc?: 'uygulandi' | 'reddedildi';
};

type MuezzinData = {
  role?: string;
  aktif?: boolean;
  onayBekliyor?: boolean;
  haftalikIzinGunu?: number;
};

/**
 * NOT ("1000 ifade tavanı" kök neden çözümü — bkz. firestore.rules
 * `isVekaletDevriBekliyorIsareti` yorumu): bu iş eskiden yalnızca
 * `haftaPlanlari` önbelleğini senkronize ediyordu — GERÇEK sahiplik
 * transferini (bildirimler.uid flip'i) `src/services/vekaletServisi.ts`'teki
 * `vekaletKabulEt` anlık olarak, security rules'ta ~45 terimlik bir
 * çapraz-belge doğrulamasıyla yapıyordu. O doğrulama emülatörün "istek
 * başına 1000 ifade" bütçesine (en basit yazımda bile) çarpıyordu; kök
 * neden kuralın DERLENMİŞ toplam karmaşıklığıydı, çalışma-zamanı sıralama/
 * get() paylaşımıyla düzelmiyordu (ölçüldü). Çözüm: istemci artık yalnızca
 * `vekalet_talepleri.durum='kabul_edildi'` + bildirimde dar bir
 * `vekaletDevriBekliyor:true` bayrağı yazıyor; GERÇEK transfer — talep
 * korelasyonu + atanabilirlik (role/aktif/onayBekliyor) + Cuma + sabit
 * haftalık izin-günü kontrolleri dahil, hepsi TAZE veriyle yeniden
 * doğrulanarak — burada, Admin SDK ile (kural bütçesi yok) gerçekleşiyor.
 *
 * İşlenen talep `bildirimUygulandi: true` ile işaretlenir (idempotent).
 * Transfer uygunluk kontrolünü GEÇEMEZSE (ör. alıcı bu ~10-15 dk'lık
 * pencerede arşivlendi/rolü değişti/izin gününe denk geldi), önceki sahip
 * korunur ve bir admin uyarısı oluşturulur — kabul anında senkron
 * doğrulanan bu durumun artık asenkron bir başarısızlık modu olması,
 * mimarinin kabul edilen yeni maliyeti (bkz. plan dosyası).
 */

/**
 * Belirli bir tarih/vakit için ezan saatini `vakitler` koleksiyonundan okur —
 * src/services/mazeretServisi.ts'teki `getEzanVakti` ile AYNI mantık, Admin
 * SDK bağlamına taşınmış (bkz. scripts/vakitVeriSagligiKontrol.ts'teki AYNI
 * ilceId/vakitler okuma deseni).
 */
async function ezanSaatiniGetir(tarih: string, vakit: string): Promise<Date | null> {
  const settingsDoc = await db.collection('settings').doc('system').get();
  const ilceId = (settingsDoc.data()?.ilceId as string) || '9148';
  const ay = tarih.slice(0, 7);
  const vakitDoc = await db.collection('vakitler').doc(`${ilceId}_${ay}`).get();
  if (!vakitDoc.exists) return null;
  const saat = vakitDoc.data()?.gunler?.[tarih]?.[vakit];
  if (typeof saat !== 'string' || !/^\d{2}:\d{2}$/.test(saat)) return null;
  const [sy, sm, sd] = tarih.split('-').map(Number);
  const [hh, mm] = saat.split(':').map(Number);
  // `new Date(sy, sm-1, sd, hh, mm)` saati ÇALIŞTIĞI MAKİNENİN yerel saat
  // diliminde yorumlar — bu script'i tetikleyen GitHub Actions runner'ı UTC
  // çalışır, Türkiye ise sabit UTC+3'tür. Böyle kurulan bir Date, "13:00"
  // ezanını "13:00 UTC" (=16:00 TRT) sanıp gerçek ezandan 3 SAAT SONRA
  // "geçti" sayıyordu — bu pencerede istemci baypasıyla açılan bir talep
  // devredilebiliyordu (premium hata analizi MV-O1/O2 — buradaki asıl
  // bulgu). Türkiye DST uygulamadığından (sabit UTC+3), doğru UTC anı
  // runner'ın yerel saat diliminden BAĞIMSIZ, doğrudan hesaplanabilir.
  return new Date(Date.UTC(sy!, sm! - 1, sd!, hh! - 3, mm!));
}

/**
 * `src/lib/mazeretKurallari.ts`'teki "ezandan 1 saat kala kapanır" penceresi
 * yalnızca istemci tarafında (vekaletServisi.ts `vekaletTeklifEt`/
 * `vekaletKabulEt`, kabul ANINDA) kontrol ediliyordu — firestore.rules bu
 * süre kısıtlamasını hiç doğrulamıyor (yalnızca Cuma kısıtlaması `cumaMi`
 * alanıyla sunucu tarafında da korunuyor). Kabul ile bu script'in GERÇEK
 * transferi uyguladığı an arasında ~10-15 dakikalık bir gecikme var; bu
 * pencerede ezan vakti geçmiş olabilir (bkz. kod denetimi, kritik bulgu).
 * Devam eden bir görevi zaten geçmiş bir vakit için devretmek anlamsız
 * olduğundan, script kendi çalıştığı anda ezan vaktinin geçip geçmediğini
 * TAZE veriyle ayrıca kontrol eder. Veri yoksa (henüz önbelleğe alınmamış
 * ay) mevcut davranışla tutarlı olarak kısıtlama uygulanmaz.
 *
 * SABAH VAKTİ ARTIK HARİÇ TUTULMUYOR (bkz. "bilinçli olarak dışarıda
 * bırakılanlar" — premium hata analizi düzeltmesi): önceki sürüm burada
 * `mazeretKurallari.ts`'teki "yatsı+1sa" MAZERET BİLDİRME SÜRESİ kuralının
 * bir eşdeğerini aramaya çalışıp bulamayınca sabahı tamamen atlıyordu —
 * ama bu fonksiyonun sorduğu soru o değil, çok daha basit: "bu vaktin
 * ezanı ZATEN GEÇTİ Mİ" (devam eden bir görevi geçmiş bir vakit için
 * devretmek anlamsız). Bu soru sabah için de diğer vakitlerle BİREBİR AYNI
 * yolla (o vaktin kendi `ezanSaatiniGetir` sonucu) cevaplanabilir — 'sabah'
 * da `vakitler` belgesindeki `gunler[tarih]` haritasında sıradan bir alan.
 */
async function ezanVaktiGecmisMi(tarih: string, vakit: string): Promise<boolean> {
  const ezanSaati = await ezanSaatiniGetir(tarih, vakit);
  if (!ezanSaati) return false;
  return Date.now() >= ezanSaati.getTime();
}

/**
 * Aynı tarih/vakit için ÇÖZÜLMEMİŞ bir admin uyarısı var mı — sorgunun
 * KENDİSİNİ döner (çalıştırmaz) ki çağıran onu bir transaction içinde
 * (`transaction.get`) okuyabilsin. Alarm yazımı ile talebi "işlendi" olarak
 * işaretleyen bayrak yazımı AYNI transaction'da yapılmalı: eskiden alarm,
 * transaction COMMIT EDİLDİKTEN SONRA ayrı bir `add()` ile yazılıyordu ve
 * süreç (GitHub Actions runner zaman aşımı/iptali) tam bu iki yazım arasında
 * ölürse, bir sonraki çalıştırmanın `bildirimUygulandi !== true` filtresi bu
 * talebi artık hiç görmediğinden alarm SONSUZA DEK kaybediliyordu — başarısız
 * devirden kimsenin haberi olmuyordu (bkz. kod denetimi). Aynı atomiklik
 * garantisi scripts/mazeretDevirleriniIsle.ts'te `alarmOlustur`'un tek
 * batch'iyle sağlanıyor.
 *
 * NOT: filtre `tip`e göre daraltılmadı — bugün `vakit` alanı NULL OLMAYAN her
 * admin uyarısı zaten `tip: 'zincirTukendi'` (mazeretDevirleriniIsle.ts,
 * mazeretServisi.ts, bu dosya); gün-geneli uyarılar (`planOlusturulamadi`,
 * yatsiSonuIslemleri.ts) `vakit: null` yazdığından bu sorguya hiç
 * takılmıyor. `tip` eklemek davranışı değiştirmeden yeni bir bileşik indeks
 * gerektirirdi.
 */
function cozulmemisAlarmSorgusu(tarih: string, vakit: string) {
  return db.collection('adminUyarilari')
    .where('tarih', '==', tarih)
    .where('vakit', '==', vakit)
    .where('cozuldu', '==', false)
    .limit(1);
}

// haftalikIzinGunu ile AYNI ölçekte (Pazartesi=1 ... Pazar=7) haftanın
// gününü döner — src/lib/dateUtils.ts `kisiGunIcinMusaitMi` ve
// firestore.rules `haftaGunuNumarasi` ile AYNI formül (bkz. o dosyalardaki
// yorumlar); üç yerde de senkron tutulmalı.
function haftaGunuNumarasi(tarihStr: string): number {
  const [y, m, d] = tarihStr.split('-').map(Number);
  const gunTarihi = new Date(y!, m! - 1, d!);
  return ((gunTarihi.getDay() + 6) % 7) + 1;
}

export async function processVekaletDevirleri(dryRun = false) {
  console.log(`Vekalet devirleri uzlaştırılıyor${dryRun ? ' (dry-run)' : ''}...`);

  // `tarih >= otuzGunOnce` sınırı: bu iş her 10 dakikada bir çalışıyor;
  // aşağıdaki iki sorgu öncesinde `durum`/`vekaletDevredildi` filtresi TEK
  // BAŞINA koleksiyondaki her kabul edilmiş/devredilmiş talebi — zaten
  // işlenmiş (bildirimUygulandi/vekaletPlanSenkronEdildi: true) olanlar
  // dahil — sınırsızca çekiyordu; koleksiyonlar yıllar içinde büyüdükçe her
  // çalıştırma neredeyse tamamı gereksiz okuma yapıyordu (bkz. Firebase/
  // GitHub veri akışı denetimi). 30 günlük pencere `temizleGunlukler.ts`'teki
  // RETENTION_DAYS ile aynı — bu işten daha eski bir görev tarihi zaten
  // geçmişte kalmıştır, yeniden uzlaştırılacak bir şey kalmaz.
  const otuzGunOnce = getTurkeyDateString(new Date(getTurkeyNow().getTime() - 30 * 24 * 60 * 60 * 1000));

  const talepSnap = await db.collection('vekalet_talepleri')
    .where('durum', '==', 'kabul_edildi')
    .where('tarih', '>=', otuzGunOnce)
    .get();

  const islenecekler = talepSnap.docs.filter((docSnap) => {
    const data = docSnap.data() as VekaletTalebiData;
    return data.bildirimUygulandi !== true;
  });

  let transferUygulandi = 0;
  let transferReddedildi = 0;
  let planSenkronlandi = 0;

  for (const talepDoc of islenecekler) {
    const talep = talepDoc.data() as VekaletTalebiData;

    if (dryRun) {
      console.log(`${talep.tarih} ${talep.vakit}: vekalet transferi uygulanacak (${talep.gonderenUid} -> ${talep.aliciUid}).`);
      transferUygulandi++;
      continue;
    }

    const bildirimRef = db.collection('bildirimler').doc(talep.bildirimId);
    let sonuc: 'uygulandi' | 'reddedildi' | 'zatenUygulanmis' | 'atlandi' = 'atlandi';

    // Transaction dışında okunur — vakit verisi transaction'ın kilitlediği
    // varlıklardan bağımsız, harici/nadiren değişen bir veri kaynağı.
    const ezanGecmisMi = await ezanVaktiGecmisMi(talep.tarih, talep.vakit);

    await db.runTransaction(async (transaction) => {
      const freshTalep = await transaction.get(talepDoc.ref);
      if (!freshTalep.exists) return;
      const freshTalepData = freshTalep.data() as VekaletTalebiData;
      if (freshTalepData.bildirimUygulandi === true) return;

      const freshBildirim = await transaction.get(bildirimRef);
      if (!freshBildirim.exists) {
        transaction.update(talepDoc.ref, { bildirimUygulandi: true, sonGuncelleme: Timestamp.now() });
        return;
      }
      const bildirim = freshBildirim.data() as BildirimData;

      // Devreye alma penceresi güvenliği: rules+istemci deploy'u ile bu
      // script'in (cron, git push ile ayrı ayrı devreye giriyor) devreye
      // alma zamanları TAM aynı anda olmayabilir. Eski istemci (henüz eski
      // kurallar canlıyken) transferi zaten DOĞRUDAN tamamlamış olabilir —
      // bu durumda `bildirim.uid` zaten `talep.aliciUid`'dir. Bunu "transfer
      // başarısız" sanıp yanlış admin uyarısı üretmek yerine "zaten
      // uygulanmış" say (idempotent no-op).
      if (bildirim.uid === talep.aliciUid) {
        transaction.update(talepDoc.ref, { bildirimUygulandi: true, talepSonuc: 'uygulandi', sonGuncelleme: Timestamp.now() });
        sonuc = 'zatenUygulanmis';
        return;
      }

      const aliciRef = db.collection('muezzins').doc(talep.aliciUid);
      const aliciSnap = await transaction.get(aliciRef);
      const alici = aliciSnap.exists ? (aliciSnap.data() as MuezzinData) : null;

      // Kabul anında CEL'de doğrulanan TÜM iş kuralları — burada taze
      // veriyle yeniden doğrulanıyor (istemcinin/eski talebin verisine
      // GÜVENİLMİYOR):
      const atanabilir = !!alici &&
        alici.role === 'muezzin' &&
        alici.aktif === true &&
        alici.onayBekliyor !== true;
      const izinGunuCakisiyor = ['asil', 'yedek'].includes(bildirim.tip) &&
        alici?.haftalikIzinGunu === haftaGunuNumarasi(bildirim.tarih);
      // Cuma kontrolü TAZE `bildirim.tarih`'ten hesaplanır — saklı `cumaMi`
      // bayrağı DEĞİL. Bu alan eksikse (backfill çalıştırılmamış eski
      // belgeler, ya da ileride bir yazım yolunun alanı unutması) eski
      // `bildirim.cumaMi !== true` kontrolü fail-open davranırdı: script
      // gerçek transferi UYGULARDI. firestore.rules aynı kök nedeni
      // `isSelfBildirimUpdate`'te `tarih`ten hesaplayarak çözmüştü — bu tek
      // satır o düzeltmeden nasibini almamıştı (premium hata analizi MV-O1,
      // bu script'in kendi "istemcinin verisine GÜVENİLMİYOR" ilkesiyle de
      // tutarsızdı, bkz. yukarıdaki izinGunuCakisiyor'un taze hesaplanması).
      const uygun =
        bildirim.durum === 'bekliyor' &&
        bildirim.uid === talep.gonderenUid &&
        haftaGunuNumarasi(bildirim.tarih) !== 5 &&
        atanabilir &&
        !izinGunuCakisiyor &&
        !ezanGecmisMi;

      if (!uygun) {
        // Alarm dedup okuması, bu daldaki İLK yazımdan ÖNCE yapılmalı
        // (Firestore transaction'larında tüm okumalar yazımlardan önce
        // gelir) — bu yola gelene kadar hiçbir yazım yapılmamış olur.
        const alarmSnap = await transaction.get(cozulmemisAlarmSorgusu(talep.tarih, talep.vakit));

        // vekaletDevriBekliyor temizlenir — transfer kalıcı olarak
        // başarısız olduğundan bu bayrağın planServisi.ts `korumaliSlotMu`
        // içindeki koruması artık gerekmiyor; önceki sahip normal bir
        // 'bekliyor' slotu olarak kalmaya devam eder.
        transaction.update(bildirimRef, { vekaletDevriBekliyor: false, sonGuncelleme: Timestamp.now() });
        // `durum` da 'reddedildi'ye çekilir. Talep ID'si deterministik
        // (haftaId_tarih_vakit_tip_aliciUid) olduğundan, `durum`
        // 'kabul_edildi'de bırakılırsa gönderen o (görev, alıcı) çifti için
        // bir daha ASLA teklif gönderemiyordu: firestore.rules'un delete
        // kuralı yalnızca 'beklemede'/'reddedildi' durumundaki bir talebin
        // gönderen tarafından silinmesine izin verdiğinden belge
        // silinemiyor, aynı ID'ye setDoc ise create değil UPDATE sayılıp
        // isValidVekaletCreate/isRecipientVekaletStatusUpdate'in hiçbiriyle
        // eşleşmediği için reddediliyordu — yani talep kalıcı olarak
        // kilitleniyordu (bkz. mimari denetim O7'nin AYNISI, bu kez cron
        // kaynaklı red yolunda). Kuralları gevşetmeye gerek yok: mevcut
        // delete kuralı bu durumu zaten kapsıyor.
        transaction.update(talepDoc.ref, {
          bildirimUygulandi: true,
          talepSonuc: 'reddedildi',
          durum: 'reddedildi',
          sonGuncelleme: Timestamp.now()
        });
        if (alarmSnap.empty) {
          transaction.set(db.collection('adminUyarilari').doc(), {
            tip: 'zincirTukendi',
            mesaj: `${talep.aliciIsim}, kabul ettiği vekalet devrini uygulanma anında artık devralamıyor (arşivlendi/rolü değişti/izin gününe denk geldi/ezan vakti geçti). Admin müdahalesi gerekir.`,
            tarih: talep.tarih,
            vakit: talep.vakit,
            cozuldu: false,
            olusturmaTarihi: Timestamp.now()
          });
        }
        sonuc = 'reddedildi';
        return;
      }

      transaction.update(bildirimRef, {
        uid: talep.aliciUid,
        vekaletDevredildi: true,
        vekaletDevriBekliyor: false,
        sonGuncelleme: Timestamp.now()
      });
      transaction.update(talepDoc.ref, { bildirimUygulandi: true, talepSonuc: 'uygulandi', sonGuncelleme: Timestamp.now() });
      transaction.set(db.collection('audit_logs').doc(), {
        actionType: 'Görev Vekaleti Devri',
        targetName: `${talep.tarih} - ${toTurkishUpperCase(talep.vakit)}`,
        details: `${talep.gonderenIsim} görevi otonom vekalet ile ${talep.aliciIsim} hocaya devretti.`,
        userId: talep.aliciUid,
        userDisplayName: talep.aliciIsim,
        timestamp: Timestamp.now()
      });
      sonuc = 'uygulandi';
    });

    // NOT: `as` ile açık tip ataması kasıtlı — `sonuc`, kapsayan bir async
    // closure içinde yeniden atanan bir `let` olduğundan TypeScript'in
    // kontrol akışı analizi burada değeri yanlışlıkla ilk atamaya
    // daraltıyor (bilinen bir TS closure-narrowing sınırlaması).
    const finalSonuc = sonuc as 'uygulandi' | 'reddedildi' | 'zatenUygulanmis' | 'atlandi';
    if (finalSonuc === 'uygulandi') {
      console.log(`${talep.tarih} ${talep.vakit}: vekalet transferi uygulandı (${talep.gonderenUid} -> ${talep.aliciUid}).`);
      transferUygulandi++;
    } else if (finalSonuc === 'zatenUygulanmis') {
      console.log(`${talep.tarih} ${talep.vakit}: transfer zaten uygulanmış (eski istemci/kural devreye alma penceresi) — yalnızca işaretlendi.`);
    } else if (finalSonuc === 'reddedildi') {
      console.log(`${talep.tarih} ${talep.vakit}: kabul edilmiş vekalet transferi artık uygulanamıyor (alıcı uygunluğu değişti) — talep reddedildi ve admin uyarısı AYNI transaction'da yazıldı.`);
      transferReddedildi++;
    }
  }

  // haftaPlanlari önbelleği: GERÇEKTEN transfer edilmiş (vekaletDevredildi:
  // true) ama henüz senkronize edilmemiş belgeler için — mevcut davranış,
  // artık transferin kendisi de burada uygulandığı için aynı döngüde
  // hemen ardından çalışabilir.
  const devirSnap = await db.collection('bildirimler')
    .where('vekaletDevredildi', '==', true)
    .where('tarih', '>=', otuzGunOnce)
    .get();

  const senkronizeEdilecekler = devirSnap.docs.filter((docSnap) => {
    const data = docSnap.data() as BildirimData;
    return data.vekaletPlanSenkronEdildi !== true;
  });

  for (const devirDoc of senkronizeEdilecekler) {
    const devir = devirDoc.data() as BildirimData;

    console.log(`${devir.tarih} ${devir.vakit} (${devir.tip}): haftaPlanlari senkronize ediliyor (-> ${devir.uid}).`);
    planSenkronlandi++;

    if (dryRun) continue;

    await db.runTransaction(async (transaction) => {
      const freshDevir = await transaction.get(devirDoc.ref);
      if (!freshDevir.exists) return;
      const freshDevirData = freshDevir.data() as BildirimData;
      if (freshDevirData.vekaletPlanSenkronEdildi === true) return;

      const planRef = db.collection('haftaPlanlari').doc(devir.haftaId);
      const planSnap = await transaction.get(planRef);
      if (!planSnap.exists) {
        // Plan belgesi (henüz) yoksa senkronize edilecek bir şey yok — yine
        // de işaretle ki bu iş sonsuza kadar aynı belgeyi denemesin.
        transaction.update(devirDoc.ref, { vekaletPlanSenkronEdildi: true, sonGuncelleme: Timestamp.now() });
        return;
      }

      transaction.update(planRef, {
        [`gunler.${devir.tarih}.${devir.vakit}.${devir.tip}`]: freshDevirData.uid
      });
      transaction.update(devirDoc.ref, {
        vekaletPlanSenkronEdildi: true,
        sonGuncelleme: Timestamp.now()
      });
    });
  }

  console.log(`Tamamlandi. transferUygulandi=${transferUygulandi}, transferReddedildi=${transferReddedildi}, planSenkronlandi=${planSenkronlandi}`);
}

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  const isDryRun = process.argv.includes('--dry-run');
  processVekaletDevirleri(isDryRun).catch((err) => {
    console.error('Vekalet devirleri islenemedi:', err);
    process.exit(1);
  });
}
