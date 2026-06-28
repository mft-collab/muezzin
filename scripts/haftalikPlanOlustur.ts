import admin from 'firebase-admin';
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
      tarih: formatDateLocal(new Date()),
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

  // 3. Dinamik Tarih Hesaplama
  const simdi = new Date();
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

    const buHaftakiYukler: Record<string, number> = {};
    muezzinler.forEach(m => buHaftakiYukler[m.id] = 0);

    const vakitler = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'];
    const gunPlan: any = {};
    const batch = db.batch();

    let oncekiVakitUidler: string[] = [];

    for (const gun of gunler) {
      gunPlan[gun] = {};
      
      const [gY, gM, gD] = gun.split('-').map(Number);
      const currentGunDate = new Date(gY, gM - 1, gD);
      const isFriday = currentGunDate.getDay() === 5;

      // Bugün izinli olanları filtrele
      const bugunIzinliUidler = onayliIzinler
        .filter(izin => gun >= izin.baslangic && gun <= izin.bitis)
        .map(izin => izin.uid);
      
      const musaitMuezzinler = muezzinler.filter(m => !bugunIzinliUidler.includes(m.id));

      // Eğer o gün kimse müsait değilse (nadiren), tüm aktifleri kullan
      const adaylar = musaitMuezzinler.length >= 2 ? musaitMuezzinler : muezzinler;
      const isFridayOgle = isFriday;
      const sirali = tieBreakerSirala(adaylar, buHaftakiYukler, oncekiVakitUidler, isFridayOgle);
      const asil = sirali[0];
      const yedek = sirali[1];
      buHaftakiYukler[asil.id] = (buHaftakiYukler[asil.id] || 0) + vakitler.length;
      // Bir sonraki gün için dinlenme listesini güncelle
      oncekiVakitUidler = [asil.id, yedek.id];

      for (const vakit of vakitler) {
        gunPlan[gun][vakit] = { asil: asil.id, yedek: yedek.id };

        const bAsil = db.collection('bildirimler').doc();
        batch.set(bAsil, {
          haftaId, tarih: gun, vakit, uid: asil.id, tip: 'asil',
          durum: 'bekliyor', pendingAck: true, olusturmaTarihi: Timestamp.now(),
          sonGuncelleme: Timestamp.now()
        });

        const bYedek = db.collection('bildirimler').doc();
        batch.set(bYedek, {
          haftaId, tarih: gun, vakit, uid: yedek.id, tip: 'yedek',
          durum: 'bekliyor', pendingAck: true, olusturmaTarihi: Timestamp.now(),
          sonGuncelleme: Timestamp.now()
        });
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

        const response = await admin.messaging().sendEach(messages);
        console.log(`FCM Gönderim Tamamlandı. Başarılı: ${response.successCount}, Başarısız: ${response.failureCount}`);
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
