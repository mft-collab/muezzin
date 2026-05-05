import { GunlukVakit, AylikVakitler, Vakit } from '../types';
import { Timestamp } from 'firebase/firestore';
import { getTurkeyNow, getTurkeyDateString } from '../lib/dateUtils';

async function fetchWithTimeout(url: string, timeoutMs: number = 6000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(id);
  return response;
}

export async function aylikVakitleriCek(yil: number, ay: number, ilceId: string = "9148", ilceAdi: string = "Ceyhan"): Promise<AylikVakitler> {
  try {
    const response = await fetchWithTimeout(`https://ezanvakti.emushaf.net/vakitler/${ilceId}`);
    if (!response.ok) throw new Error('Diyanet API HTTP error');
    
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Diyanet API formatı geçersiz');
    
    return parseDiyanetResponse(data, ilceId);
  } catch (error) {
    console.warn(`Diyanet API başarısız (${error}), Aladhan API deneniyor...`);
    const fallbackResponse = await fetchWithTimeout(
       `https://api.aladhan.com/v1/calendarByCity/${yil}/${ay}?city=${ilceAdi}&country=Turkey&method=13`
    );
    if (!fallbackResponse.ok) throw new Error('Yedek API de yanıt vermedi');
    
    const fallbackData = await fallbackResponse.json();
    return parseAladhanResponse(fallbackData.data, ilceId);
  }
}

function parseDiyanetResponse(data: any[], ilceId: string): AylikVakitler {
  const aylik: AylikVakitler = {
    ceyhanId: ilceId,
    gunler: {},
    kaynakApi: "diyanet",
    guncellenmeTarihi: Timestamp.now()
  };
  if (Array.isArray(data)) {
    data.forEach((gun: any) => {
      // MiladiTarihKisa formatı 20.04.2026 gibi gelebilir, YYYY-MM-DD'ye çevirelim
      let dateKey = gun.MiladiTarihKisa;
      if (dateKey && dateKey.includes('.')) {
        const [d, m, y] = dateKey.split('.');
        dateKey = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      aylik.gunler[dateKey] = {
        sabah: gun.Imsak,
        ogle: gun.Ogle,
        ikindi: gun.Ikindi,
        aksam: gun.Aksam,
        yatsi: gun.Yatsi
      };
    });
  }
  return aylik;
}

function parseAladhanResponse(data: any[], ilceId: string): AylikVakitler {
  const aylik: AylikVakitler = {
    ceyhanId: ilceId,
    gunler: {},
    kaynakApi: "aladhan",
    guncellenmeTarihi: Timestamp.now()
  };
  data.forEach((gun: any) => {
    const tarih = gun.date.gregorian.date; // DD-MM-YYYY formatında gelebilir
    const [d, m, y] = tarih.split('-');
    const formattedDate = `${y}-${m}-${d}`;
    aylik.gunler[formattedDate] = {
      sabah: gun.timings.Fajr.split(' ')[0],
      ogle: gun.timings.Dhuhr.split(' ')[0],
      ikindi: gun.timings.Asr.split(' ')[0],
      aksam: gun.timings.Maghrib.split(' ')[0],
      yatsi: gun.timings.Isha.split(' ')[0]
    };
  });
  return aylik;
}

export function bugunVakitleriniGetir(vakitlerCache: AylikVakitler): GunlukVakit {
  const bugün = getTurkeyDateString();
  const vakitler = vakitlerCache.gunler ? vakitlerCache.gunler[bugün] : (vakitlerCache as any)[bugün];
  if (!vakitler) throw new Error('Bugünün vakitleri bulunamadı');
  return vakitler;
}

export function mevcutVaktiHesapla(bugunVakitler: GunlukVakit): Vakit {
  const şimdi = getTurkeyNow();
  const vakitler: Vakit[] = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'];

  // Tersten bakıyoruz, geçtiğimiz en son vakit mevcut vakittir.
  for (let i = vakitler.length - 1; i >= 0; i--) {
    const vakit = vakitler[i];
    const [saat, dakika] = bugunVakitler[vakit].split(':').map(Number);
    const ezanSaati = new Date(şimdi);
    ezanSaati.setHours(saat, dakika, 0, 0);

    if (şimdi >= ezanSaati) {
      return vakit;
    }
  }

  // Sabah ezanından önceysek dünkü yatsı vaktindeyizdir
  return 'yatsi';
}

export function sonrakiVaktiHesapla(bugunVakitler: GunlukVakit, yarinVakitler?: GunlukVakit): {
  vakit: Vakit;
  ezanSaati: Date;
  baslangicZamani: Date;
  okudumAcilisZamani: Date;
  t1KilitZamani: Date;
} | null {
  const şimdi = getTurkeyNow();
  const vakitler: Vakit[] = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'];

  let oncekiVakitZamani: Date | null = null;

  // 1. Bugünün kalan vakitlerini ara
  for (let i = 0; i < vakitler.length; i++) {
    const vakit = vakitler[i];
    const [saat, dakika] = bugunVakitler[vakit].split(':').map(Number);
    const ezanSaati = new Date(şimdi);
    ezanSaati.setHours(saat, dakika, 0, 0);

    if (ezanSaati > şimdi) {
      if (i > 0) {
        const [pS, pD] = bugunVakitler[vakitler[i - 1]].split(':').map(Number);
        const pZaman = new Date(şimdi);
        pZaman.setHours(pS, pD, 0, 0);
        oncekiVakitZamani = pZaman;
      } else {
        // Sabah ise net başlangıç için dünün verisi gerekli. Eğer elimizde yoksa 
        // 8 saatlik devasa bir sapma yerine, son 2 saati (veya default) kullanıyoruz
        // çünkü "progress" barı için çok daha tatmin edici bir görsel sağlar.
        oncekiVakitZamani = new Date(ezanSaati.getTime() - 2 * 60 * 60 * 1000);
      }

      return {
        vakit,
        ezanSaati,
        baslangicZamani: oncekiVakitZamani,
        okudumAcilisZamani: new Date(ezanSaati.getTime()),
        t1KilitZamani: new Date(ezanSaati.getTime() - 60 * 60 * 1000)
      };
    }
  }

  // 2. Eğer bugünün tüm vakitleri geçtiyse ve yarının verisi varsa, yarının sabahını döndür
  if (yarinVakitler) {
    const [saat, dakika] = yarinVakitler['sabah'].split(':').map(Number);
    const yarinSabah = new Date(şimdi);
    yarinSabah.setDate(şimdi.getDate() + 1);
    yarinSabah.setHours(saat, dakika, 0, 0);

    // Başlangıç zamanı olarak bugünün yatsısını kullan
    const [yS, yD] = bugunVakitler['yatsi'].split(':').map(Number);
    const bugunYatsi = new Date(şimdi);
    bugunYatsi.setHours(yS, yD, 0, 0);

    return {
      vakit: 'sabah',
      ezanSaati: yarinSabah,
      baslangicZamani: bugunYatsi,
      okudumAcilisZamani: new Date(yarinSabah.getTime()),
      t1KilitZamani: new Date(yarinSabah.getTime() - 60 * 60 * 1000)
    };
  }

  return null;
}

export function yatsiSonrasiZamaniHesapla(yatsiSaati: string): Date {
  const [saat, dakika] = yatsiSaati.split(':').map(Number);
  const zaman = getTurkeyNow();
  zaman.setHours(saat + 1, dakika, 0, 0);
  return zaman;
}
