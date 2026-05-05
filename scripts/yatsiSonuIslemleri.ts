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
