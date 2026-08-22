import { db, Timestamp } from './lib/firebaseAdminInit.ts';

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

async function alarmVarMi(tarih: string, vakit: string): Promise<boolean> {
  const alarmSnap = await db.collection('adminUyarilari')
    .where('tarih', '==', tarih)
    .where('vakit', '==', vakit)
    .where('cozuldu', '==', false)
    .limit(1)
    .get();

  return !alarmSnap.empty;
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

  const talepSnap = await db.collection('vekalet_talepleri')
    .where('durum', '==', 'kabul_edildi')
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
      const uygun =
        bildirim.durum === 'bekliyor' &&
        bildirim.uid === talep.gonderenUid &&
        bildirim.cumaMi !== true &&
        atanabilir &&
        !izinGunuCakisiyor;

      if (!uygun) {
        // vekaletDevriBekliyor temizlenir — transfer kalıcı olarak
        // başarısız olduğundan bu bayrağın planServisi.ts `korumaliSlotMu`
        // içindeki koruması artık gerekmiyor; önceki sahip normal bir
        // 'bekliyor' slotu olarak kalmaya devam eder.
        transaction.update(bildirimRef, { vekaletDevriBekliyor: false, sonGuncelleme: Timestamp.now() });
        transaction.update(talepDoc.ref, { bildirimUygulandi: true, talepSonuc: 'reddedildi', sonGuncelleme: Timestamp.now() });
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
        targetName: `${talep.tarih} - ${talep.vakit.toUpperCase()}`,
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
      console.log(`${talep.tarih} ${talep.vakit}: kabul edilmiş vekalet transferi artık uygulanamıyor (alıcı uygunluğu değişti) — admin uyarısı oluşturuluyor.`);
      transferReddedildi++;
      const alarmZatenVar = await alarmVarMi(talep.tarih, talep.vakit);
      if (!alarmZatenVar) {
        await db.collection('adminUyarilari').add({
          tip: 'zincirTukendi',
          mesaj: `${talep.aliciIsim}, kabul ettiği vekalet devrini uygulanma anında artık devralamıyor (arşivlendi/rolü değişti/izin gününe denk geldi). Admin müdahalesi gerekir.`,
          tarih: talep.tarih,
          vakit: talep.vakit,
          cozuldu: false,
          olusturmaTarihi: Timestamp.now()
        });
      }
    }
  }

  // haftaPlanlari önbelleği: GERÇEKTEN transfer edilmiş (vekaletDevredildi:
  // true) ama henüz senkronize edilmemiş belgeler için — mevcut davranış,
  // artık transferin kendisi de burada uygulandığı için aynı döngüde
  // hemen ardından çalışabilir.
  const devirSnap = await db.collection('bildirimler')
    .where('vekaletDevredildi', '==', true)
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
