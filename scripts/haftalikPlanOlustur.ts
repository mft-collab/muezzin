import { getMessaging } from 'firebase-admin/messaging';
import { db, Timestamp, FieldValue } from './lib/firebaseAdminInit.ts';
import { haftalikPlanUret, tekKisiliGunleriBul, kapsamsizGunleriBul, nobeteAtanabilirMi, OnayliIzin, VAKITLER } from '../src/lib/planlamaCekirdegi.ts';
import { getTurkeyNow, isFriday, getOncekiHafta } from '../src/lib/dateUtils.ts';
import { handleFirestoreError, OperationType } from './lib/errors.ts';
import { Muezzin, HaftaPlan, Bildirim, Vakit, VakitAtama } from '../src/types';

function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Bir haftanın atamalarını müezzinlerin bellek içi aylık yük sayaçlarına
// ekler — kalıcı Firestore güncellemesi yine yalnızca
// scripts/yatsiSonuIslemleri.ts'in günlük işidir, bu yalnızca AYNI script
// çalıştırması içindeki sonraki hafta iterasyonlarının adalet hesabını
// beslemek içindir (bkz. algoritma denetimi).
//
// minTarih verilirse yalnızca o tarihten (dahil) itibaren olan günler
// sayılır: zaten var olup atlanan bir haftanın GEÇMİŞ günleri
// yatsiSonuIslemleri tarafından zaten kalıcı sayaçlara işlenmiş olur, onları
// burada tekrar saymak çifte sayıma yol açar. Bu script'in bu çalıştırmada
// TAZE ürettiği hafta için minTarih verilmez (haftanın tamamı zaten geleceğe
// ait olduğundan çifte sayım riski yoktur).
function gunPlanProjeksiyonuUygula(
  gunler: string[],
  gunPlan: Record<string, Record<Vakit, VakitAtama>>,
  muezzinler: (Muezzin & { id: string })[],
  minTarih?: string
) {
  for (const gun of gunler) {
    if (minTarih && gun < minTarih) continue;
    const veri = gunPlan[gun];
    if (!veri) continue;
    const [gY, gM, gD] = gun.split('-').map(Number);
    const gunCumaMi = isFriday(new Date(gY, gM - 1, gD));
    for (const vakit of VAKITLER) {
      const atama = veri[vakit];
      if (!atama || atama.asil === 'Sistem') continue;
      const kisi = muezzinler.find((m) => m.id === atama.asil);
      if (!kisi) continue;
      kisi.aylikVakitSayisi = (kisi.aylikVakitSayisi || 0) + 1;
      if (gunCumaMi) kisi.aylikCumaSayisi = (kisi.aylikCumaSayisi || 0) + 1;
    }
  }
}

