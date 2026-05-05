import { db, Timestamp, FieldValue } from './lib/firebaseAdminInit.ts';
import { tieBreakerSirala } from './lib/tieBreaker.ts';
import { Muezzin, HaftaPlan, Bildirim } from '../src/types';

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
  console.log("Haftalık plan oluşturma başladı...");

  // 1. Girdi okuma
  let muezzinSnapshot;
  try {
    muezzinSnapshot = await db.collection('muezzins')
      .where('aktif', '==', true)
      .where('role', '==', 'muezzin')
      .get();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'muezzins');
    return;
  }
  const muezzinler = muezzinSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Muezzin & { id: string }));

  if (muezzinler.length < 2) {
    console.error("Yetersiz müezzin!");
    // adminUyarilari'na yaz
    await db.collection('adminUyarilari').add({
      tip: 'zincirTukendi',
      mesaj: 'Aktif müezzin sayısı 2\'den az!',
      tarih: new Date().toISOString().split('T')[0],
      cozuldu: false,
      olusturmaTarihi: Timestamp.now()
    });
    process.exit(1);
  }

  // 2. Dinamik Tarih Hesaplama
  const simdi = new Date();
  const bugunDay = simdi.getDay(); // 0: Pazar, 1: Pazartesi...
  const diff = simdi.getDate() - (bugunDay === 0 ? 6 : bugunDay - 1); // Pazartesiye git
  const pazartesiTemel = new Date(simdi.setDate(diff));
  pazartesiTemel.setHours(0, 0, 0, 0);

  // Bu hafta ve gelecek 4 hafta için plan oluştur
  for (let weekOffset = 0; weekOffset < 5; weekOffset++) {
    const pazartesi = new Date(pazartesiTemel);
    pazartesi.setDate(pazartesiTemel.getDate() + (weekOffset * 7));

    const haftaBaslangicStr = pazartesi.toISOString().split('T')[0];
    const haftaId = `W${haftaBaslangicStr}`; // Örn: W2026-04-20
    
    const gunler: string[] = [];
    for(let i=0; i<7; i++) {
      const gun = new Date(pazartesi);
      gun.setDate(pazartesi.getDate() + i);
      gunler.push(gun.toISOString().split('T')[0]);
    }
    const haftaBitisStr = gunler[6];

    const planDoc = await db.collection('haftaPlanlari').doc(haftaId).get();
    if (planDoc.exists) {
      console.log(`Plan (${haftaId}) zaten var, atlandı.`);
      continue;
    }

    console.log(`${haftaId} için plan oluşturuluyor...`);

    // 3. Atama algoritması - buHaftakiYukler takibi
    const buHaftakiYukler: Record<string, number> = {};
    muezzinler.forEach(m => buHaftakiYukler[m.id] = 0);

    const vakitler = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'];
    
    const gunPlan: any = {};
    const batch = db.batch();

    for (const gun of gunler) {
      gunPlan[gun] = {};
      
      const sirali = tieBreakerSirala(muezzinler, buHaftakiYukler);
      
      const asil = sirali[0];
      const yedek = sirali[1];

      buHaftakiYukler[asil.id] += 5;

      for (const vakit of vakitler) {
        gunPlan[gun][vakit] = { asil: asil.id, yedek: yedek.id };

        // Bildirimler
        const bildirimAsilRef = db.collection('bildirimler').doc();
        batch.set(bildirimAsilRef, {
          haftaId, tarih: gun, vakit, uid: asil.id, tip: 'asil',
          durum: 'bekliyor', pendingAck: true, olusturmaTarihi: Timestamp.now(),
          sonGuncelleme: Timestamp.now()
        });

        const bildirimYedekRef = db.collection('bildirimler').doc();
        batch.set(bildirimYedekRef, {
          haftaId, tarih: gun, vakit, uid: yedek.id, tip: 'yedek',
          durum: 'bekliyor', pendingAck: true, olusturmaTarihi: Timestamp.now(),
          sonGuncelleme: Timestamp.now()
        });
      }
    }

    // 4. Yazma
    batch.set(db.collection('haftaPlanlari').doc(haftaId), {
      haftaBaslangic: haftaBaslangicStr,
      haftaBitis: haftaBitisStr,
      durum: 'yayinda',
      olusturmaTarihi: Timestamp.now(),
      gunler: gunPlan
    });

    await batch.commit();
    console.log(`Hafta ${haftaId}: Tüm atamalar ve bildirimler tamamlandı.`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Kritik hata:", err);
  process.exit(1);
});
