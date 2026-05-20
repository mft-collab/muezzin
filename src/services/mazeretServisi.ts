import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, Timestamp, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Bildirim } from '../types';
import { tieBreakerSirala } from '../utils/tieBreaker';
import { getHaftaIdFromDate } from '../lib/dateUtils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

/**
 * 1. Tetikleyici (Trigger): Veri Zinciri Tükendi
 * 2. Çalışma Koşulları (Logic Gates): Mazeret Girişi (TRUE) VE Yedek Onayı (FALSE/PENDING)
 * 3. İşleyiş: Koşullar sağlanırsa algoritmayı çalıştır ve süreci başlat.
 */
async function dinamikGorevKontrolMekanizmasi(tarih: string, vakit: string, haricUidler: string[]): Promise<void> {
  const path = 'adminUyarilari';
  try {
    // Koşul A: Mazeret Girişi Durumu (TRUE) - haricUidler mazeret bildiren kişiyi içerir
    const mazeretGirisiVar = haricUidler.length > 0;

    // Koşul B: Yedek Görevli Onayı (FALSE / PENDING)
    const yedekSorgu = query(collection(db, 'bildirimler'), 
      where('tarih', '==', tarih), 
      where('vakit', '==', vakit), 
      where('tip', '==', 'gorev_cagrisi')
    );
    const yedekSnap = await getDocs(yedekSorgu);
    const yedekOnayiNegatif = yedekSnap.empty || yedekSnap.docs.some(d => d.data().durum !== 'onaylandi');

    if (mazeretGirisiVar && yedekOnayiNegatif) {
      // Önce aynı tarih/vakit için çözülmemiş alarm var mı kontrol et
      const alarmSorgu = query(collection(db, 'adminUyarilari'), 
        where('tarih', '==', tarih),
        where('vakit', '==', vakit),
        where('cozuldu', '==', false)
      );
      const alarmSnap = await getDocs(alarmSorgu);
      
      if (alarmSnap.empty) {
        // Algoritmayı çalıştır ve süreci başlat (Sistem uyarısı oluştur)
        await addDoc(collection(db, 'adminUyarilari'), {
          tip: 'zincirTukendi',
          mesaj: `Dinamik Görev Mekanizması: Veri zinciri tükendi. Mazeret girişi mevcut ve yedek onayı henüz alınmadı. Manuel müdahale veya alternatif planlama gereklidir.`,
          tarih: tarih,
          vakit: vakit,
          cozuldu: false,
          olusturmaTarihi: Timestamp.now()
        });
      }
    } else {
      // Standart hata protokolü
      const alarmSorgu = query(collection(db, 'adminUyarilari'), 
        where('tarih', '==', tarih),
        where('vakit', '==', vakit),
        where('cozuldu', '==', false)
      );
      const alarmSnap = await getDocs(alarmSorgu);

      if (alarmSnap.empty) {
        await addDoc(collection(db, 'adminUyarilari'), {
          tip: 'zincirTukendi',
          mesaj: `Kritik Hata: Veri zinciri tükendi ve aday bulunamadı.`,
          tarih: tarih,
          vakit: vakit,
          cozuldu: false,
          olusturmaTarihi: Timestamp.now()
        });
      }
    }
  } catch (err) {
    throw handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function mazeretBildir(bildirimId: string, retSebebi: string): Promise<void> {
  const bildirimRef = doc(db, 'bildirimler', bildirimId);
  
  try {
    await runTransaction(db, async (transaction) => {
      const bildirimDoc = await transaction.get(bildirimRef);
      if (!bildirimDoc.exists()) throw new Error('Bildirim bulunamadı');
      
      const bildirim = bildirimDoc.data();
      
      transaction.update(bildirimRef, {
        durum: 'reddedildi',
        retSebebi,
        pendingAck: false
      });
    });

    const b = await getDoc(bildirimRef);
    await kriziBaslat(b.data()!.tarih, b.data()!.vakit, [b.data()!.uid]);
  } catch (err) {
    throw handleFirestoreError(err, OperationType.WRITE, `bildirimler/${bildirimId}`);
  }
}

export async function kriziBaslat(tarih: string, vakit: string, haricUidler: string[]): Promise<boolean> {
  const pathPrefix = 'bildirimler';
  try {
    // 2. Yedek görevliyi bul (Query ile, çünkü ID'ler rastgele)
    const bildirimlerRef = collection(db, 'bildirimler');
    const yedekQuery = query(
      bildirimlerRef, 
      where('tarih', '==', tarih), 
      where('vakit', '==', vakit), 
      where('tip', '==', 'yedek')
    );
    const yedekSnap = await getDocs(yedekQuery);
    const yedekDoc = yedekSnap.docs[0];
    const yedekData = yedekDoc?.data() as Bildirim | undefined;

    if (yedekData && !haricUidler.includes(yedekData.uid) && yedekData.durum !== 'reddedildi') {
      // Yedek müsait, onu Asil yap
      const haftaId = getHaftaIdFromDate(tarih);
      
      await runTransaction(db, async (transaction) => {
        // Yedek bildirimini güncelle
        transaction.update(doc(db, 'bildirimler', yedekDoc.id), {
          tip: 'asil',
          durum: 'bekliyor',
          pendingAck: true,
          sonGuncelleme: Timestamp.now()
        });

        // Haftalık planı güncelle (Sync Back) — SADECE bu vakti güncelle
        const updateObj: Record<string, any> = {
          [`gunler.${tarih}.${vakit}.asil`]: yedekData.uid
        };
        transaction.update(doc(db, 'haftaPlanlari', haftaId), updateObj);
      });
      
      return true;
    }

    // Yedek de reddettiyse veya yoksa yeni aday bul
    const muezzinSnapshot = await getDocs(query(collection(db, 'muezzins'), where('aktif', '==', true), where('role', '==', 'muezzin')));
    const muezzinler = muezzinSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
    
    // İzin kontrolü: O tarihte izinli olanları bul
    const izinSnap = await getDocs(query(collection(db, 'izinler'), 
      where('durum', '==', 'onaylandi'),
      where('baslangic', '<=', tarih)
    ));
    // Not: Firestore range filter kısıtlaması nedeniyle bitiş tarihini JS tarafında kontrol edeceğiz
    const izinliUidler = izinSnap.docs
      .filter(d => tarih <= d.data().bitis)
      .map(d => d.data().uid);

    // Haric tutulanlar ve izinli olanları adaylardan çıkart
    let adaylar = muezzinler.filter(m => !haricUidler.includes(m.id) && !izinliUidler.includes(m.id));
    if (yedekData) {
      adaylar = adaylar.filter(m => m.id !== yedekData.uid);
    }

    const haftaId = getHaftaIdFromDate(tarih);
    const planDoc = await getDoc(doc(db, 'haftaPlanlari', haftaId));
    const buHaftakiYukler: Record<string, number> = {};
    if (planDoc.exists()) {
      const planData = planDoc.data();
      const gunler = planData.gunler || {};
      Object.values(gunler).forEach((vakitlerObj: any) => {
        Object.values(vakitlerObj).forEach((atama: any) => {
          if (atama.asil) {
            buHaftakiYukler[atama.asil] = (buHaftakiYukler[atama.asil] || 0) + 1;
          }
        });
      });
    }

    const siraliAdaylar = tieBreakerSirala(adaylar, buHaftakiYukler);

    // Fetch all rejected notifications for this specific date and time in a single query (Optimization: avoid N+1 query problem)
    const reddedilenSnap = await getDocs(query(
      collection(db, 'bildirimler'),
      where('tarih', '==', tarih),
      where('vakit', '==', vakit),
      where('durum', '==', 'reddedildi')
    ));
    const reddedenUidler = new Set(reddedilenSnap.docs.map(doc => doc.data().uid));

    for (const aday of siraliAdaylar) {
      if (!reddedenUidler.has(aday.id)) {
        // Bulundu, yeni bildirim, atama vs.
        const haftaId = getHaftaIdFromDate(tarih);
        const yeniBildirimRef = collection(db, 'bildirimler');
        await addDoc(yeniBildirimRef, {
          haftaId, tarih, vakit, uid: aday.id, tip: 'gorev_cagrisi',
          durum: 'bekliyor', pendingAck: true, olusturmaTarihi: Timestamp.now(), sonGuncelleme: Timestamp.now()
        });

        // Haftalık planı senkronize et: Yeni adayı SADECE bu vakitte Asil olarak ata
        await updateDoc(doc(db, 'haftaPlanlari', haftaId), {
          [`gunler.${tarih}.${vakit}.asil`]: aday.id
        });

        return true;
      }
    }
    
    // Zincir tükendiğinde mekanizmayı çalıştır
    await dinamikGorevKontrolMekanizmasi(tarih, vakit, haricUidler);
    return false;
  } catch (err) {
    throw handleFirestoreError(err, OperationType.WRITE, pathPrefix);
  }
}
