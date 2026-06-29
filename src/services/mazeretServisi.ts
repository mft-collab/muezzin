import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Bildirim } from '../types';
import { getHaftaIdFromDate, getTurkeyNow, parseVakitToDate } from '../lib/dateUtils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

async function getEzanVakti(tarih: string, vakit: string): Promise<Date | null> {
 const settingsDoc = await getDoc(doc(db, 'settings', 'system'));
 const ilceId = (settingsDoc.data()?.ilceId as string) || '9148';
 const monthKey = tarih.slice(0, 7);
 const vakitDoc = await getDoc(doc(db, 'vakitler', `${ilceId}_${monthKey}`));
 if (!vakitDoc.exists()) return null;
 const saat = vakitDoc.data()?.gunler?.[tarih]?.[vakit];
 if (typeof saat !== 'string') return null;
 return parseVakitToDate(tarih, saat);
}

async function dinamikGorevKontrolMekanizmasi(tarih: string, vakit: string, haricUidler: string[]): Promise<void> {
 const path = 'adminUyarilari';
 try {
 const mazeretGirisiVar = haricUidler.length > 0;

 const alarmSorgu = query(
 collection(db, 'adminUyarilari'),
 where('tarih', '==', tarih),
 where('vakit', '==', vakit),
 where('cozuldu', '==', false)
 );
 const alarmSnap = await getDocs(alarmSorgu);
 if (!alarmSnap.empty) return;

  await addDoc(collection(db, 'adminUyarilari'), {
    tip: 'zincirTukendi',
    mesaj: mazeretGirisiVar
      ? 'Mazeret sonrası yedek görevi devralamadı. Kural gereği ek görevli atanamaz; admin müdahalesi gerekir.'
      : 'Kritik Hata: Veri zinciri tükendi ve yedek görevli de uygun değil.',
    tarih,
    vakit,
    cozuldu: false,
    olusturmaTarihi: serverTimestamp()
  });
 } catch (err) {
 throw handleFirestoreError(err, OperationType.WRITE, path);
 }
}

export async function mazeretBildir(bildirimId: string, retSebebi: string, ezanSaati?: string): Promise<void> {
  const bildirimRef = doc(db, 'bildirimler', bildirimId);

  try {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) throw new Error('Oturum bulunamadı.');

    const mevcutBildirimSnap = await getDoc(bildirimRef);
    if (!mevcutBildirimSnap.exists()) throw new Error('Bildirim bulunamadı.');
    const mevcutBildirim = mevcutBildirimSnap.data() as Bildirim;

    if (mevcutBildirim.uid !== currentUid) {
      throw new Error('Sadece kendi göreviniz için mazeret bildirebilirsiniz.');
    }
    if (mevcutBildirim.tip !== 'asil') {
      throw new Error('Mazeret bildirimi sadece asil görevli tarafından yapılabilir.');
    }
    if (mevcutBildirim.durum !== 'bekliyor') {
      throw new Error('Sadece bekleyen görevler için mazeret bildirilebilir.');
    }

    const ezanVakti = ezanSaati 
      ? parseVakitToDate(mevcutBildirim.tarih, ezanSaati)
      : await getEzanVakti(mevcutBildirim.tarih, mevcutBildirim.vakit);

    if (ezanVakti) {
      const kalanDakika = Math.floor((ezanVakti.getTime() - getTurkeyNow().getTime()) / 60000);
      if (kalanDakika < 50) {
        throw new Error('Ezan vaktine 50 dakikadan az kaldığı için görev devri/mazeret bildirimi kapalıdır.');
      }
    }

    const { tarih, vakit, uid } = mevcutBildirim;

    // 1. Query backup outside the transaction
    const yedekQuery = query(
      collection(db, 'bildirimler'),
      where('tarih', '==', tarih),
      where('vakit', '==', vakit),
      where('tip', '==', 'yedek')
    );
    const yedekSnap = await getDocs(yedekQuery);
    const yedekDoc = yedekSnap.docs[0];

    // 2. Query existing alarms to prevent duplicates
    const alarmSorgu = query(
      collection(db, 'adminUyarilari'),
      where('tarih', '==', tarih),
      where('vakit', '==', vakit),
      where('cozuldu', '==', false)
    );
    const alarmSnap = await getDocs(alarmSorgu);
    const alarmAlreadyExists = !alarmSnap.empty;

    // Prepare a reference for a new alarm doc if we need to write it
    const newAlarmRef = doc(collection(db, 'adminUyarilari'));

    // Execute atomic transaction
    await runTransaction(db, async (transaction) => {
      // Re-read primary to ensure consistency
      const asilSnap = await transaction.get(bildirimRef);
      if (!asilSnap.exists()) throw new Error('Asil bildirim bulunamadı.');
      const asilData = asilSnap.data() as Bildirim;
      if (asilData.durum !== 'bekliyor') throw new Error('Bu görev için mazeret bildirilemez.');

      // Update primary to rejected
      transaction.update(bildirimRef, {
        durum: 'reddedildi',
        retSebebi,
        pendingAck: false,
        sonGuncelleme: serverTimestamp()
      });

      let backupPromoted = false;

      if (yedekDoc) {
        const yedekRef = doc(db, 'bildirimler', yedekDoc.id);
        const yedekSnapInTx = await transaction.get(yedekRef);
        if (yedekSnapInTx.exists()) {
          const yedekData = yedekSnapInTx.data() as Bildirim;
          
          if (yedekData.durum !== 'reddedildi' && yedekData.uid !== uid) {
            // Read backup's user profile to verify active status
            const userRef = doc(db, 'muezzins', yedekData.uid);
            const userSnap = await transaction.get(userRef);
            const userData = userSnap.data() as { role?: string; aktif?: boolean } | undefined;

            if (userSnap.exists() && userData?.role === 'muezzin' && userData?.aktif === true) {
              // Promote backup
              transaction.update(yedekRef, {
                tip: 'asil',
                durum: 'bekliyor',
                pendingAck: true,
                sonGuncelleme: serverTimestamp()
              });

              const haftaId = getHaftaIdFromDate(tarih);
              transaction.update(doc(db, 'haftaPlanlari', haftaId), {
                [`gunler.${tarih}.${vakit}.asil`]: yedekData.uid
              });

              backupPromoted = true;
            }
          }
        }
      }

      // If no backup promoted and alarm doesn't exist, create it in this transaction
      if (!backupPromoted && !alarmAlreadyExists) {
        transaction.set(newAlarmRef, {
          tip: 'zincirTukendi',
          mesaj: yedekDoc 
            ? 'Mazeret sonrası yedek görevi devralamadı. Kural gereği ek görevli atanamaz; admin müdahalesi gerekir.'
            : 'Kritik Hata: Veri zinciri tükendi ve yedek görevli de uygun değil.',
          tarih,
          vakit,
          cozuldu: false,
          olusturmaTarihi: serverTimestamp()
        });
      }
    });

  } catch (err) {
    throw handleFirestoreError(err, OperationType.WRITE, `bildirimler/${bildirimId}`);
  }
}

