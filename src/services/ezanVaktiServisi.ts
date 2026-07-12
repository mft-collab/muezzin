import { GunlukVakit, Vakit, Vakitler, VakitKaydi } from '../types';
import { getTurkeyNow, parseVakitToDate } from '../lib/dateUtils';
import { Timestamp } from 'firebase/firestore';

const VAKITLER: Vakit[] = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'];

/**
 * NAMAZ VAKTİ SERVİSİ — Master Level Implementation
 * Clean Code, SOLID, ve Yüksek Performans odaklı refaktör edildi.
 */

/**
 * Dış API'lerden aylık ezan vakti verilerini çeker (Fallback mekanizması).
 * @param yil Yıl (örn: 2026)
 * @param ay Ay (1-12)
 * @param ilceId Diyanet İlçe ID (örn: 9148)
 * @param ilceAdi İlçe Adı (örn: Ceyhan)
 */
export async function aylikVakitleriCek(
 yil: number, 
 ay: number, 
 ilceId: string, 
 ilceAdi: string
): Promise<Vakitler> {
 try {
 // 1. Tercih: Diyanet API (e-mushaf proxy)
 const diyanetUrl = `https://ezanvakti.emushaf.net/vakitler/${ilceId}`;
 const response = await fetch(diyanetUrl);
 
 if (response.ok) {
 const data = await response.json();
 if (Array.isArray(data) && data.length > 0) {
 return parseDiyanetResponse(data, ilceId);
 }
 }
 
 throw new Error('Diyanet verisi alınamadı, Aladhan deneniyor.');
 } catch (err) {
 console.warn('Diyanet API hatası, Aladhan API devreye giriyor:', err);
 
 // 2. Tercih: Aladhan API (City/Country bazlı)
 // Not: Aladhan API ay bazlı veri döner
 let city = ilceAdi;
 let country = 'Turkey';
 if (ilceAdi.includes(',')) {
   const parts = ilceAdi.split(',');
   city = parts[0].trim();
   country = parts[1].trim();
 } else {
   const lowerCity = ilceAdi.toLowerCase();
   if (lowerCity.includes('mekke') || lowerCity.includes('mecca') || lowerCity.includes('medine') || lowerCity.includes('medina') || lowerCity.includes('riyad')) {
     country = 'Saudi Arabia';
   } else if (lowerCity.includes('london') || lowerCity.includes('londra')) {
     country = 'United Kingdom';
   }
 }
 
 const aladhanUrl = `https://api.aladhan.com/v1/calendarByCity/${yil}/${ay}?city=${city}&country=${country}&method=13`;
 const response = await fetch(aladhanUrl);
 
 if (!response.ok) throw new Error('Ezan vakti servislerine erişilemiyor.');

 const result = await response.json();
 if (!Array.isArray(result?.data)) {
   throw new Error('Ezan vakti servisi beklenmeyen bir yanıt döndü.');
 }
 return parseAladhanResponse(result.data, ilceId);
 }
}

/**
 * Mevcut namaz vaktini hesaplar.
 */
export function mevcutVaktiHesapla(bugunVakitler: GunlukVakit): Vakit {
 const şimdi = getTurkeyNow();

 // Sondan başa doğru kontrol ederek içinde olduğumuz en son vakti buluyoruz
 for (let i = VAKITLER.length - 1; i >= 0; i--) {
 const vakit = VAKITLER[i];
 const vakitZamani = parseVakitToDate(bugunVakitler.tarih, bugunVakitler[vakit]);
 
 if (vakitZamani && şimdi >= vakitZamani) {
 return vakit;
 }
 }

 // Gece yarısından sabah namazına kadar olan süreyi yatsı periyodu sayıyoruz
 return 'yatsi'; 
}

/**
 * Bir sonraki namaz vaktini ve ilgili kilit zamanlarını hesaplar.
 */
