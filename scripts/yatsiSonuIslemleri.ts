import admin from 'firebase-admin';
import { db, Timestamp, auth } from './lib/firebaseAdminInit.ts';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: 'SERVICE_ACCOUNT' // Admin SDK doesn't have a current user in the same way
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
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

  const bugün = new Date().toISOString().split('T')[0];

  // ADIM 1: "Okudum" kontrolü
  let bildirimler;
  try {
    bildirimler = await db.collection('bildirimler')
      .where('tarih', '==', bugün)
      .where('pendingAck', '==', true)
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
      // Asil kişi mazeret bildirmemişse görevi yapmış sayılır
      batch.update(doc.ref, { durum: 'okundu_varsayilan', pendingAck: false, sonGuncelleme: Timestamp.now() });
      asilKredi[data.uid] = (asilKredi[data.uid] || 0) + 1;
    } else if (data.tip === 'gorev_cagrisi') {
      // Görev yedeğe devredilmiş ama yedek onaylamamış!
      batch.update(doc.ref, { durum: 'okundu_varsayilan', pendingAck: false, sonGuncelleme: Timestamp.now() });
      uyariUids.push(data.uid);
    } else if (data.tip === 'yedek') {
      // Yedek kişi sadece yedekti, yapması gereken bir şey yoktu.
      batch.update(doc.ref, { durum: 'okundu_varsayilan', pendingAck: false, sonGuncelleme: Timestamp.now() });
    }
  });

  // Asil kişilere puanlarını ver
  if (Object.keys(asilKredi).length > 0) {
    const muezzinlerDocs = await db.collection('muezzins').get();
    muezzinlerDocs.docs.forEach(mDoc => {
      if (asilKredi[mDoc.id]) {
        batch.update(mDoc.ref, { 
          aylikVakitSayisi: mDoc.data().aylikVakitSayisi + asilKredi[mDoc.id] 
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
    const yarınTarih = new Date();
    yarınTarih.setDate(yarınTarih.getDate() + 1);
    const yarınStr = yarınTarih.toISOString().split('T')[0];

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
      for (const uid of uidList) {
        const userProfile = muezzinMap[uid];
        const token = userProfile?.fcmToken;
        
        if (token && token.trim().length > 0 && userProfile?.aktif === true) {
          const dutyListStr = userDuties[uid].join(', ');
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

      if (messages.length > 0) {
        console.log(`Yarın için ${messages.length} müezzine günlük hatırlatma bildirimleri gönderiliyor...`);
        const response = await admin.messaging().sendEach(messages);
        console.log(`Günlük FCM Gönderim Tamamlandı. Başarılı: ${response.successCount}, Başarısız: ${response.failureCount}`);
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
  const yarın = new Date();
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
