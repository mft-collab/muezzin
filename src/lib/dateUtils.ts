import { startOfWeek, format, parseISO, subDays, subWeeks } from 'date-fns';
import { Vakit } from '../types';

/**
 * Firestore'dan gelen bir zaman değerini (Timestamp, {seconds}, ISO string
 * veya Date) güvenli şekilde bir JS Date'e çevirir. Değer yoksa null döner.
 */
export function toJsDate(value: unknown): Date | null {
  if (!value) return null;
  const v = value as { toDate?: () => Date; seconds?: number };
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  const date = new Date(value as string | number | Date);
  return isNaN(date.getTime()) ? null : date;
}

export const VAKIT_GORA_ISIMLERI: Record<Vakit, string> = {
 sabah: "Sabah",
 ogle: "Öğle",
 ikindi: "İkindi",
 aksam: "Akşam",
 yatsi: "Yatsı"
};

export function toTurkishUpperCase(text: string): string {
 return text.toLocaleUpperCase('tr-TR');
}

/**
 * Türkiye saati (UTC+3) için çevresel bağımsız yardımcı fonksiyonlar
 */

export function getTurkeyNow(): Date {
 const now = new Date();
 // Add server time offset to correct device clock skew
 const offset = typeof globalThis !== 'undefined' && globalThis.__timeOffset !== undefined
   ? globalThis.__timeOffset
   : 0;
 const syncedNow = new Date(now.getTime() + offset);

 // Türkiye sabit UTC+3'tür.
 const turkeyOffset = 3 * 60; 
 // getTimezoneOffset() yerel saat ile UTC arasındaki farkı dakika cinsinden döner.
 // Türkiye (UTC+3) için bu değer -180'dir.
 // Biz farkı (HedefOffset - YerelOffset) olarak hesaplayıp timestamp'i kaydırıyoruz.
 const localOffset = -syncedNow.getTimezoneOffset(); 
 const diff = turkeyOffset - localOffset;
 return new Date(syncedNow.getTime() + (diff * 60000));
}

export function getTurkeyTimeFormatted(date?: Date): string {
 const d = date || getTurkeyNow();
 const h = String(d.getHours()).padStart(2, '0');
 const m = String(d.getMinutes()).padStart(2, '0');
 const s = String(d.getSeconds()).padStart(2, '0');
 return `${h}:${m}:${s}`;
}

export function getTurkeyDateString(date?: Date): string {
 const d = date || getTurkeyNow();
 const year = d.getFullYear();
 const month = String(d.getMonth() + 1).padStart(2, '0');
 const day = String(d.getDate()).padStart(2, '0');
 return `${year}-${month}-${day}`;
}

/**
 * İki "HH:mm" saati arasındaki farkı dakika cinsinden döner (time2 - time1).
 * Gece yarısını çevreleyen saatlerde (örn. 23:58 → 00:02) sonucu en kısa
 * yöne sararak normalize eder — aksi halde -1436 gibi anlamsız bir fark
 * çıkar, oysa gerçek fark +4 dakikadır.
 */
export function getMinutesDiff(time1: string | undefined, time2: string | undefined): number {
 if (!time1 || !time2) return 0;
 const [h1, m1] = time1.split(':').map(Number);
 const [h2, m2] = time2.split(':').map(Number);
 let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
 if (diff > 720) diff -= 1440;
 if (diff < -720) diff += 1440;
 return diff;
}

export function parseVakitToDate(tarih: string, vakitSaati: string): Date | null {
 if (!vakitSaati || !tarih) return null;
 const [year, month, day] = tarih.split('-').map(Number);
 const [hour, minute] = vakitSaati.split(':').map(Number);
 
 // Önce gerçek bir UTC tarihi oluşturup sonra Türkiye farkını eklemek 
 // yerine, getTurkeyNow() üzerinden gelen "kaydırılmış" zamanı baz alarak 
 // setHours yapıyoruz. Bu, karşılaştırmaların (now >= target) her zaman 
 // tutarlı olmasını sağlar.
 const date = getTurkeyNow();
 date.setFullYear(year, month - 1, day);
 date.setHours(hour, minute, 0, 0);
 return date;
}

export const GUNLER_TR: Record<number, string> = {
 1: "Pazartesi", 2: "Salı", 3: "Çarşamba", 4: "Perşembe", 5: "Cuma", 6: "Cumartesi", 7: "Pazar"
};

export function isFriday(date: Date): boolean {
 return date.getDay() === 5;
}

