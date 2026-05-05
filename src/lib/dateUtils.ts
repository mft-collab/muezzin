
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
 * Türkiye saati (UTC+3) için yardımcı fonksiyonlar
 */

export function getTurkeyNow(): Date {
  const now = new Date();
  // Get UTC time by adding timezone offset to current local time
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  // Turkey is fixed UTC + 3 (no DST change since 2016)
  return new Date(utc + (3600000 * 3));
}

export function getTurkeyTimeFormatted(): string {
  const now = getTurkeyNow();
  return now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function getTurkeyDateString(date?: Date): string {
  const d = date || getTurkeyNow();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseVakitToDate(tarih: string, vakitSaati: string): Date {
  // tarih: YYYY-MM-DD
  // vakitSaati: HH:mm
  const [year, month, day] = tarih.split('-').map(Number);
  const [hour, minute] = vakitSaati.split(':').map(Number);
  
  // Date constructor'ı local zamanı kullanır, ancak biz bunu Türkiye zamanı olarak kabul edip
  // geri döndürürken Türkiye timezone'una göre normalize etmeliyiz.
  // Ancak en basit yol: Türkiye saatine göre bir date objesi oluşturup saatlerini set etmek.
  const date = getTurkeyNow();
  date.setFullYear(year, month - 1, day);
  date.setHours(hour, minute, 0, 0);
  return date;
}

export const GUNLER_TR: Record<number, string> = {
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
  7: "Pazar"
};