export async function kriziBaslat(tarih: string, vakit: string, haricUidler: string[]): Promise<boolean> {
  const pathPrefix = 'bildirimler';
  try {
    const yedekQuery = query(
      collection(db, 'bildirimler'),
      where('tarih', '==', tarih),
      where('vakit', '==', vakit),
      where('tip', '==', 'yedek')
    );
    const yedekSnap = await getDocs(yedekQuery);
    const yedekDoc = yedekSnap.docs[0];
    const yedekData = yedekDoc?.data() as Bildirim | undefined;

    if (yedekData && !haricUidler.includes(yedekData.uid) && yedekData.durum !== 'reddedildi') {
      const yedekPersonelDoc = await getDoc(doc(db, 'muezzins', yedekData.uid));
      const yedekPersonel = yedekPersonelDoc.data() as { role?: string; aktif?: boolean } | undefined;
      if (!yedekPersonelDoc.exists() || yedekPersonel?.role !== 'muezzin' || yedekPersonel?.aktif !== true) {
        await dinamikGorevKontrolMekanizmasi(tarih, vakit, haricUidler);
        return false;
      }

      const haftaId = getHaftaIdFromDate(tarih);

      await runTransaction(db, async (transaction) => {
        const yedekRef = doc(db, 'bildirimler', yedekDoc.id);
        const currentYedekSnap = await transaction.get(yedekRef);
        if (!currentYedekSnap.exists() || currentYedekSnap.data()?.durum === 'reddedildi') {
          throw new Error('Yedek görevli artık uygun değil.');
        }

        transaction.update(yedekRef, {
          tip: 'asil',
          durum: 'bekliyor',
          pendingAck: true,
          sonGuncelleme: serverTimestamp()
        });

        transaction.update(doc(db, 'haftaPlanlari', haftaId), {
          [`gunler.${tarih}.${vakit}.asil`]: yedekData.uid
        });
      });

      return true;
    }

    // Kural: aynı tarih/vakit için ek bir üçüncü görevli atanamaz.
    await dinamikGorevKontrolMekanizmasi(tarih, vakit, haricUidler);
    return false;
  } catch (err) {
    throw handleFirestoreError(err, OperationType.WRITE, pathPrefix);
  }
}
