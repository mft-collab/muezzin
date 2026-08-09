import { doc, getDocs, collection, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getTurkeyNow } from '../lib/dateUtils';
import { aylikVakitleriCek, aylikVakitleriGrupla } from './ezanVaktiServisi';
import { AylikVakitler, SystemSettings } from '../types';

export type VakitCacheKaydi = AylikVakitler & { id: string };

/**
 * `vakitler` doc id'leri `${ilceId}_${yil-ay}` şeklindedir; koleksiyonda hiçbir
 * zaman temizlenmeyen bir geçmiş birikir — cami ilçe kodu bir gün değişirse
 * eski ilçenin kayıtları burada kalıcı olarak kalır. `ilceId` verildiğinde
 * yalnızca o ilçeye ait kayıtlar döner; verilmezse (geriye dönük uyumluluk
 * için) tüm kayıtlar döner.
 */
export async function listeleVakitCacheleri(ilceId?: string): Promise<VakitCacheKaydi[]> {
  const snapshot = await getDocs(collection(db, 'vakitler'));
  let data = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as VakitCacheKaydi[];

  if (ilceId) {
    data = data.filter((kayit) => kayit.id.startsWith(`${ilceId}_`));
  }

  return data.sort((a, b) => b.id.localeCompare(a.id));
}

/**
 * API'nin bugünden itibaren döndürdüğü kayan pencereyi TEK bir çağrıyla
 * çekip gerçek takvim aylarına göre böler ve ortaya çıkan HER ay doc'unu
 * ayrı ayrı senkronize eder — eskiden bu fonksiyon `senkronizeVakitCacheAyi`'yi
 * "bu ay" ve "gelecek ay" için ayrı ayrı (gereksiz iki API isteğiyle)
 * çağırıyordu; ikisi de AYNI karışık pencereyi alıp kendi doc'una tam
 * olarak yazıyordu (bkz. mimari denetim O5).
 */
export async function senkronizeGuncelVeGelecekAyCache(
  settings: Pick<SystemSettings, 'ilceId' | 'ilceAdi'>
) {
  const bugun = getTurkeyNow();
  const apiVerisi = await aylikVakitleriCek(bugun.getFullYear(), bugun.getMonth() + 1, settings.ilceId, settings.ilceAdi);
  const gruplar = aylikVakitleriGrupla(apiVerisi);

  return Promise.all(
    Object.entries(gruplar).map(async ([ayId, grup]) => {
      const docId = `${settings.ilceId}_${ayId}`;
      const data = { ...grup, guncellenmeTarihi: Timestamp.now() };
      await setDoc(doc(db, 'vakitler', docId), data, { merge: true });
      return { docId, data };
    })
  );
}