/**
 * Bir izin aralığının ([baslangic, bitis], her ikisi de dahil) kaç gün
 * sürdüğünü hesaplar — yıllık izin 30 gün/yıl kotası için (bkz.
 * useAdminIzinlerStore.ts izinOnayla, firestore.rules isValidMuezzin).
 */
export function izinGunSayisi(baslangic: string, bitis: string): number {
 const [by, bm, bd] = baslangic.split('-').map(Number);
 const [ey, em, ed] = bitis.split('-').map(Number);
 const start = new Date(by, bm - 1, bd);
 const end = new Date(ey, em - 1, ed);
 return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function getHaftaIdFromDate(dateStr: string): string {
 const date = parseISO(dateStr);
 const pazartesi = startOfWeek(date, { weekStartsOn: 1 });
 return `W${format(pazartesi, 'yyyy-MM-dd')}`;
}

/**
 * Verilen haftaId'nin (W-YYYY-MM-DD, Pazartesi başlangıçlı) bir önceki
 * haftasının haftaId'sini ve o haftanın son gününün (Pazar) tarihini döner.
 * Haftalık plan üretiminde dinlenme kuralının (SOS) hafta sınırında
 * sıfırlanmasını önlemek için kullanılır (bkz. algoritma denetimi,
 * src/lib/planlamaCekirdegi.ts `haftalikPlanUret`'in `oncekiHaftaSonEkibi` parametresi).
 */
export function getOncekiHafta(haftaId: string): { haftaId: string; sonGun: string } {
 const buHaftaninPazartesi = parseISO(haftaId.substring(1));
 const oncekiPazartesi = subWeeks(buHaftaninPazartesi, 1);
 const oncekiPazar = subDays(buHaftaninPazartesi, 1);
 return {
 haftaId: `W${format(oncekiPazartesi, 'yyyy-MM-dd')}`,
 sonGun: format(oncekiPazar, 'yyyy-MM-dd')
 };
}

export function calculateLastThirdOfNight(aksam: Date, imsak: Date): Date {
 let imsakTime = imsak.getTime();
 const aksamTime = aksam.getTime();
 if (imsakTime <= aksamTime) imsakTime += 24 * 60 * 60 * 1000;
 const birBolum = (imsakTime - aksamTime) / 3;
 return new Date(Math.round(imsakTime - birBolum));
}

export function calculateKerahatTimes(gunes: Date, ogle: Date, aksam: Date) {
 return {
 sabah: { baslangic: new Date(gunes), bitis: new Date(gunes.getTime() + 40 * 60 * 1000) },
 ogle:  { baslangic: new Date(ogle.getTime() - 15 * 60 * 1000), bitis: new Date(ogle) }, // Zeval: 15 dk
 aksam: { baslangic: new Date(aksam.getTime() - 40 * 60 * 1000), bitis: new Date(aksam) }
 };
}


export function calculateVakitProgress(baslangic: Date, bitis: Date, suan: Date): number {
 const total = bitis.getTime() - baslangic.getTime();
 const elapsed = suan.getTime() - baslangic.getTime();
 if (total <= 0) return 0;
 return Math.min(1, Math.max(0, elapsed / total));
}

export function getHijriDate(date: Date): string {
  // Read Hicri offset from globalThis (safe for SSR, testing environments and decoupling module loads)
  const offsetDays = typeof globalThis !== 'undefined' && globalThis.__hicriOffset !== undefined
    ? globalThis.__hicriOffset
    : 0;
  
  // Timezone-safe local day count (immune to UTC midnight shifts)
  const localMs = date.getTime() - date.getTimezoneOffset() * 60000;
  const localDays = Math.floor(localMs / 86400000) + offsetDays;
  
  // Diyanet/Turkey 2026 Kurban alignment adjustment (-1 day offset compared to standard astronomical tabulate)
  const jd = localDays + 2440588;
  
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j = (Math.floor((10985 - l) / 5316)) * (Math.floor((50 * l) / 17719)) + (Math.floor(l / 5670)) * (Math.floor((43 * l) / 15238));
  l = l - (Math.floor((30 - j) / 15)) * (Math.floor((17719 * j) / 50)) - (Math.floor(j / 16)) * (Math.floor((15238 * j) / 43)) + 29;
  const m = Math.floor((24 * l) / 709);
  const d = l - Math.floor((709 * m) / 24);
  const y = 30 * n + j - 30;
  const months = ["Muharrem", "Safer", "Rebiülevvel", "Rebiülahir", "Cemaziyelevvel", "Cemaziyelahir", "Recep", "Şaban", "Ramazan", "Şevval", "Zilkade", "Zilhicce"];
  return `${d} ${months[m - 1]} ${y}`;
}
