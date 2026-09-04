import { getMessaging } from 'firebase-admin/messaging';
import { db, FieldValue } from './firebaseAdminInit.ts';

export interface FcmMessage {
  token: string;
  notification: { title: string; body: string };
  data: Record<string, string>;
}

/**
 * Bir `muezzins/{uid}` belgesinden gönderilebilir FCM token listesini
 * çıkarır: çok-cihazlı `fcmTokens` haritası varsa o kullanılır, yoksa eski
 * tekil `fcmToken` alanına düşülür. `haftalikPlanOlustur.ts` ve
 * `yatsiSonuIslemleri.ts` bu mantığı bağımsız birer kopya olarak taşıyordu
 * (fcmGonderVeTemizle'nin kendisiyle AYNI kök neden) — buraya çıkarıldı.
 */
export function kullaniciFcmTokenleriniTopla(data: {
  fcmTokens?: Record<string, unknown>;
  fcmToken?: string | null;
}): string[] {
  const tokens: string[] = [];
  if (data.fcmTokens && typeof data.fcmTokens === 'object') {
    Object.keys(data.fcmTokens).forEach(t => {
      if (t.trim().length > 0) tokens.push(t);
    });
  }
  if (tokens.length === 0 && typeof data.fcmToken === 'string' && data.fcmToken.trim().length > 0) {
    tokens.push(data.fcmToken);
  }
  return tokens;
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
  // `sendEach` en fazla 500 mesaj kabul eder — bu limitin üzerinde tek bir
  // çağrı TAMAMEN fırlatır. Bu fonksiyon çağrıldığı script'in yorumundaki
  // "mesaj sayısı her zaman küçük kalır" varsayımı tam da script'in bir
  // süre çalışmadığı (o yüzden birikmiş) durumda bozuluyordu — 500'ü aşan
  // tek bir koşu her seferinde aynı hatayla ölüp hiçbir bildirim bir daha
  // hiç gönderilemiyordu (premium hata analizi FR-O5). 500'lük parçalar
  // halinde gönderilir; bir parçanın başarısızlığı diğerlerini engellemez.
  const SEND_CHUNK_SIZE = 500;
  let successCount = 0;
  let failureCount = 0;
  const tokensToRemove: Record<string, string[]> = {};

  for (let i = 0; i < messages.length; i += SEND_CHUNK_SIZE) {
    const parca = messages.slice(i, i + SEND_CHUNK_SIZE);
    const response = await getMessaging().sendEach(parca);
    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((res, index) => {
      if (!res.success) {
        const errCode = res.error?.code;
        if (errCode === 'messaging/registration-token-not-registered' || errCode === 'messaging/invalid-registration-token') {
          const failedToken = parca[index]!.token;
          const uid = tokenToUidMap[failedToken];
          if (uid) {
            if (!tokensToRemove[uid]) tokensToRemove[uid] = [];
            tokensToRemove[uid]!.push(failedToken);
          }
        }
      }
    });
  }
  console.log(`${logEtiketi}: gönderim tamamlandı. Başarılı: ${successCount}, Başarısız: ${failureCount}`);

  const uidsToUpdate = Object.keys(tokensToRemove);
  if (uidsToUpdate.length > 0) {
    const cleanupBatch = db.batch();
    for (const uid of uidsToUpdate) {
      const userRef = db.collection('muezzins').doc(uid);
      const updates: Record<string, FieldValue> = {};
      tokensToRemove[uid]!.forEach(t => {
        updates[`fcmTokens.${t}`] = FieldValue.delete();
      });
      cleanupBatch.update(userRef, updates);
    }
    await cleanupBatch.commit();
    console.log(`${logEtiketi}: FCM cleanup — ${uidsToUpdate.length} kullanıcıdan geçersiz tokenlar temizlendi.`);
  }
}
