import { doc, getDocs, collection, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getTurkeyNow } from '../lib/dateUtils';
import { aylikVakitleriCek } from './ezanVaktiServisi';
import { AylikVakitler, SystemSettings } from '../types';

export type VakitCacheKaydi = AylikVakitler & { id: string };

function monthKey(date: Date) {
  return {
    yil: date.getFullYear(),
    ay: date.getMonth() + 1,
    docSuffix: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
  };
}

function nextMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

export async function listeleVakitCacheleri(): Promise<VakitCacheKaydi[]> {
  const snapshot = await getDocs(collection(db, 'vakitler'));
  const data = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as VakitCacheKaydi[];

  return data.sort((a, b) => b.id.localeCompare(a.id));
}

export async function senkronizeVakitCacheAyi(
  settings: Pick<SystemSettings, 'ilceId' | 'ilceAdi'>,
  yil: number,
  ay: number
) {
  const apiVerisi = await aylikVakitleriCek(yil, ay, settings.ilceId, settings.ilceAdi);
  const docId = `${settings.ilceId}_${yil}-${String(ay).padStart(2, '0')}`;
  await setDoc(doc(db, 'vakitler', docId), apiVerisi);
  return { docId, data: apiVerisi };
}

export async function senkronizeGuncelVeGelecekAyCache(
  settings: Pick<SystemSettings, 'ilceId' | 'ilceAdi'>
) {
  const bugun = getTurkeyNow();
  const aylar = [monthKey(bugun), monthKey(nextMonth(bugun))];
  const uniqueMonths = Array.from(new Map(aylar.map((item) => [item.docSuffix, item])).values());

  return Promise.all(
    uniqueMonths.map((item) => senkronizeVakitCacheAyi(settings, item.yil, item.ay))
  );
}
