import { db, Timestamp } from './lib/firebaseAdminInit.ts';
import { aylikVakitleriCek } from './lib/ezanFetch.ts';

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
      userId: 'SERVICE_ACCOUNT'
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function main() {
  const simdi = getTurkeyNow();
  
  try {
    // API her zaman yaklaşık 30-32 günlük veri döner (mevcut günden itibaren)
    const vakitData = await aylikVakitleriCek(simdi.getFullYear(), simdi.getMonth() + 1);
    
    // Verileri aylara göre grupla
    const aylar: Record<string, any> = {};
    
    Object.entries(vakitData.gunler).forEach(([tarih, vakitler]) => {
      const [y, m] = tarih.split('-');
      const ayId = `${y}-${m}`;
      if (!aylar[ayId]) {
        aylar[ayId] = {
          ceyhanId: vakitData.ceyhanId,
          kaynakApi: vakitData.kaynakApi,
          gunler: {}
        };
      }
      aylar[ayId].gunler[tarih] = vakitler;
    });

    // Gruplanmış verileri Firestore'a yaz
    for (const [ayId, data] of Object.entries(aylar)) {
      await db.collection('vakitler').doc(ayId).set({
        ...data,
        guncellenmeTarihi: Timestamp.now()
      }, { merge: true });
      console.log(`Başarılı: ${ayId} (${Object.keys(data.gunler).length} gün güncellendi)`);
    }
    
  } catch (err: any) {
    if (err.message.includes('permission') || err.message.includes('NOT_FOUND') || err.message.includes('code: 5') || err.message.includes('code: 7')) {
       handleFirestoreError(err, OperationType.WRITE, `vakitler`);
    }
    
    console.error(`Hata:`, err.message);
    await db.collection('adminUyarilari').add({
      tip: 'apiHatasi',
      mesaj: `Vakit güncelleme hatası: ${err.message}`,
      cozuldu: false,
      olusturmaTarihi: Timestamp.now()
    });
    process.exitCode = 1;
  }
}

function getTurkeyNow(): Date {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 3));
}

main().catch(err => {
  console.error("Kritik hata:", err);
  process.exit(1);
});
