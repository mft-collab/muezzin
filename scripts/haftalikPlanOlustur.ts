import { getMessaging } from 'firebase-admin/messaging';
import { db, Timestamp, FieldValue } from './lib/firebaseAdminInit.ts';
import { haftalikPlanUret, VAKITLER } from '../src/lib/planlamaCekirdegi.ts';
import { getTurkeyNow } from '../src/lib/dateUtils.ts';
import { handleFirestoreError, OperationType } from './lib/errors.ts';
import { Muezzin, HaftaPlan, Bildirim } from '../src/types';

function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
    .filter(m => m.role === 'muezzin');

  if (muezzinler.length < 2) {
    console.error("Yetersiz müezzin! Planlama yapılamıyor.");
    await db.collection('adminUyarilari').add({
      tip: 'zincirTukendi',
      mesaj: 'Aktif personel sayısı planlama için yetersiz (en az 2 gerekli).',
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
  const onayliIzinler = izinSnapshot.docs.map(doc => doc.data());

  // 3. Dinamik Tarih Hesaplama (Türkiye takvim gününe göre — runner UTC'de çalışır)
  const simdi = getTurkeyNow();
  const bugunDay = simdi.getDay(); 
  // Pazartesiye git (0: Pazar ise -6 gün, 1: Pzt ise 0 gün...)
  const diff = bugunDay === 0 ? -6 : 1 - bugunDay;
  
  const pazartesiTemel = new Date(simdi);
  pazartesiTemel.setDate(simdi.getDate() + diff);
  pazartesiTemel.setHours(0, 0, 0, 0);

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
      continue;
    }

    console.log(`${haftaId} haftası için otomatik plan oluşturuluyor...`);

    const batch = db.batch();

    // Tek, paylaşılan atama çekirdeği (bkz. src/lib/planlamaCekirdegi.ts) —
    // src/services/planServisi.ts'deki istemci "self-healing" akışıyla
    // AYNI kuralları kullanır: onaylı izindeki veya sabit haftalık izin
    // gününde olan personel asla atanmaz.
    const gunPlan = haftalikPlanUret(gunler, muezzinler, onayliIzinler);

    for (const gun of gunler) {
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
            durum: 'bekliyor', pendingAck: true, retSebebi: null, olusturmaTarihi: Timestamp.now(),
            sonGuncelleme: Timestamp.now()
          });
        }

        if (atama.yedek !== 'Sistem') {
          const bYedek = db.collection('bildirimler').doc(`${haftaId}_${gun}_${vakit}_yedek`);
          batch.set(bYedek, {
            haftaId, tarih: gun, vakit, uid: atama.yedek, tip: 'yedek',
            durum: 'bekliyor', pendingAck: true, retSebebi: null, olusturmaTarihi: Timestamp.now(),
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

    await batch.commit();
    console.log(`Başarı: ${haftaId} planı ve bildirimleri oluşturuldu.`);

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
