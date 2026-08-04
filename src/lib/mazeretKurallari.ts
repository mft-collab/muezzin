import { Vakit } from '../types';
import { isFriday } from './dateUtils';

/**
 * Mazeret bildirimi/görev devri son başvuru süresi: ezan vaktine 1 saat
 * kalana kadar açık. Sabah vakti istisnası aşağıda `mazeretKapaliMi`'de
 * ayrıca ele alınır (bkz. dosya başı açıklaması).
 */
export const MAZERET_SON_BASVURU_DAKIKA = 60;

export interface MazeretZamanGirdisi {
  /** Görevin ait olduğu günün takvim tarihi (Cuma kontrolü için). */
  gunTarihi: Date;
  vakit: Vakit;
  /** Bugünün ilgili vaktinin ezan saati — sabah dışındaki vakitlerde kullanılır. */
  vakitSaati: Date | null;
  /** Bir önceki günün yatsı ezan saati — yalnızca vakit==='sabah' iken kullanılır. */
  oncekiGunYatsiSaati: Date | null;
}

export interface MazeretDurumu {
  kapali: boolean;
  sebep?: string;
}

/**
 * Bir görev için mazeret bildirimi/görev devri penceresinin açık olup
 * olmadığına karar verir (saf fonksiyon — Firestore'dan çekilen ezan
 * saatleri çağıran tarafça hazırlanır, bkz. src/services/mazeretServisi.ts).
 *
 * Kurallar:
 *  1. Cuma günleri (hangi vakit olursa olsun) mazeret tamamen kapalıdır —
 *     haftalık Cuma nöbetinin aksamaması için (bkz. aynı kısıtlamanın izin
 *     taleplerindeki karşılığı: src/components/VacationRequestCard.tsx).
 *  2. Sabah vakti hariç: pencere, o vaktin ezanına 1 saat kalana kadar açık.
 *  3. Sabah vakti: kullanıcıdan gece yarısından sonra (uykudayken) mazeret
 *     girmesi beklenemeyeceği için pencere, sabahın kendi saatine göre değil,
 *     bir önceki akşamki yatsı ezanından 1 saat sonrasına göre kapanır.
 */
export function mazeretKapaliMi(girdi: MazeretZamanGirdisi, suAn: Date): MazeretDurumu {
  if (isFriday(girdi.gunTarihi)) {
    return { kapali: true, sebep: 'Cuma günleri için mazeret bildirimi/görev devri kullanılamaz.' };
  }

  const sabahIstisnasi = girdi.vakit === 'sabah';
  const referansSaat = sabahIstisnasi ? girdi.oncekiGunYatsiSaati : girdi.vakitSaati;

  // Referans saat bilinmiyorsa (ör. vakit verisi henüz önbelleğe alınmamış)
  // süre kısıtlaması uygulanamaz — mevcut davranış (kısıtlamasız izin) korunur.
  if (!referansSaat) return { kapali: false };

  const sonBasvuru = sabahIstisnasi
    ? new Date(referansSaat.getTime() + MAZERET_SON_BASVURU_DAKIKA * 60000)
    : new Date(referansSaat.getTime() - MAZERET_SON_BASVURU_DAKIKA * 60000);

  if (suAn >= sonBasvuru) {
    return {
      kapali: true,
      sebep: sabahIstisnasi
        ? 'Sabah vakti için mazeret bildirimi süresi (yatsıdan 1 saat sonrası) doldu.'
        : 'Ezan vaktine 1 saatten az kaldığı için görev devri/mazeret bildirimi kapalıdır.'
    };
  }

  return { kapali: false };
}
