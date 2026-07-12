import { getMessaging } from 'firebase-admin/messaging';
import { db, Timestamp, auth, FieldValue } from './lib/firebaseAdminInit.ts';
import { getTurkeyNow } from '../src/lib/dateUtils.ts';
import { handleFirestoreError, OperationType } from './lib/errors.ts';

function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function main() {
  console.log("Günlük yatsı sonrası işlemleri başladı...");
  
  // Debug info
  try {
    const projId = (db as any)._databaseId?.projectId || 'unknown';
    const dbId = (db as any)._databaseId?.databaseId || 'unknown';
    console.log(`Hedef Proje: ${projId}, Hedef Veritabanı: ${dbId}`);
  } catch (e) {
    console.log("Debug bilgisi alınamadı.");
  }

  // NOT: new Date() KULLANILMIYOR — bu script GitHub Actions üzerinde UTC
  // saatiyle çalışır; cron saati kaydırılırsa (ör. DST/mevsimsel ayar) UTC
  // gece yarısı sınırı ile Türkiye takvim günü uyuşmayabilir. getTurkeyNow()
  // her zaman Türkiye (UTC+3) takvim gününü verir.
  const bugün = formatDateLocal(getTurkeyNow());

  // ADIM 1: "Okudum" kontrolü
  // NOT: pendingAck filtresi KULLANILMIYOR — kendi "Okudum" onayını veren
  // müezzinlerin bildirimi gün içinde zaten durum:'onaylandi', pendingAck:false
  // olarak işaretlenmiş oluyor (bkz. src/services/okudumServisi.ts). Puan
  // hem bu şekilde erkenden onaylanmış görevlere hem de gün sonuna kadar
  // hiç dokunulmamış (varsayılan tamamlanmış sayılan) görevlere veriliyor.
  let bildirimler;
  try {
    bildirimler = await db.collection('bildirimler')
      .where('tarih', '==', bugün)
      .get();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'bildirimler');
    return; // handleFirestoreError throws, but for TS completeness
  }

  const uyariUids: string[] = [];
  const batch = db.batch();

  // Herkesin o günkü yükünü bulalım
  const asilKredi: Record<string, number> = {};

  bildirimler.docs.forEach(doc => {
    const data = doc.data();

    if (data.tip === 'asil') {
      if (data.durum === 'bekliyor') {
        // Asil kişi mazeret bildirmemiş ve kendi de onaylamamış: görevi yapmış sayılır
        batch.update(doc.ref, { durum: 'okundu_varsayilan', pendingAck: false, sonGuncelleme: Timestamp.now() });
        asilKredi[data.uid] = (asilKredi[data.uid] || 0) + 1;
      } else if (data.durum === 'onaylandi') {
        // Kendi "Okudum" onayını gün içinde vermiş
        asilKredi[data.uid] = (asilKredi[data.uid] || 0) + 1;
      }
      // durum === 'reddedildi' (mazeret bildirildi) → kredi yok
    } else if (data.tip === 'gorev_cagrisi') {
      if (data.durum === 'bekliyor') {
        // Görev yedeğe devredilmiş ama yedek onaylamamış!
        batch.update(doc.ref, { durum: 'okundu_varsayilan', pendingAck: false, sonGuncelleme: Timestamp.now() });
        uyariUids.push(data.uid);
      }
    } else if (data.tip === 'yedek') {
      if (data.durum === 'bekliyor') {
        // Yedek kişi sadece yedekti, yapması gereken bir şey yoktu.
        batch.update(doc.ref, { durum: 'okundu_varsayilan', pendingAck: false, sonGuncelleme: Timestamp.now() });
      }
    }
  });

  // Asil kişilere puanlarını ver
  if (Object.keys(asilKredi).length > 0) {
    const muezzinlerDocs = await db.collection('muezzins').get();
    muezzinlerDocs.docs.forEach(mDoc => {
      if (asilKredi[mDoc.id]) {
        batch.update(mDoc.ref, { 
          aylikVakitSayisi: (mDoc.data().aylikVakitSayisi || 0) + asilKredi[mDoc.id] 
        });
      }
    });
  }

  if (uyariUids.length > 0) {
    await db.collection('adminUyarilari').add({
      tip: 'zincirTukendi',
      mesaj: `Görev devredilen yedekler onay vermedi: ${uyariUids.join(', ')}`,
      tarih: bugün,
      cozuldu: false,
      olusturmaTarihi: Timestamp.now()
    });
  }

  // ADIM 2 & 3: Arşivle ve yarını hazırla (Özet mantık)
  console.log("Bugün arşivlendi, yarın için bildirimler tetiklendi.");
  await batch.commit();

  // YENİ: Yarınki Görevliler İçin Kişiselleştirilmiş FCM Anlık Bildirimi Tetikle
  try {
    const yarınTarih = getTurkeyNow();
    yarınTarih.setDate(yarınTarih.getDate() + 1);
    const yarınStr = formatDateLocal(yarınTarih);

    console.log(`Yarınki (${yarınStr}) görevliler taranıyor...`);

    // Yarınki tüm bildirimleri çek
    const yarınkiBildirimler = await db.collection('bildirimler')
      .where('tarih', '==', yarınStr)
      .get();

    const userDuties: Record<string, string[]> = {};
    yarınkiBildirimler.docs.forEach(doc => {
      const data = doc.data();
      const uid = data.uid;
      
      // Türkçe vakit isimleri eşleştirmesi
      const vakitCeviri: Record<string, string> = {
        sabah: 'Sabah',
        ogle: 'Öğle',
        ikindi: 'İkindi',
        aksam: 'Akşam',
        yatsi: 'Yatsı'
      };
      
      const vakitName = vakitCeviri[data.vakit] || data.vakit;
      const roleType = data.tip === 'asil' ? 'Asil' : 'Yedek';
      
      if (!userDuties[uid]) {
        userDuties[uid] = [];
      }
      userDuties[uid].push(`${vakitName} (${roleType})`);
    });

    const uidList = Object.keys(userDuties);
    if (uidList.length > 0) {
      const muezzinsSnap = await db.collection('muezzins').get();
      const muezzinMap: Record<string, any> = {};
      muezzinsSnap.docs.forEach(d => {
        muezzinMap[d.id] = d.data();
      });

      const messages = [];
      const tokenToUidMap: Record<string, string> = {};
      for (const uid of uidList) {
        const userProfile = muezzinMap[uid];
        const remindersEnabled = userProfile?.notificationSettings?.nobetHatirlatici !== false;

        if (userProfile?.aktif === true && remindersEnabled) {
          const tokens: string[] = [];
          if (userProfile.fcmTokens && typeof userProfile.fcmTokens === 'object') {
            Object.keys(userProfile.fcmTokens).forEach(t => {
              if (t.trim().length > 0) tokens.push(t);
            });
          }
          if (tokens.length === 0 && userProfile.fcmToken && userProfile.fcmToken.trim().length > 0) {
            tokens.push(userProfile.fcmToken);
          }

          const dutyListStr = userDuties[uid].join(', ');
          for (const token of tokens) {
            tokenToUidMap[token] = uid;
            messages.push({
              token,
              notification: {
                title: 'Yarınki Ezan Göreviniz var 🕌',
                body: `Yarın ${dutyListStr} göreviniz bulunmaktadır. Detaylar ve teyit için uygulamayı açın.`
              },
              data: {
                type: 'daily_duty_reminder',
                tarih: yarınStr
              }
            });
          }
        }
      }

      if (messages.length > 0) {
        console.log(`Yarın için ${messages.length} müezzine günlük hatırlatma bildirimleri gönderiliyor...`);
        const response = await getMessaging().sendEach(messages);
        console.log(`Günlük FCM Gönderim Tamamlandı. Başarılı: ${response.successCount}, Başarısız: ${response.failureCount}`);
        
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
        console.log('Kayıtlı aktif FCM cihazı bulunamadı, günlük bildirimler gönderilmedi.');
      }
    } else {
      console.log('Yarın için planlanmış herhangi bir nöbet görevi bulunamadı.');
    }
  } catch (fcmErr) {
    console.error('FCM günlük hatırlatma bildirim gönderimi başarısız oldu:', fcmErr);
  }

  // ADIM 4: Aylık skor (örnek)
  const yarın = getTurkeyNow();
  yarın.setDate(yarın.getDate() + 1);
  if (yarın.getDate() === 1) {
    const muezzins = await db.collection('muezzins').get();
    const resetBatch = db.batch();
    muezzins.docs.forEach(doc => resetBatch.update(doc.ref, { aylikVakitSayisi: 0 }));
    await resetBatch.commit();
    console.log("Skorlar sıfırlandı.");
  }

  console.log("İşlemler tamam.");
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