async function main() {
  console.log("Haftalık plan oluşturma başladı...");

  // 1. Personel Çekme (Adminler ve Müezzinler dahil, Gözlemciler hariç)
  let muezzinSnapshot;
  try {
    muezzinSnapshot = await db.collection('muezzins')
      .where('aktif', '==', true)
      .get();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'muezzins');
    return;
  }
  
  // Sadece aktif müezzinleri alalım
  const muezzinler = muezzinSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Muezzin & { id: string }))
    .filter(m => nobeteAtanabilirMi(m));

  // NOT (mimari denetim — bütünsel hata analizi): bu eşik önceden 2 idi,
  // ama src/services/planServisi.ts'teki İSTEMCİ self-healing çağırıcısı
  // aynı çekirdeği (haftalikPlanUret) 1 aktif müezzinle bile çağırıyordu —
  // CLAUDE.md'nin "TEK çekirdek, her iki çağıran AYNI kuralları kullanır"
  // ilkesine aykırı bir davranışsal ayrışmaydı. `haftalikPlanUret`'in
  // kendisi zaten tek-kişilik hafta için tasarlanmış bir dal içeriyor
  // (yedek her zaman 'Sistem') — bu script'in daha katı eşiği, personel
  // sayısı 1'e düştüğünde (istemci sessizce yedeksiz bir plan üretip
  // yayınlayabilirken) gece cron'unun HİÇ plan üretmemesine yol açıyordu.
  if (muezzinler.length < 1) {
    console.error("Yetersiz müezzin! Planlama yapılamıyor.");
    await db.collection('adminUyarilari').add({
      tip: 'zincirTukendi',
      mesaj: 'Aktif personel sayısı planlama için yetersiz (en az 1 gerekli).',
      tarih: formatDateLocal(getTurkeyNow()),
      cozuldu: false,
      olusturmaTarihi: Timestamp.now()
    });
    process.exit(1);
  }

  // 2. Onaylanmış İzinleri Çek
  const izinSnapshot = await db.collection('izinler')
    .where('durum', '==', 'onaylandi')
    .get();
  const onayliIzinler = izinSnapshot.docs.map(doc => doc.data() as OnayliIzin);

  // 3. Dinamik Tarih Hesaplama (Türkiye takvim gününe göre — runner UTC'de çalışır)
  const simdi = getTurkeyNow();
  const bugunDay = simdi.getDay(); 
  // Pazartesiye git (0: Pazar ise -6 gün, 1: Pzt ise 0 gün...)
  const diff = bugunDay === 0 ? -6 : 1 - bugunDay;
  
  const pazartesiTemel = new Date(simdi);
  pazartesiTemel.setDate(simdi.getDate() + diff);
  pazartesiTemel.setHours(0, 0, 0, 0);

  const bugunStr = formatDateLocal(simdi);

  // Gelecek 3 hafta için plan oluşturmayı dene (Daha güvenli bir aralık)
  for (let weekOffset = 0; weekOffset < 3; weekOffset++) {
    const pazartesi = new Date(pazartesiTemel);
    pazartesi.setDate(pazartesiTemel.getDate() + (weekOffset * 7));

    const haftaBaslangicStr = formatDateLocal(pazartesi);
    const haftaId = `W${haftaBaslangicStr}`;
    
    const gunler: string[] = [];
    for(let i=0; i<7; i++) {
      const gun = new Date(pazartesi);
      gun.setDate(pazartesi.getDate() + i);
      gunler.push(formatDateLocal(gun));
    }
    const haftaBitisStr = gunler[6];

    const planDoc = await db.collection('haftaPlanlari').doc(haftaId).get();
    if (planDoc.exists) {
      console.log(`Plan (${haftaId}) zaten mevcut, atlanıyor.`);
      // Bu hafta önceki bir çalıştırmada üretilmiş olabilir — henüz
      // gerçekleşmemiş (bugünden itibaren) günlerini bellek içi adalet
      // hesabına dahil et ki bu çalıştırmada üretilecek sonraki haftalar
      // bu yükten habersiz kalmasın (bkz. algoritma denetimi).
      const mevcutGunPlan = planDoc.data()?.gunler as Record<string, Record<Vakit, VakitAtama>> | undefined;
      if (mevcutGunPlan) {
        gunPlanProjeksiyonuUygula(gunler, mevcutGunPlan, muezzinler, bugunStr);
      }
      continue;
    }

    console.log(`${haftaId} haftası için otomatik plan oluşturuluyor...`);

    const batch = db.batch();

    // Bir önceki haftanın son vaktinin (Pazar yatsı) ekibini oku — hafta
    // sınırında dinlenme kuralının (SOS) sıfırlanmasını önlemek için (bkz.
    // algoritma denetimi). Önceki hafta hiç üretilmemişse (soğuk başlangıç)
    // boş dizi kullanılır, mevcut davranışla aynıdır.
    const { haftaId: oncekiHaftaId, sonGun: oncekiSonGun } = getOncekiHafta(haftaId);
    const oncekiPlanDoc = await db.collection('haftaPlanlari').doc(oncekiHaftaId).get();
    const oncekiHaftaSonEkibi: string[] = [];
    if (oncekiPlanDoc.exists) {
      const sonVakitAtama = oncekiPlanDoc.data()?.gunler?.[oncekiSonGun]?.yatsi;
      if (sonVakitAtama) {
        [sonVakitAtama.asil, sonVakitAtama.yedek].forEach((uid: string) => {
          if (uid && uid !== 'Sistem') oncekiHaftaSonEkibi.push(uid);
        });
      }
    }

    // Tek, paylaşılan atama çekirdeği (bkz. src/lib/planlamaCekirdegi.ts) —
    // src/services/planServisi.ts'deki istemci "self-healing" akışıyla
    // AYNI kuralları kullanır: onaylı izindeki veya sabit haftalık izin
    // gününde olan personel asla atanmaz.
    const gunPlan = haftalikPlanUret(gunler, muezzinler, onayliIzinler, undefined, oncekiHaftaSonEkibi);

    for (const gun of gunler) {
      const [gY, gM, gD] = gun.split('-').map(Number);
      const cumaMi = isFriday(new Date(gY, gM - 1, gD));

      for (const vakit of VAKITLER) {
        const atama = gunPlan[gun][vakit];

        // Bildirim ID'leri kasıtlı olarak deterministiktir (haftaId_tarih_vakit_tip).
        // Bu, mazeret/vekalet akışlarının Firestore güvenlik kurallarında
        // getAfter() ile "asil" ve "yedek" belgelerini çapraz doğrulamasını
        // sağlar (bkz. firestore.rules `isBackupPromotionFromMazeret`).
        if (atama.asil !== 'Sistem') {
          const bAsil = db.collection('bildirimler').doc(`${haftaId}_${gun}_${vakit}_asil`);
          batch.set(bAsil, {
            haftaId, tarih: gun, vakit, uid: atama.asil, tip: 'asil',
            durum: 'bekliyor', pendingAck: true, retSebebi: null, cumaMi, olusturmaTarihi: Timestamp.now(),
            sonGuncelleme: Timestamp.now()
          });
        }

        if (atama.yedek !== 'Sistem') {
          const bYedek = db.collection('bildirimler').doc(`${haftaId}_${gun}_${vakit}_yedek`);
          batch.set(bYedek, {
            haftaId, tarih: gun, vakit, uid: atama.yedek, tip: 'yedek',
            durum: 'bekliyor', pendingAck: true, retSebebi: null, cumaMi, olusturmaTarihi: Timestamp.now(),
            sonGuncelleme: Timestamp.now()
          });
        }
      }
    }

    batch.set(db.collection('haftaPlanlari').doc(haftaId), {
      haftaBaslangic: haftaBaslangicStr,
      haftaBitis: haftaBitisStr,
      durum: 'yayinda',
      olusturmaTarihi: Timestamp.now(),
      gunler: gunPlan
    });

    // Hiç kimsenin müsait olmadığı (tamamen kapsamsız) günler — sistemdeki
    // en ağır durum, önceden hiçbir uyarı üretmiyordu (bkz. mimari denetim O3).
    const kapsamsizGunler = kapsamsizGunleriBul(gunPlan);
    if (kapsamsizGunler.length > 0) {
      console.error(`${haftaId}: HİÇ KİMSENİN müsait olmadığı günler: ${kapsamsizGunler.join(', ')}`);
      batch.set(db.collection('adminUyarilari').doc(), {
        tip: 'planOlusturulamadi',
        mesaj: `${haftaId} haftasında şu günler için HİÇ KİMSE müsait değil (herkes izinli/haftalık izin gününde): ${kapsamsizGunler.join(', ')}. Acilen kadro/izin durumunu kontrol edin.`,
        tarih: kapsamsizGunler[0],
        cozuldu: false,
        olusturmaTarihi: Timestamp.now()
      });
    }

    // Tek kişinin (yedeksiz) kaldığı günler için admin'e görünürlük bırak —
    // önceden bu durum sessizce geçiyordu (bkz. algoritma denetimi).
    const tekKisiliGunler = tekKisiliGunleriBul(gunPlan);
    if (tekKisiliGunler.length > 0) {
      console.warn(`${haftaId}: yedeksiz kalan günler: ${tekKisiliGunler.join(', ')}`);
      batch.set(db.collection('adminUyarilari').doc(), {
        tip: 'zincirTukendi',
        mesaj: `${haftaId} haftasında şu günler yalnızca tek kişiyle (yedeksiz) planlandı: ${tekKisiliGunler.join(', ')}. Kadro müsaitliğini kontrol edin.`,
        tarih: tekKisiliGunler[0],
        cozuldu: false,
        olusturmaTarihi: Timestamp.now()
      });
    }

    await batch.commit();
    console.log(`Başarı: ${haftaId} planı ve bildirimleri oluşturuldu.`);

    // Bu cron çalıştırması aynı anda birden fazla YENİ hafta üretirse (soğuk
    // başlangıç / uzun kesinti sonrası), sonraki hafta iterasyonunun adalet
    // hesabı bu haftanın taze atamalarını görsün diye bellek içi projeksiyon
    // yapılır. Firestore'a yazılmaz — kalıcı güncelleme yine yalnızca
    // scripts/yatsiSonuIslemleri.ts'in günlük işidir (bkz. algoritma denetimi).
    gunPlanProjeksiyonuUygula(gunler, gunPlan, muezzinler);

    try {
      const tokenToUidMap: Record<string, string> = {};
      const fcmTokens: string[] = [];
      muezzinler
        .filter(m => m.notificationSettings?.nobetHatirlatici !== false)
        .forEach(m => {
          const userTokens: string[] = [];
          if (m.fcmTokens && typeof m.fcmTokens === 'object') {
            Object.keys(m.fcmTokens).forEach(t => {
              if (t.trim().length > 0) userTokens.push(t);
            });
          }
          if (userTokens.length === 0 && m.fcmToken && m.fcmToken.trim().length > 0) {
            userTokens.push(m.fcmToken);
          }
          userTokens.forEach(t => {
            tokenToUidMap[t] = m.id;
          });
          fcmTokens.push(...userTokens);
        });

      if (fcmTokens.length > 0) {
        console.log(`FCM anlık bildirimleri ${fcmTokens.length} aktif müezzine gönderiliyor...`);
        const messages = fcmTokens.map(token => ({
          token,
          notification: {
            title: 'Yeni Haftalık Plan Yayınlandı 🗓️',
            body: 'Önümüzdeki haftanın ezan nöbet planı hazırlandı. Görevlerinizi kontrol etmek için dokunun.'
          },
          data: {
            type: 'weekly_plan_published'
          }
        }));

        const response = await getMessaging().sendEach(messages);
        console.log(`FCM Gönderim Tamamlandı. Başarılı: ${response.successCount}, Başarısız: ${response.failureCount}`);

        // Clean up invalid tokens
        const tokensToRemove: Record<string, string[]> = {};
        response.responses.forEach((res, index) => {
          if (!res.success) {
            const errCode = res.error?.code;
            if (errCode === 'messaging/registration-token-not-registered' || errCode === 'messaging/invalid-registration-token') {
              const failedToken = messages[index].token;
              const uid = tokenToUidMap[failedToken];
              if (uid) {
                if (!tokensToRemove[uid]) tokensToRemove[uid] = [];
                tokensToRemove[uid].push(failedToken);
              }
            }
          }
        });

        const uidsToUpdate = Object.keys(tokensToRemove);
        if (uidsToUpdate.length > 0) {
          const cleanupBatch = db.batch();
          for (const uid of uidsToUpdate) {
            const userRef = db.collection('muezzins').doc(uid);
            const updates: Record<string, any> = {};
            tokensToRemove[uid].forEach(t => {
              updates[`fcmTokens.${t}`] = FieldValue.delete();
            });
            cleanupBatch.update(userRef, updates);
          }
          await cleanupBatch.commit();
          console.log(`FCM Cleanup: ${uidsToUpdate.length} kullanıcıdan geçersiz tokenlar temizlendi.`);
        }
      } else {
        console.log('Kayıtlı aktif FCM cihaz tokenı bulunamadı, bildirim gönderilmedi.');
      }
    } catch (fcmErr) {
      console.error('FCM haftalık plan bildirim gönderimi başarısız oldu:', fcmErr);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Kritik hata:", err);
  process.exit(1);
});
