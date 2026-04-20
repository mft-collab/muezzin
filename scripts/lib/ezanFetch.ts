import fetch from 'node-fetch';
import { GunlukVakit, AylikVakitler } from '../../src/types';
import { Timestamp } from './firebaseAdminInit';

export async function aylikVakitleriCek(yil: number, ay: number): Promise<AylikVakitler> {
  // Diyanet API
  try {
    const url = `https://ezanvakti.emushaf.net/vakitler/9148`;
    console.log(`Diyanet API isteği yapılıyor: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Diyanet API HTTP hatası: ${response.status}`);
      throw new Error('Diyanet API hatası');
    }
    const data = await response.json() as any[];
    if (!Array.isArray(data) || data.length === 0) {
      console.error('Diyanet API boş veya geçersiz veri döndürdü');
      throw new Error('Geçersiz Diyanet verisi');
    }
    console.log(`Diyanet'ten ${data.length} günün verisi alındı.`);
    return parseDiyanetResponse(data);
  } catch (error: any) {
    console.warn(`Diyanet API başarısız (${error.message}), Aladhan API deneniyor...`);
    // Fallback Aladhan
    const response = await fetch(`https://api.aladhan.com/v1/calendarByCity/${yil}/${ay}?city=Ceyhan&country=Turkey&method=13`);
    if (!response.ok) throw new Error('Her iki API de yanıt vermedi');
    const data = await response.json() as any;
    return parseAladhanResponse(data.data);
  }
}

function parseDiyanetResponse(data: any[]): AylikVakitler {
  const aylik: AylikVakitler = {
    ceyhanId: "9148",
    gunler: {},
    kaynakApi: "diyanet",
    guncellenmeTarihi: Timestamp.now() as any
  };
  data.forEach((gun: any) => {
    // MiladiTarihKisa formatı 20.04.2026 gibi gelebilir, YYYY-MM-DD'ye çevirelim
    let dateKey = gun.MiladiTarihKisa;
    if (dateKey.includes('.')) {
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
  return aylik;
}

function parseAladhanResponse(data: any[]): AylikVakitler {
  const aylik: AylikVakitler = {
    ceyhanId: "9148",
    gunler: {},
    kaynakApi: "aladhan",
    guncellenmeTarihi: Timestamp.now() as any
  };
  data.forEach((gun: any) => {
    const tarih = gun.date.gregorian.date;
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
