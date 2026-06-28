/**
 * useOzelVakitMesaji.ts — Özel Dini Vakit Mesajı Hook
 *
 * Gerçek zamanlı olarak şu mesaj tiplerini hesaplar:
 *  - kerahat        : Nafile namaz yasaklı vakitler (Hanefî / Diyanet)
 *  - teheccud       : Gece son üçte birlik dilimi hatırlatması
 *  - bayram_arife   : Bayramdan bir gün önce hazırlık mesajı
 *  - bayram         : Bayram namazı vakti
 *  - tesrik         : Kurban günlerinde farz namazı öncesi/sonrası tekbir hatırlatması
 */

import { useMemo } from 'react';
import { GunlukVakit, Vakit } from '../types';
import { parseVakitToDate, calculateKerahatTimes, calculateLastThirdOfNight } from '../lib/dateUtils';
import {
  isRamazanBayram,
  isKurbanBayram,
  isRamazanBayramArife,
  isKurbanBayramArife,
  isRamazanArifeOncesi,
  isKurbanArifeOncesi,
  isRamazanBaslangiciOncesi,
  isTesrikGunu,
  isSonTesrikGunu,
  parseHijriDate,
} from '../lib/islamicCalendar';
import { format } from 'date-fns';
import { useSystemSettingsStore } from '../store/useSystemSettingsStore';

export type OzelVakitTip =
  | 'kerahat_dogus'
  | 'kerahat_zeval'
  | 'kerahat_gurub'
  | 'teheccud'
  | 'bayram_arife'
  | 'bayram'
  | 'tesrik'
  | 'cuma'
  | null;

export type TesrikVakitRenk = 'emerald' | 'amber' | 'orange' | 'rose' | 'violet';

export interface OzelVakitDurumu {
  tip: OzelVakitTip;
  baslik: string;
  altBaslik: string;
  aciklama: string;
  arapca?: string;
  transkript?: string;
  /** Teşrik için mevcut vakit rengi */
  tesrikVakitRenk?: TesrikVakitRenk;
  /** Mesajın biteceği zaman (geri sayım için) */
  bitisZamani?: Date;
}

// Teşrik tekbiri metni
const TESRIK_TEKBIR_ARAPCA =
  'اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ لَا إِلَهَ إِلَّا اللَّهُ وَاللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ وَلِلَّهِ الْحَمْدُ';
const TESRIK_TEKBIR_TRANSKRIPT =
  'Allahu Ekber, Allahu Ekber. Lâ ilâhe illallah. Vallahu Ekber, Allahu Ekber. Ve lillâhil hamd.';

/** Vakit adına göre teşrik banner rengi */
function getTesrikRenk(vakit: Vakit | null): TesrikVakitRenk {
  switch (vakit) {
    case 'sabah':  return 'emerald';
    case 'ogle':   return 'amber';
    case 'ikindi': return 'orange';
    case 'aksam':  return 'rose';
    case 'yatsi':  return 'violet';
    default:       return 'violet';
  }
}

/**
 * Ana hook
 * @param bugunVakitler - Bugünkü namaz vakitleri (string "HH:MM")
 * @param bugunDate     - Bugünün tarih nesnesi
 * @param now           - Gerçek zamanlı saat (useTime() hook'undan)
 * @param mevcutVakit   - Aktif vakit
 */