export function sonrakiVaktiHesapla(bugunVakitler: GunlukVakit, yarinVakitler?: GunlukVakit): {
 vakit: Vakit;
 ezanSaati: Date;
 baslangicZamani: Date;
 okudumAcilisZamani: Date;
 t1KilitZamani: Date;
} | null {
 const şimdi = getTurkeyNow();
 let oncekiVakitZamani: Date | null = null;

 for (let i = 0; i < VAKITLER.length; i++) {
 const vakit = VAKITLER[i];
 const ezanSaati = parseVakitToDate(bugunVakitler.tarih, bugunVakitler[vakit]);
 if (!ezanSaati) continue;

 // Görev bitişi: ezandan 1 dakika sonra (tam saniye bazlı kontrol için buffer)
 const gorevBitisZamani = new Date(ezanSaati.getTime() + 60 * 1000);

 if (gorevBitisZamani > şimdi) {
 // Önceki vakit zamanını belirle (progress bar ve kilitler için)
 if (i > 0) {
 oncekiVakitZamani = parseVakitToDate(bugunVakitler.tarih, bugunVakitler[VAKITLER[i - 1]]);
 } else {
 // Sabah namazı için önceki vakit (dünkü yatsı) yaklaşık 2 saat önce gibi varsayılabilir 
 // veya spesifik mantık eklenebilir.
 oncekiVakitZamani = new Date(ezanSaati.getTime() - 2 * 60 * 60 * 1000);
 }

 return {
 vakit,
 ezanSaati,
 baslangicZamani: oncekiVakitZamani || new Date(ezanSaati.getTime() - 3600000),
 okudumAcilisZamani: new Date(ezanSaati.getTime()),
 t1KilitZamani: new Date(ezanSaati.getTime() - 60 * 60 * 1000)
 };
 }
 }

 // Eğer bugünün tüm vakitleri geçtiyse, yarına bakıyoruz
 if (yarinVakitler) {
 const yarinSabah = parseVakitToDate(yarinVakitler.tarih, yarinVakitler.sabah);
 if (yarinSabah) {
 const bugunYatsi = parseVakitToDate(bugunVakitler.tarih, bugunVakitler.yatsi);
 return {
 vakit: 'sabah',
 ezanSaati: yarinSabah,
 baslangicZamani: bugunYatsi || new Date(yarinSabah.getTime() - 3 * 3600000),
 okudumAcilisZamani: new Date(yarinSabah.getTime()),
 t1KilitZamani: new Date(yarinSabah.getTime() - 60 * 60 * 1000)
 };
 }
 }

 return null;
}

// --- Yardımcı Parsers ---

function parseDiyanetResponse(data: any[], ilceId: string): Vakitler {
 const gunler: Record<string, VakitKaydi> = {};
 data.forEach((gun: any) => {
 const rawDate = gun?.MiladiTarihKisa;
 if (typeof rawDate !== 'string' || !rawDate) {
 console.warn('Diyanet API: gün verisi eksik/bozuk, atlandı:', gun);
 return;
 }
 let dateKey = rawDate;
 if (dateKey.includes('.')) {
 const [d, m, y] = dateKey.split('.');
 dateKey = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
 }
 gunler[dateKey] = {
 sabah: gun.Imsak,
 gunes: gun.Gunes,
 ogle: gun.Ogle,
 ikindi: gun.Ikindi,
 aksam: gun.Aksam,
 yatsi: gun.Yatsi
 };
 });
 return {
 ilceId,
 gunler,
 kaynakApi: 'diyanet',
 guncellenmeTarihi: Timestamp.now()
 };
}

function parseAladhanResponse(data: any[], ilceId: string): Vakitler {
 const gunler: Record<string, VakitKaydi> = {};
 data.forEach((gun: any) => {
 const tarih = gun?.date?.gregorian?.date; // 20-04-2026
 const timings = gun?.timings;
 if (typeof tarih !== 'string' || !timings) {
 console.warn('Aladhan API: gün verisi eksik/bozuk, atlandı:', gun);
 return;
 }
 const [d, m, y] = tarih.split('-');
 const formattedDate = `${y}-${m}-${d}`;
 const vaktiAyikla = (key: string): string | undefined =>
 typeof timings[key] === 'string' ? timings[key].split(' ')[0] : undefined;
 gunler[formattedDate] = {
 sabah: vaktiAyikla('Fajr'),
 gunes: vaktiAyikla('Sunrise'),
 ogle: vaktiAyikla('Dhuhr'),
 ikindi: vaktiAyikla('Asr'),
 aksam: vaktiAyikla('Maghrib'),
 yatsi: vaktiAyikla('Isha')
 } as VakitKaydi;
 });
 return {
 ilceId,
 gunler,
 kaynakApi: 'aladhan',
 guncellenmeTarihi: Timestamp.now()
 };
}
