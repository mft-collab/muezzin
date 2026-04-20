import fetch from 'node-fetch';
import { GunlukVakit, AylikVakitler } from '../../src/types';
import { Timestamp } from './firebaseAdminInit';

export async function aylikVakitleriCek(yil: number, ay: number): Promise<AylikVakitler> {
  // Diyanet API
  try {
    const response = await fetch(`https://ezanvakti.emushaf.net/vakitler/9148`);
    if (!response.ok) throw new Error('Diyanet API hatası');
    const data = await response.json() as any[];
    return parseDiyanetResponse(data);
  } catch (error) {
    console.warn('Diyanet API başarısız, Aladhan API deneniyor...', error);
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
    guncellenmeTarihi: Timestamp.now()
  };
  data.forEach((gun: any) => {
    aylik.gunler[gun.MiladiTarihKisa] = {
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
    guncellenmeTarihi: Timestamp.now()
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
