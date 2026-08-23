import { getMessaging } from 'firebase-admin/messaging';
import { db, FieldValue } from './firebaseAdminInit.ts';

export interface FcmMessage {
  token: string;
  notification: { title: string; body: string };
  data: Record<string, string>;
}

/**
 * Hazırlanmış FCM mesajlarını gönderir; gönderim başarısız olup token artık
 * geçersizse (`messaging/registration-token-not-registered` veya
 * `messaging/invalid-registration-token`) o token'ı ilgili kullanıcının
 * `muezzins/{uid}.fcmTokens` haritasından temizler.
 *
 * `scripts/haftalikPlanOlustur.ts` ve `scripts/yatsiSonuIslemleri.ts` bu
 * gönderim+temizlik iskeletini bağımsız birer kopya olarak taşıyordu (bkz.
 * kod denetimi) — buraya çıkarıldı ki bir düzeltme (ör. yeni bir hata kodu
 * eklenmesi) her iki cron'a da aynı anda yansısın.
 *
 * @param messages       Gönderilecek mesajlar.
 * @param tokenToUidMap  Her token'ın hangi kullanıcıya ait olduğu — geçersiz
 *                       token temizliği bunu kullanır.
 * @param logEtiketi     Konsol loglarında görünecek kısa ayırt edici etiket
 *                       (ör. "Haftalık plan", "Günlük hatırlatma").
 */
export async function fcmGonderVeTemizle(
  messages: FcmMessage[],
  tokenToUidMap: Record<string, string>,
  logEtiketi: string
): Promise<void> {
  if (messages.length === 0) {
    console.log(`${logEtiketi}: kayıtlı aktif FCM cihaz tokenı bulunamadı, bildirim gönderilmedi.`);
    return;
  }

  console.log(`${logEtiketi}: ${messages.length} bildirim gönderiliyor...`);
  const response = await getMessaging().sendEach(messages);
  console.log(`${logEtiketi}: gönderim tamamlandı. Başarılı: ${response.successCount}, Başarısız: ${response.failureCount}`);

  const tokensToRemove: Record<string, string[]> = {};
  response.responses.forEach((res, index) => {
    if (!res.success) {
      const errCode = res.error?.code;
      if (errCode === 'messaging/registration-token-not-registered' || errCode === 'messaging/invalid-registration-token') {
        const failedToken = messages[index]!.token;
        const uid = tokenToUidMap[failedToken];
        if (uid) {
          if (!tokensToRemove[uid]) tokensToRemove[uid] = [];
          tokensToRemove[uid]!.push(failedToken);
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
      tokensToRemove[uid]!.forEach(t => {
        updates[`fcmTokens.${t}`] = FieldValue.delete();
      });
      cleanupBatch.update(userRef, updates);
    }
    await cleanupBatch.commit();
    console.log(`${logEtiketi}: FCM cleanup — ${uidsToUpdate.length} kullanıcıdan geçersiz tokenlar temizlendi.`);
  }
}
