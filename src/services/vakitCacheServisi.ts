import { doc, getDocs, collection, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getTurkeyNow } from '../lib/dateUtils';
import { aylikVakitleriCek, aylikVakitleriGrupla } from './ezanVaktiServisi';
import { AylikVakitler, SystemSettings } from '../types';

export type VakitCacheKaydi = AylikVakitler & { id: string };

export async function listeleVakitCacheleri(): Promise<VakitCacheKaydi[]> {
  const snapshot = await getDocs(collection(db, 'vakitler'));
  const data = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as VakitCacheKaydi[];

  return data.sort((a, b) => b.id.localeCompare(a.id));
}

/**
 * Belirli bir ay için önbelleği senkronize eder. `aylikVakitleriCek`'in
 * birincil (Diyanet) kaynağı `yil`/`ay` parametrelerini yok sayıp bugünden
 * itibaren ~30-32 günlük kayan bir pencere döndürdüğünden (bkz. o
 * fonksiyonun yorumu), dönen pencere istenen aydan FAZLASINI (bir sonraki
 * ayın bir kısmını) içerebilir. `aylikVakitleriGrupla` ile gerçek takvim
 * ayına göre bölünüp yalnızca istenen `yil-ay`'a denk gelen günler bu doc'a
 * yazılır — aksi halde (eski davranış) pencerenin TAMAMI olduğu gibi bu
 * doc'a yazılıyordu ve içerik çapraz ay kirliliği taşıyordu (bkz. mimari
 * denetim O5).
 */
export async function senkronizeVakitCacheAyi(
  settings: Pick<SystemSettings, 'ilceId' | 'ilceAdi'>,
  yil: number,
  ay: number
) {
  const apiVerisi = await aylikVakitleriCek(yil, ay, settings.ilceId, settings.ilceAdi);
  const gruplar = aylikVakitleriGrupla(apiVerisi);
  const ayId = `${yil}-${String(ay).padStart(2, '0')}`;
  const grup = gruplar[ayId] ?? { ilceId: apiVerisi.ilceId, kaynakApi: apiVerisi.kaynakApi, gunler: {} };

  const docId = `${settings.ilceId}_${ayId}`;
  const data = { ...grup, guncellenmeTarihi: Timestamp.now() };
  await setDoc(doc(db, 'vakitler', docId), data, { merge: true });
  return { docId, data };
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
