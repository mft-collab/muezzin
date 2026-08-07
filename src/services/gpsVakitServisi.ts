import { GunlukVakit } from '../types';
import { getTurkeyNow, getTurkeyDateString } from '../lib/dateUtils';

export interface GpsVakitResult {
  coords: { latitude: number; longitude: number };
  date: string;
  vakitler: GunlukVakit;
  konumAdi: string;
}

interface AladhanTimings {
  Imsak: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

const ALADHAN_TIMING_KEYS: (keyof AladhanTimings)[] = ['Imsak', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

function isValidAladhanTimings(value: unknown): value is AladhanTimings {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return ALADHAN_TIMING_KEYS.every((key) => typeof t[key] === 'string' && t[key].length > 0);
}

/**
 * Aladhan'ın "DD-MM-YYYY" biçimli gregorian tarihini "YYYY-MM-DD"ye çevirir.
 * Beklenmeyen bir biçim gelirse null döner (çağıran taraf Türkiye tarihine düşer).
 */
function aladhanGregorianTarihiCevir(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const parcalar = value.split('-');
  if (parcalar.length !== 3) return null;
  const [d, m, y] = parcalar;
  if (!/^\d{2}$/.test(d) || !/^\d{2}$/.test(m) || !/^\d{4}$/.test(y)) return null;
  return `${y}-${m}-${d}`;
}

/**
 * GPS COORDINATE PRAYER SERVICE
 * Fetches high-resolution location based prayer times using T.C. Diyanet method (method=13)
 */
export async function konumVakitleriniCek(
  latitude: number,
  longitude: number
): Promise<GpsVakitResult> {
  // Dikkat: getTurkeyNow() uygulama içi gösterim için gerçek olmayan (Türkiye saatine
  // kaydırılmış) bir epoch üretir — dış API'ye ham "şu an" epoch'u olarak gönderilirse
  // cihaz Türkiye dışında bir saat diliminde olduğunda yanlış takvim gününün vakitleri
  // dönebilir. Aladhan'a her zaman gerçek Unix zaman damgasını gönderiyoruz.
  const timestamp = Math.floor(Date.now() / 1000);
  // Türkiye'nin güncel takvim günü — yalnızca API'nin döndürdüğü gerçek yerel
  // tarih (aşağıda) beklenmedik biçimde eksik/bozuksa yedek olarak kullanılır.
  const turkiyeTarihYedek = getTurkeyDateString(getTurkeyNow());

  // Fetch timings and geocoding in parallel to minimize network latency
  const timingsPromise = (async () => {
    const url = `https://api.aladhan.com/v1/timings/${timestamp}?latitude=${latitude}&longitude=${longitude}&method=13`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Konum bazlı ezan vakitlerine erişilemiyor.');
    }
    const result = await response.json();
    const timings = result?.data?.timings;
    if (!isValidAladhanTimings(timings)) {
      throw new Error('Ezan vakti servisi beklenmeyen bir yanıt döndü.');
    }
    // Sonucu Türkiye'nin güncel takvim günüyle DEĞİL, API'nin sorgulanan
    // koordinat için hesapladığı gerçek yerel takvim günüyle etiketle —
    // cihaz Türkiye'den çok farklı bir saat diliminde bir konumu sorguluyorsa
    // (ör. seyahatteyken), Türkiye'nin "bugün"ü ile GPS konumunun yerel
    // "bugün"ü farklı takvim günlerine denk gelebilir (bkz. mantık denetimi).
    const yerelTarih = aladhanGregorianTarihiCevir(result?.data?.date?.gregorian?.date) ?? turkiyeTarihYedek;
    return { timings, yerelTarih };
  })();

  const cacheKey = `gps_geo_${latitude.toFixed(3)}_${longitude.toFixed(3)}`;
  const cachedVal = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null;

  const geoPromise = (async () => {
    if (cachedVal) {
      try {
        return JSON.parse(cachedVal);
      } catch {}
    }
    try {
      const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=tr`;
      const response = await fetch(geoUrl, {
        headers: {
          'User-Agent': 'MuezzinTakipPro/2.0'
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(data));
          } catch (storageErr) {
            console.warn('sessionStorage write error:', storageErr);
          }
        }
        return data;
      }
    } catch (e) {
      console.warn('Geocoding hatası:', e);
    }
    return null;
  })();

  const [{ timings, yerelTarih }, geoResult] = await Promise.all([timingsPromise, geoPromise]);

  const parsedVakitler: GunlukVakit = {
    tarih: yerelTarih,
    sabah: timings.Imsak.split(' ')[0],
    gunes: timings.Sunrise.split(' ')[0],
    ogle: timings.Dhuhr.split(' ')[0],
    ikindi: timings.Asr.split(' ')[0],
    aksam: timings.Maghrib.split(' ')[0],
    yatsi: timings.Isha.split(' ')[0]
  };

  let konumAdi = 'Yakın Konum';
  if (geoResult && geoResult.address) {
    const addr = geoResult.address;
    const ilce = addr.suburb || addr.district || addr.town || addr.city_district || addr.county || addr.municipality || '';
    const sehir = addr.province || addr.state || addr.city || '';
    if (ilce && sehir) {
      konumAdi = `${ilce}, ${sehir}`;
    } else if (sehir) {
      konumAdi = sehir;
    } else if (geoResult.name) {
      konumAdi = geoResult.name;
    }
  }

  return {
    coords: { latitude, longitude },
    date: yerelTarih,
    vakitler: parsedVakitler,
    konumAdi
  };
}

/**
 * Calculates the Qibla angle (bearing from True North, clockwise) for given coordinates.
 */
export function kibleAcisiHesapla(latitude: number, longitude: number): number {
  const degToRad = (deg: number) => (deg * Math.PI) / 180;
  const radToDeg = (rad: number) => (rad * 180) / Math.PI;

  const phi1 = degToRad(latitude);
  const lambda1 = degToRad(longitude);
  
  // Kaaba Coordinates
  const phi2 = degToRad(21.422487);
  const lambda2 = degToRad(39.826206);
  
  const dLng = lambda2 - lambda1;
  
  const y = Math.sin(dLng);
  const x = Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(dLng);
  
  const qiblaRad = Math.atan2(y, x);
  const qiblaDeg = radToDeg(qiblaRad);
  
  return (qiblaDeg + 360) % 360;
}

/**
 * Calculates the great-circle distance to Mecca (Kaaba) in kilometers using Haversine formula.
 */
export function kibleMesafesiHesapla(latitude: number, longitude: number): number {
  const degToRad = (deg: number) => (deg * Math.PI) / 180;
  
  const R = 6371; // Earth's radius in km
  const phi1 = degToRad(latitude);
  const phi2 = degToRad(21.422487);
  const dPhi = phi2 - phi1;
  const dLng = degToRad(39.826206 - longitude);
  
  const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * GPS kapalıyken kıble pusulası için sistem ayarlarındaki ilçeyi koordinata
 * çevirir (Kıble Pusulası Modalı'ndaki küçük, sabit "bilinen ilçeler"
 * tablosunun dışındaki her ilçe için). Aynı Nominatim servisi ve
 * sessionStorage önbellek deseni `konumVakitleriniCek`'teki ters-geocoding
 * ile aynıdır — burada ise ileri (isimden koordinata) yönde kullanılır.
 * Bulunamazsa/başarısız olursa null döner; çağıran taraf bilinen bir
 * varsayılana düşer ve bunu kullanıcıya açıkça belirtir.
 */
export async function ilceKoordinatlariniCek(ilceAdi: string): Promise<{ lat: number; lng: number } | null> {
  const trimmed = ilceAdi.trim();
  if (!trimmed) return null;

  const cacheKey = `ilce_geo_${trimmed.toLowerCase()}`;
  if (typeof window !== 'undefined') {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${trimmed}, Türkiye`)}&format=json&limit=1&countrycodes=tr`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'MuezzinTakipPro/2.0' }
    });
    if (!response.ok) return null;

    const results = await response.json();
    const first = Array.isArray(results) ? results[0] : null;
    if (!first || typeof first.lat !== 'string' || typeof first.lon !== 'string') return null;

    const coords = { lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
    if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return null;

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(coords));
      } catch (storageErr) {
        console.warn('sessionStorage write error:', storageErr);
      }
    }
    return coords;
  } catch (e) {
    console.warn('İlçe geocoding hatası:', e);
    return null;
  }
}
