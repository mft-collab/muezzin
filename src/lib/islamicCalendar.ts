/**
 * islamicCalendar.ts — Hicri Takvim Yardımcı Fonksiyonları
 * Kerahat, Teheccüd, Bayram ve Teşrik vakitlerinin tespiti için
 */

import { getHijriDate } from './dateUtils';

export interface HijriDateParts {
  day: number;
  month: number; // 1–12
  year: number;
  monthName: string;
}

const HICRI_AY_ISIMLERI = [
  'Muharrem', 'Safer', 'Rebiülevvel', 'Rebiülahir',
  'Cemaziyelevvel', 'Cemaziyelahir', 'Recep', 'Şaban',
  'Ramazan', 'Şevval', 'Zilkade', 'Zilhicce'
];

/**
 * getHijriDate() fonksiyonunun döndürdüğü metni parse ederek
 * yapısal bir nesneye çevirir.
 * Örnek: "25 Zilhicce 1446" → { day: 25, month: 12, year: 1446, monthName: 'Zilhicce' }
 */
export function parseHijriDate(date: Date): HijriDateParts {
  const text = getHijriDate(date); // "d MonthName yyyy"
  const parts = text.trim().split(' ');
  const day = parseInt(parts[0], 10);
  const monthName = parts[1];
  const year = parseInt(parts[2], 10);
  const month = HICRI_AY_ISIMLERI.indexOf(monthName) + 1;
  return { day, month, year, monthName };
}

/** Ramazan Bayramı: 1 Şevval (10. ay) */
export function isRamazanBayram(date: Date): boolean {
  const { day, month } = parseHijriDate(date);
  return month === 10 && day === 1;
}

/** Kurban Bayramı: 10 Zilhicce (12. ay) */
export function isKurbanBayram(date: Date): boolean {
  const { day, month } = parseHijriDate(date);
  return month === 12 && day === 10;
}

/** Arefe günü: 9 Zilhicce */
export function isArefe(date: Date): boolean {
  const { day, month } = parseHijriDate(date);
  return month === 12 && day === 9;
}

/**
 * Teşrik günleri: 9–13 Zilhicce
 * (Arefe dahil, Kurban Bayramı 3 günü ve tatil günü dahil)
 */
export function isTesrikGunu(date: Date): boolean {
  const { day, month } = parseHijriDate(date);
  return month === 12 && day >= 9 && day <= 13;
}

/**
 * Son teşrik günü: 13 Zilhicce — İkindi'den sonra teşrik biter
 */
export function isSonTesrikGunu(date: Date): boolean {
  const { day, month } = parseHijriDate(date);
  return month === 12 && day === 13;
}

/** Bir gün öncesi için Hicri tarih kontrolü */
export function isRamazanBayramArife(date: Date): boolean {
  // Bir sonraki gün Ramazan Bayramı mı? → 30 Ramazan (9. ay, 30. gün) veya doğrudan hesap
  const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return isRamazanBayram(nextDay);
}

export function isKurbanBayramArife(date: Date): boolean {
  // Bir sonraki gün Kurban Bayramı mı? → Arefe günü = 9 Zilhicce
  return isArefe(date);
}

/** Arefe gününden 1 gün öncesi kontrolü (Arefe hazırlığı) */
export function isRamazanArifeOncesi(date: Date): boolean {
  // Bir sonraki gün Ramazan Bayramı Arefesi mi?
  const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return isRamazanBayramArife(nextDay);
}

export function isKurbanArifeOncesi(date: Date): boolean {
  // Bir sonraki gün Kurban Bayramı Arefesi mi? (8 Zilhicce)
  const { day, month } = parseHijriDate(date);
  return month === 12 && day === 8;
}

/** Ramazan ayı tespiti: 9. ay */
export function isRamazan(date: Date): boolean {
  const { month } = parseHijriDate(date);
  return month === 9;
}

/** Ramazan'dan 1 gün öncesi tespiti (İlk Sahur & Teravih gecesi) */
export function isRamazanBaslangiciOncesi(date: Date): boolean {
  const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  const { day, month } = parseHijriDate(nextDay);
  return month === 9 && day === 1;
}
