import {
  addDoc,
  collection,
  DocumentData,
  DocumentSnapshot,
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

/**
 * Mazeret bildirimi, tek bir Firestore transaction'ı içinde şu iki adımı atomik
 * olarak yapar:
 *  1. Asil görevlinin kendi bildirimini 'reddedildi' yapar (kurallarda her zaman
 *     izinli olan bir self-update).
 *  2. Uygun bir yedek varsa, YALNIZCA O YEDEĞİN kendi bildirim belgesini
 *     'asil' rolüne terfi ettirir.
 *
 * Bu ikinci yazım normalde "başka birinin belgesini güncelleme" olduğu için
 * kurallarca reddedilir; ancak bildirim ID'leri deterministik olduğundan
 * (haftaId_tarih_vakit_tip), firestore.rules'daki `isBackupPromotionFromMazeret`
 * fonksiyonu getAfter() ile aynı transaction içindeki asil belgesinin gerçekten
 * 'reddedildi' durumuna geçtiğini doğrulayıp bu terfiye izin verir.
 *
 * haftaPlanlari senkronu ve (yedek bulunamazsa) admin alarmı, bu belge
 * çiftinin "devirSonucu" alanına bakan scripts/mazeretDevirleriniIsle.ts
 * uzlaştırma (reconciliation) işi tarafından ayrıca işlenir — o yazımlar
 * admin SDK gerektirir ve Spark planında istemciden yapılamaz.
 */
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

    const { haftaId, tarih, vakit, uid } = mevcutBildirim;
    const yedekRef = doc(db, 'bildirimler', `${haftaId}_${tarih}_${vakit}_yedek`);

    await runTransaction(db, async (transaction) => {
      // Firestore transaction kuralı: tüm okumalar, tüm yazımlardan önce yapılmalı.
      const asilSnap = await transaction.get(bildirimRef);
      if (!asilSnap.exists()) throw new Error('Asil bildirim bulunamadı.');
      const asilData = asilSnap.data() as Bildirim;
      if (asilData.durum !== 'bekliyor') throw new Error('Bu görev için mazeret bildirilemez.');

      const yedekSnap = await transaction.get(yedekRef);
      const yedekData = yedekSnap.exists() ? (yedekSnap.data() as Bildirim) : null;

      let yedekUserSnap: DocumentSnapshot<DocumentData> | null = null;
      if (yedekData && yedekData.durum !== 'reddedildi' && yedekData.uid !== uid) {
        yedekUserSnap = await transaction.get(doc(db, 'muezzins', yedekData.uid));
      }

      const yedekUygun = !!(
        yedekData &&
        yedekUserSnap?.exists() &&
        yedekUserSnap.data()?.role === 'muezzin' &&
        yedekUserSnap.data()?.aktif === true
      );

      transaction.update(bildirimRef, {
        durum: 'reddedildi',
        retSebebi,
        pendingAck: false,
        devirSonucu: yedekUygun ? 'yedek_atandi' : 'alarm_bekliyor',
        sonGuncelleme: serverTimestamp()
      });

      if (yedekUygun) {
        transaction.update(yedekRef, {
          tip: 'asil',
          durum: 'bekliyor',
          pendingAck: true,
          asilMazeretUid: currentUid,
          sonGuncelleme: serverTimestamp()
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
