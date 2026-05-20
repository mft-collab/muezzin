import { startOfWeek, format, parseISO } from 'date-fns';
import { Vakit } from '../types';

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
  // Türkiye sabit UTC+3'tür.
  const turkeyOffset = 3 * 60; 
  // getTimezoneOffset() yerel saat ile UTC arasındaki farkı dakika cinsinden döner.
  // Türkiye (UTC+3) için bu değer -180'dir.
  // Biz farkı (HedefOffset - YerelOffset) olarak hesaplayıp timestamp'i kaydırıyoruz.
  const localOffset = -now.getTimezoneOffset(); 
  const diff = turkeyOffset - localOffset;
  return new Date(now.getTime() + (diff * 60000));
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

export function getHaftaIdFromDate(dateStr: string): string {
  const date = parseISO(dateStr);
  const pazartesi = startOfWeek(date, { weekStartsOn: 1 });
  return `W${format(pazartesi, 'yyyy-MM-dd')}`;
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
    ogle: { baslangic: new Date(ogle.getTime() - 45 * 60 * 1000), bitis: new Date(ogle) },
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
  let jd = Math.floor(date.getTime() / 86400000) + 2440588 + 1;
  let l = jd - 1948440 + 10632;
  let n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  let j = (Math.floor((10985 - l) / 5316)) * (Math.floor((50 * l) / 17719)) + (Math.floor(l / 5670)) * (Math.floor((43 * l) / 15238));
  l = l - (Math.floor((30 - j) / 15)) * (Math.floor((17719 * j) / 50)) - (Math.floor(j / 16)) * (Math.floor((15238 * j) / 43)) + 29;
  let m = Math.floor((24 * l) / 709);
  let d = l - Math.floor((709 * m) / 24);
  let y = 30 * n + j - 30;
  const months = ["Muharrem", "Safer", "Rebiülevvel", "Rebiülahir", "Cemaziyelevvel", "Cemaziyelahir", "Recep", "Şaban", "Ramazan", "Şevval", "Zilkade", "Zilhicce"];
  return `${d} ${months[m - 1]} ${y}`;
}
