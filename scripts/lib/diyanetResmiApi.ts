// NOT: `firebase/firestore` (Admin SDK'nın Timestamp'i DEĞİL) — src/types.ts
// `Vakitler.guncellenmeTarihi` bu tiple tanımlı ve src/services/ezanVaktiServisi.ts'in
// mevcut parser'ları (parseDiyanetResponse/parseAladhanResponse) da aynı
// deseni izliyor. Zararsız: her iki çağıran script de (aylikEzanTakvimiGuncelle.ts,
// vakitVeriSagligiKontrol.ts) Firestore'a yazmadan önce bu alanı kendi
// Admin SDK Timestamp'iyle zaten YENİDEN YAZIYOR — burası yalnızca ara
// tip uyumu için var, hiçbir zaman bu haliyle Firestore'a gitmiyor.
import { Timestamp } from 'firebase/firestore';
import type { Vakitler, VakitKaydi } from '../../src/types.ts';
import { aylikVakitleriCek } from '../../src/services/ezanVaktiServisi.ts';

/**
 * DİYANET RESMİ NAMAZ VAKTİ API'Sİ (awqatsalah.diyanet.gov.tr)
 * ---------------------------------------------------------------
 * `src/services/ezanVaktiServisi.ts`'teki mevcut zincir (emushaf.net proxy →
 * Aladhan) tamamen ANAHTARSIZ (public) API'lere dayanıyor — bu yüzden hem
 * tarayıcıdan hem sunucudan güvenle çağrılabiliyor. Resmi Diyanet servisi
 * ise e-posta/şifre ile JWT login gerektiriyor; bu kimlik bilgileri
 * TARAYICI paketine asla girmemeli (herkese açık bundle'da sızar). Bu
 * yüzden bu dosya BİLİNÇLİ OLARAK `scripts/lib/` altında, yalnızca Admin
 * SDK bağlamında çalışan cron script'lerinden (aylikEzanTakvimiGuncelle.ts,
 * vakitVeriSagligiKontrol.ts) import edilecek şekilde tutuluyor —
 * `src/services/ezanVaktiServisi.ts` (hem tarayıcı hem sunucu tarafından
 * paylaşılan modül) bu dosyayı ASLA import etmemeli.
 *
 * Kota (bkz. resmi kılavuz "İstek Kotası"): Standart rol altında endpoint +
 * parametre başına günde 5 istek. Bu entegrasyon günde en fazla 2 kez
 * çalışır (aylık cron + günlük sağlık kontrolü, ki ikisi neredeyse hiç aynı
 * ilçe/gün için üst üste binmez), her çalışma da CityDetail + Monthly için
 * birer istek yapar — bu yüzden token'ı çalıştırmalar arası önbelleğe almaya
 * gerek yok, her çalıştırma kendi Login'ini yapar (Login de aynı kotaya tabi
 * olsa bile günde en fazla 2 istekle çok altında kalınır).
 */

const BASE_URL = 'https://awqatsalah.diyanet.gov.tr';

interface LoginResponse {
  data?: { accessToken?: string; refreshToken?: string };
  success?: boolean;
  message?: string | null;
}

interface CityDetailResponse {
  data?: { id?: string | number; name?: string };
  success?: boolean;
  message?: string | null;
}

interface MonthlyGunRaw {
  fajr?: string;
  sunrise?: string;
  dhuhr?: string;
  asr?: string;
  maghrib?: string;
  isha?: string;
  /** Örn: "2026-08-29T00:00:00.0000000+03:00" — tarih kısmı gerçekten
   *  ISO-8601. `gregorianDateShortIso8601` alanı adına rağmen "dd.mm.yyyy"
   *  formatındadır (resmi kılavuzdaki örnek de böyle), bu yüzden
   *  kasıtlı olarak KULLANILMIYOR. */
  gregorianDateLongIso8601?: string;
}

interface MonthlyResponse {
  data?: MonthlyGunRaw[];
  success?: boolean;
  message?: string | null;
}

async function login(email: string, password: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/Auth/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const result = (await response.json().catch(() => null)) as LoginResponse | null;
  if (!response.ok || !result?.success || !result.data?.accessToken) {
    throw new Error(
      `Diyanet resmi API girişi başarısız (HTTP ${response.status}): ${result?.message || 'bilinmeyen hata'}`
    );
  }
  return result.data.accessToken;
}

/**
 * `ilceId` (uygulamanın settings/system'de tuttuğu, emushaf.net proxy'siyle
 * paylaşılan klasik Diyanet ilçe kodu) resmi API'nin `cityId`'siyle AYNI
 * numaralandırmayı mı kullanıyor bilinmiyor — iki servis ayrı sistemler.
 * Körü körüne güvenmek yerine `/api/Place/CityDetail/{ilceId}` ile
 * doğrulanır: dönen `name` beklenen `ilceAdi` ile (büyük/küçük harf ve
 * Türkçe karakter farkını yok sayarak) örtüşmüyorsa cityId YANLIŞ demektir
 * — bu durumda resmi API katmanı atlanır (çağıran taraf mevcut zincire
 * düşer), yanlış ilçenin vakitleri asla yazılmaz.
 */
function turkceNormalize(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]/g, '');
}

