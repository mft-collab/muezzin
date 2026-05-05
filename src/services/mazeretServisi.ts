import { doc, getDoc, runTransaction, query, collection, where, getDocs, setDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { tieBreakerSirala } from '../utils/tieBreaker';
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
      
      // T-1 saat kontrolü için takvim verisini çek (vakitlere gitmeli)
      const bildirim = bildirimDoc.data();
      const vakitDoc = await transaction.get(doc(db, 'vakitler', bildirim.tarih.slice(0, 7)));
      
      // Ezan saati kontrolü
      const gunVakitleri = vakitDoc.data()?.gunler[bildirim.tarih];
      if (gunVakitleri && gunVakitleri[bildirim.vakit]) {
        const [saat, dakika] = gunVakitleri[bildirim.vakit].split(':').map(Number);
        const ezanSaati = new Date();
        ezanSaati.setHours(saat, dakika, 0, 0);
      }

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
    // İlk olarak haftalık planda zaten atanmış olan yedeği tespit et.
    const yedekSorgu = query(collection(db, 'bildirimler'), 
      where('tarih', '==', tarih), 
      where('vakit', '==', vakit), 
      where('tip', '==', 'yedek')
    );
    
    const yedekSnapshot = await getDocs(yedekSorgu);
    if (!yedekSnapshot.empty) {
      const yedekDoc = yedekSnapshot.docs[0];
      const yedekData = yedekDoc.data();
      
      if (!haricUidler.includes(yedekData.uid) && yedekData.durum !== 'reddedildi') {
        // Yedeğe çağrıyı yönlendir
        await setDoc(doc(db, 'bildirimler', yedekDoc.id), { tip: 'gorev_cagrisi' }, { merge: true });
        return true;
      }
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

    // Haric tutulanlar, yedeği ve izinli olanları adaylardan çıkart
    let adaylar = muezzinler.filter(m => !haricUidler.includes(m.id) && !izinliUidler.includes(m.id));
    if (!yedekSnapshot.empty) {
      adaylar = adaylar.filter(m => m.id !== yedekSnapshot.docs[0].data().uid);
    }

    const siraliAdaylar = tieBreakerSirala(adaylar, {}); 

    for (const aday of siraliAdaylar) {
      const kontrol = await getDocs(query(collection(db, 'bildirimler'), 
        where('uid', '==', aday.id), where('tarih', '==', tarih), where('vakit', '==', vakit), where('durum', '==', 'reddedildi')));
      
      if (kontrol.empty) {
        // Bulundu, yeni bildirim, atama vs.
        const yeniBildirimRef = doc(collection(db, 'bildirimler'));
        await setDoc(yeniBildirimRef, {
          haftaId: 'Acil', tarih, vakit, uid: aday.id, tip: 'gorev_cagrisi',
          durum: 'bekliyor', pendingAck: true, olusturmaTarihi: Timestamp.now(), sonGuncelleme: Timestamp.now()
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