export function useOzelVakitMesaji(
  bugunVakitler: GunlukVakit | null,
  bugunDate: Date,
  now: Date,
  mevcutVakit: Vakit | null
): OzelVakitDurumu {
  const { settings } = useSystemSettingsStore();

  return useMemo<OzelVakitDurumu>(() => {
    const NULL_DURUM: OzelVakitDurumu = { tip: null, baslik: '', altBaslik: '', aciklama: '' };

    if (!bugunVakitler) return NULL_DURUM;

    const dateStr = format(bugunDate, 'yyyy-MM-dd');

    // Tüm vakit nesnelerini parse et
    const sabahDate  = parseVakitToDate(dateStr, bugunVakitler.sabah);
    const imsakDate  = parseVakitToDate(dateStr, bugunVakitler.imsak || bugunVakitler.sabah);
    const gunesDate  = parseVakitToDate(dateStr, bugunVakitler.gunes);
    const ogleDate   = parseVakitToDate(dateStr, bugunVakitler.ogle);
    const ikindiDate = parseVakitToDate(dateStr, bugunVakitler.ikindi);
    const aksamDate  = parseVakitToDate(dateStr, bugunVakitler.aksam);
    const yatsiDate  = parseVakitToDate(dateStr, bugunVakitler.yatsi);

    // Bir sonraki güne ait imsak (sabah) = 24 saat sonra
    const yarinSabahDate = sabahDate
      ? new Date(sabahDate.getTime() + 24 * 60 * 60 * 1000)
      : null;

    const yarinImsakDate = imsakDate
      ? new Date(imsakDate.getTime() + 24 * 60 * 60 * 1000)
      : null;

    // Yatsı'dan imsak'a olan gece aralığı (teheccüd hesabı için)
    // calculateLastThirdOfNight(aksam, imsak) API'si mevcut — bunu yatsi→yarinSabah aralığı üzerinden kullanıyoruz
    // ancak gece uzunluğu aksamdan imsaksa daha doğru hesaplanır
    const geceBaslangicDate = aksamDate; // Gece akşamdan başlar
    const geceBitisDate = yarinImsakDate;  // İmsak = astronomik imsak vaktidir (sabah namazı saati değil)

    // ─────────────────────────────────────────────────────
    // 1. BAYRAM NAMAZI VAKTİ (güneş doğuşu + 40 dk → Öğle)
    // ─────────────────────────────────────────────────────
    const isRB = isRamazanBayram(bugunDate);
    const isKB = isKurbanBayram(bugunDate);

    if ((isRB || isKB) && gunesDate && ogleDate) {
      const bayramBaslangic = new Date(gunesDate.getTime() + 40 * 60 * 1000);
      if (now >= bayramBaslangic && now < ogleDate) {
        const bayramTuru = isRB ? 'Ramazan' : 'Kurban';
        return {
          tip: 'bayram',
          baslik: `${bayramTuru} Bayramı Namazı`,
          altBaslik: 'BAYRAM NAMAZI VAKTİ',
          aciklama: `Bayram namazı şu anda kılınabilir. Öğle ezanına kadar vakti devam eder.`,
          bitisZamani: ogleDate,
        };
      }
    }

    // ─────────────────────────────────────────────────────
    // 2. TEŞRİK TEKBİRLERİ (9–13 Zilhicce)
    // Her namaz vaktinden 30 dk önce → bir sonraki ezana kadar
    // ─────────────────────────────────────────────────────
    if (isTesrikGunu(bugunDate)) {
      const vakitler: Array<{ vakit: Vakit; date: Date | null; sonraki: Date | null }> = [
        { vakit: 'sabah',  date: sabahDate,  sonraki: ogleDate },
        { vakit: 'ogle',   date: ogleDate,   sonraki: ikindiDate },
        { vakit: 'ikindi', date: ikindiDate, sonraki: aksamDate },
        { vakit: 'aksam',  date: aksamDate,  sonraki: yatsiDate },
        { vakit: 'yatsi',  date: yatsiDate,  sonraki: yarinSabahDate },
      ];

      for (const v of vakitler) {
        if (!v.date) continue;

        // Son teşrik günü İkindi sonrası teşrik biter
        if (isSonTesrikGunu(bugunDate) && v.vakit === 'ikindi' && v.sonraki) {
          const hazirlikBaslangic = new Date(v.date.getTime() - 30 * 60 * 1000);
          if (now >= hazirlikBaslangic && now < v.sonraki) {
            return {
              tip: 'tesrik',
              baslik: 'Teşrik Tekbirleri',
              altBaslik: `${v.vakit.toUpperCase()} NAMAZI`,
              aciklama: 'Son teşrik vakti. Bu namazın ardından teşrik tekbirleri tamamlanır.',
              arapca: TESRIK_TEKBIR_ARAPCA,
              transkript: TESRIK_TEKBIR_TRANSKRIPT,
              tesrikVakitRenk: getTesrikRenk(v.vakit),
              bitisZamani: v.sonraki,
            };
          }
          // İkindiden sonra teşrik bitti — gösterme
          if (v.sonraki && now >= v.sonraki) break;
          continue;
        }

        const hazirlikBaslangic = new Date(v.date.getTime() - 30 * 60 * 1000);
        const sonrakiEzan = v.sonraki;

        if (sonrakiEzan && now >= hazirlikBaslangic && now < sonrakiEzan) {
          const { day: zilhicceGunu } = parseHijriDate(bugunDate);
          const gunAciklama =
            zilhicceGunu === 9 ? 'Arefe günü' :
            zilhicceGunu === 10 ? 'Kurban Bayramı 1. gün' :
            zilhicceGunu === 11 ? 'Kurban Bayramı 2. gün' :
            zilhicceGunu === 12 ? 'Kurban Bayramı 3. gün' : 'Son teşrik günü';
          return {
            tip: 'tesrik',
            baslik: 'Teşrik Tekbirleri',
            altBaslik: `${v.vakit.toUpperCase()} NAMAZI`,
            aciklama: `${gunAciklama} — Her farz namazdan sonra teşrik tekbiri getirilir.`,
            arapca: TESRIK_TEKBIR_ARAPCA,
            transkript: TESRIK_TEKBIR_TRANSKRIPT,
            tesrikVakitRenk: getTesrikRenk(v.vakit),
            bitisZamani: sonrakiEzan,
          };
        }
      }
    }

    // ─────────────────────────────────────────────────────
    // 3. BAYRAM AREFESİ (Arefe günü boyu gösterilir, namaz vakitlerinde teşrik tekbiri önceliklidir)
    // ─────────────────────────────────────────────────────
    const isRBArife = isRamazanBayramArife(bugunDate);
    const isKBArife = isKurbanBayramArife(bugunDate);

    if ((isRBArife || isKBArife) && aksamDate) {
      const bayramTuru = isRBArife ? 'Ramazan' : 'Kurban';
      // Bitiş: Yarın güneş doğuşu (bayram namazı başlamadan önce)
      const yarinGunesDate = gunesDate
        ? new Date(gunesDate.getTime() + 24 * 60 * 60 * 1000)
        : null;
      return {
        tip: 'bayram_arife',
        baslik: `${bayramTuru} Bayramınız Mübarek Olsun`,
        altBaslik: 'YARIN BAYRAM NAMAZI',
        aciklama: isKBArife 
          ? 'Yarın bayram namazına hazırlıklı olunuz. Farz namazların ardından Teşrik Tekbiri getirmeyi unutmayınız.'
          : 'Yarın bayram namazına hazırlıklı olunuz. Güneş doğumundan yaklaşık 40 dakika sonra kılınır.',
        bitisZamani: yarinGunesDate ?? undefined,
      };
    }

    // ─────────────────────────────────────────────────────
    // 3b. AREFE GÜNÜNDEN 1 GÜN ÖNCESİ (Arefe Hazırlığı - Gün boyu gösterilir)
    // ─────────────────────────────────────────────────────
    const isRBArifeOncesi = isRamazanArifeOncesi(bugunDate);
    const isKBArifeOncesi = isKurbanArifeOncesi(bugunDate);

    if ((isRBArifeOncesi || isKBArifeOncesi) && aksamDate) {
      const bayramTuru = isRBArifeOncesi ? 'Ramazan' : 'Kurban';
      // Bitiş: Yarın sabah (Arefe sabahı itibarıyla bu banner biter ve yerine Arefe günü bannerı gelir)
      const yarinSabahDate = new Date(aksamDate.getTime() + 12 * 60 * 60 * 1000);
      return {
        tip: 'bayram_arife',
        baslik: `${bayramTuru} Bayramı Arefesi Yaklaşıyor`,
        altBaslik: 'YARIN AREFE GÜNÜ',
        aciklama: isKBArifeOncesi
          ? 'Yarın Kurban Bayramı Arefesidir. Yarın sabah namazından itibaren her farz namazın ardından Teşrik Tekbiri getirilmeye başlanacaktır.'
          : 'Yarın Ramazan Bayramı Arefesidir. Yarınki günü dua, ibadet ve bayram hazırlıklarıyla geçirmeye gayret edelim.',
        bitisZamani: yarinSabahDate,
      };
    }

    // ─────────────────────────────────────────────────────
    // 3c. RAMAZAN BAŞLANGICI (1 Gün Öncesi - İlk Sahur & Teravih Gecesi)
    // ─────────────────────────────────────────────────────
    const isRamazanOncesi = isRamazanBaslangiciOncesi(bugunDate);

    if (isRamazanOncesi && aksamDate) {
      // Bitiş: Yarın sabah (Ramazan'ın ilk günü sabahı)
      const yarinSabahDate = new Date(aksamDate.getTime() + 12 * 60 * 60 * 1000);
      return {
        tip: 'bayram_arife',
        baslik: 'Ramazan-ı Şerif Başlıyor',
        altBaslik: 'BU GECE İLK SAHUR & TERAVİH',
        aciklama: 'Yarın Ramazan-ı Şerif\'in ilk günüdür. Bu akşam yatsı namazıyla birlikte ilk Teravih kılınacak ve gece ilk Sahur\'a kalkılacaktır. Mübarek olsun!',
        bitisZamani: yarinSabahDate,
      };
    }

    // ─────────────────────────────────────────────────────
    // 4. KERAHAT VAKİTLERİ (Hanefî / Diyanet standardı)
    // ─────────────────────────────────────────────────────
    if (gunesDate && ogleDate && aksamDate) {
      const kerahat = calculateKerahatTimes(gunesDate, ogleDate, aksamDate);

      // Doğuş kerahati (Güneş doğuşu → +40 dk)
      if (now >= kerahat.sabah.baslangic && now < kerahat.sabah.bitis) {
        return {
          tip: 'kerahat_dogus',
          baslik: 'Kerahat Vakti',
          altBaslik: 'GÜNEŞ DOĞUŞU KERÂHATİ',
          aciklama: 'Güneş doğuşu tamamlanıyor. Bu sürede nafile namaz kılmak mekruhtur.',
          bitisZamani: kerahat.sabah.bitis,
        };
      }

      // Zeval kerahati (Öğle'den 15 dk önce → Öğle)
      const zevalBaslangic = new Date(ogleDate.getTime() - 15 * 60 * 1000);
      if (now >= zevalBaslangic && now < ogleDate) {
        return {
          tip: 'kerahat_zeval',
          baslik: 'Kerahat Vakti',
          altBaslik: 'ZEVAL KERÂHATİ',
          aciklama: 'Güneş tam tepedeyken nafile namaz kılmak mekruhtur. Öğle ezanı bekleniyor.',
          bitisZamani: ogleDate,
        };
      }

      // Gurub kerahati (Akşam'dan 40 dk önce → Akşam)
      if (now >= kerahat.aksam.baslangic && now < kerahat.aksam.bitis) {
        return {
          tip: 'kerahat_gurub',
          baslik: 'Kerahat Vakti',
          altBaslik: 'GÜNEŞ BATIŞI KERÂHATİ',
          aciklama: 'Güneş ufka yaklaşıyor. Akşam ezanına kadar nafile namaz kılmak mekruhtur.',
          bitisZamani: kerahat.aksam.bitis,
        };
      }
    }

    // ─────────────────────────────────────────────────────
    // 5. TEHECCÜD VAKTİ (Gecenin son 1/3'ü)
    // calculateLastThirdOfNight(akşam, imsak) — gece akşamdan imsakla bölünür
    // ─────────────────────────────────────────────────────
    if (geceBaslangicDate && geceBitisDate && yatsiDate) {
      const teheccudBaslangic = calculateLastThirdOfNight(geceBaslangicDate, geceBitisDate);
      // İmsak'tan 15 dk önce kadar göster (ekran çok geç kapatılmasın)
      const teheccudBitis = new Date(geceBitisDate.getTime() - 15 * 60 * 1000);

      // Sadece yatsı namazından sonra göster
      if (now >= yatsiDate && now >= teheccudBaslangic && now < teheccudBitis) {
        return {
          tip: 'teheccud',
          baslik: 'Teheccüd Vakti',
          altBaslik: 'GECENİN SON ÜÇTE BİRİ',
          aciklama: 'Teheccüd namazı için en faziletli zaman. İmsak ezanından önce kılınmalıdır.',
          bitisZamani: teheccudBitis,
        };
      }
    }

    // Cuma Günü (İmsak ile Akşam ezanı arasında)
    const isFriday = bugunDate.getDay() === 5;
    if (isFriday && imsakDate && aksamDate) {
      if (now >= imsakDate && now < aksamDate) {
        return {
          tip: 'cuma',
          baslik: 'Hayırlı Cumalar',
          altBaslik: 'CUMA GÜNÜ',
          aciklama: 'Bugün Müslümanların haftalık bayramıdır. Günün hayrı, bereketi ve huzuru üzerinize olsun.',
          bitisZamani: aksamDate,
        };
      }
    }

    return NULL_DURUM;
  }, [bugunVakitler, bugunDate, now, settings.hicriDuzeltme]);
}