async function cityIdDogrula(accessToken: string, ilceId: string, ilceAdi: string): Promise<boolean> {
  const response = await fetch(`${BASE_URL}/api/Place/CityDetail/${ilceId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const result = (await response.json().catch(() => null)) as CityDetailResponse | null;
  if (!response.ok || !result?.success || !result.data?.name) return false;

  const donenAd = turkceNormalize(result.data.name);
  const beklenenAd = turkceNormalize(ilceAdi.split(',')[0] || ilceAdi);
  return donenAd === beklenenAd || donenAd.includes(beklenenAd) || beklenenAd.includes(donenAd);
}

function parseResmiResponse(data: MonthlyGunRaw[], ilceId: string): Vakitler {
  const gunler: Record<string, VakitKaydi> = {};
  data.forEach((gun) => {
    const isoUzun = gun.gregorianDateLongIso8601;
    if (typeof isoUzun !== 'string' || isoUzun.length < 10) {
      console.warn('Diyanet resmi API: gün verisi eksik/bozuk, atlandı:', gun);
      return;
    }
    const dateKey = isoUzun.slice(0, 10); // "YYYY-MM-DD"
    if (!gun.fajr || !gun.sunrise || !gun.dhuhr || !gun.asr || !gun.maghrib || !gun.isha) {
      console.warn('Diyanet resmi API: vakit alanı eksik, atlandı:', dateKey);
      return;
    }
    gunler[dateKey] = {
      sabah: gun.fajr,
      gunes: gun.sunrise,
      ogle: gun.dhuhr,
      ikindi: gun.asr,
      aksam: gun.maghrib,
      yatsi: gun.isha
    };
  });

  if (Object.keys(gunler).length === 0) {
    throw new Error('Diyanet resmi API: ayrıştırılabilir gün verisi bulunamadı.');
  }

  return {
    ilceId,
    gunler,
    // firestore.rules `isValidVakitCache` ve src/types.ts `Vakitler.kaynakApi`
    // ile senkron tutulmalı — emushaf proxy'sinden ayırt edebilmek için AYRI
    // bir değer (ikisi de "Diyanet" kaynaklı olsa da, hangisinin fiilen
    // kullanıldığını admin panelinde (EzanOnbellegi.tsx) görebilmek
    // için).
    kaynakApi: 'diyanet-resmi',
    guncellenmeTarihi: Timestamp.now()
  };
}

/**
 * Resmi Diyanet API'sinden aylık vakit çeker. Kimlik bilgileri eksikse
 * (henüz `DIYANET_API_EMAIL`/`DIYANET_API_PASSWORD` secret'ları
 * eklenmemişse) veya herhangi bir adımda hata olursa fırlatır — çağıran
 * taraf (bkz. `vakitleriCekOncelikli` altta) mevcut public zincire düşer.
 */
export async function resmiDiyanetVakitleriCek(ilceId: string, ilceAdi: string): Promise<Vakitler> {
  const email = process.env.DIYANET_API_EMAIL;
  const password = process.env.DIYANET_API_PASSWORD;
  if (!email || !password) {
    throw new Error('DIYANET_API_EMAIL/DIYANET_API_PASSWORD tanımlı değil, resmi API atlanıyor.');
  }

  const accessToken = await login(email, password);

  const cityIdGecerli = await cityIdDogrula(accessToken, ilceId, ilceAdi);
  if (!cityIdGecerli) {
    throw new Error(
      `Diyanet resmi API: ilçe ID doğrulanamadı (ilceId=${ilceId}, beklenen ad="${ilceAdi}") — cityId numaralandırması emushaf.net ile örtüşmüyor olabilir.`
    );
  }

  const response = await fetch(`${BASE_URL}/api/PrayerTime/Monthly/${ilceId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const result = (await response.json().catch(() => null)) as MonthlyResponse | null;
  if (!response.ok || !result?.success || !Array.isArray(result.data)) {
    throw new Error(
      `Diyanet resmi API: aylık vakit isteği başarısız (HTTP ${response.status}): ${result?.message || 'bilinmeyen hata'}`
    );
  }

  return parseResmiResponse(result.data, ilceId);
}

/**
 * Sunucu bağlamındaki (Admin SDK) çağıranlar için TEK giriş noktası: önce
 * resmi Diyanet API'sini dener, herhangi bir sebeple başarısız olursa
 * (kimlik bilgisi yok, kota, ağ hatası, cityId uyuşmazlığı) mevcut public
 * zincire (emushaf.net → Aladhan, bkz. `aylikVakitleriCek`) düşer — bu
 * script'lerin daha önce sahip olduğu dayanıklılığı KORUR, yalnızca yeni bir
 * tercih edilen birincil kaynak ekler.
 */
export async function vakitleriCekOncelikli(
  yil: number,
  ay: number,
  ilceId: string,
  ilceAdi: string
): Promise<Vakitler> {
  try {
    const sonuc = await resmiDiyanetVakitleriCek(ilceId, ilceAdi);
    console.log(`Diyanet resmi API'den ${Object.keys(sonuc.gunler).length} gün alındı (ilceId=${ilceId}).`);
    return sonuc;
  } catch (err) {
    console.warn('Diyanet resmi API başarısız, mevcut zincire (emushaf/Aladhan) düşülüyor:', err instanceof Error ? err.message : err);
    return aylikVakitleriCek(yil, ay, ilceId, ilceAdi);
  }
}
