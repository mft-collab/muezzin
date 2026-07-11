import { Muezzin, Vakit, VakitAtama } from '../types';
import { tieBreakerSirala } from '../utils/tieBreaker';

export const VAKITLER: Vakit[] = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'];
export const SISTEM_ATAMA: VakitAtama = { asil: 'Sistem', yedek: 'Sistem' };

export interface OnayliIzin {
  uid: string;
  baslangic: string;
  bitis: string;
}

export type MuezzinAday = Muezzin & { id: string };

/**
 * Belirli bir gün+vakit için mevcut/korunmuş bir atama varsa döndürür (ör.
 * zaten onaylanmış/reddedilmiş ya da görev çağrısı yapılmış bir bildirim).
 * Böyle bir atama varsa taze hesaplama YAPILMAZ, doğrudan bu kullanılır —
 * ancak haftalık yük dengesine yine de dahil edilir.
 */
export type KorunmusAtamaResolver = (gun: string, vakit: Vakit) => VakitAtama | null;

function sistemDisiUidler(atama: VakitAtama): string[] {
  return [atama.asil, atama.yedek].filter((uid) => uid && uid !== 'Sistem' && uid !== 'SISTEM');
}

/**
 * Bir haftalık nöbet planını (gün → vakit → {asil, yedek}) saf (yan etkisiz)
 * biçimde üretir. Bu, hem gece cron'unun (scripts/haftalikPlanOlustur.ts)
 * hem de istemci "self-healing" servisinin (src/services/planServisi.ts)
 * kullandığı TEK atama çekirdeğidir — atama kuralları (onaylı izindeki veya
 * sabit haftalık izin gününde olan personel ASLA atanmaz, haftalık yük
 * dengesi, Cuma ağırlığı, art arda dinlenme) yalnızca burada tanımlıdır.
 *
 * `korunmusAtama` verilirse (self-heal senaryosu), o gün/vakit için zaten
 * var olan bir atama varsa taze hesaplama atlanır; sonuç yine de haftalık
 * yük dengesine ve "önceki vakit" dinlenme kuralına dahil edilir.
 */
export function haftalikPlanUret(
  gunler: string[],
  muezzinler: MuezzinAday[],
  onayliIzinler: OnayliIzin[],
  korunmusAtama?: KorunmusAtamaResolver
): Record<string, Record<Vakit, VakitAtama>> {
  const buHaftakiYukler: Record<string, number> = {};
  muezzinler.forEach((m) => {
    buHaftakiYukler[m.id] = 0;
  });

  const gunPlan: Record<string, Record<Vakit, VakitAtama>> = {};
  let oncekiVakitUidler: string[] = [];

  for (const gun of gunler) {
    gunPlan[gun] = {} as Record<Vakit, VakitAtama>;

    const [gY, gM, gD] = gun.split('-').map(Number);
    const gunTarihi = new Date(gY, gM - 1, gD);
    // Pazartesi=1 ... Pazar=7 (haftalikIzinGunu ile aynı ölçek)
    const gunIndex = (gunTarihi.getDay() + 6) % 7;
    const isFriday = gunTarihi.getDay() === 5;

    const bugunIzinliUidler = onayliIzinler
      .filter((izin) => gun >= izin.baslangic && gun <= izin.bitis)
      .map((izin) => izin.uid);

    const musaitMuezzinler = muezzinler.filter((m) => {
      const isOnIzin = bugunIzinliUidler.includes(m.id);
      const isFixedDayOff = m.haftalikIzinGunu === gunIndex + 1;
      return !isOnIzin && !isFixedDayOff;
    });

    let gunlukTazeAtama: VakitAtama = SISTEM_ATAMA;
    if (musaitMuezzinler.length >= 2) {
      const sirali = tieBreakerSirala(musaitMuezzinler, buHaftakiYukler, oncekiVakitUidler, isFriday);
      gunlukTazeAtama = { asil: sirali[0].id, yedek: sirali[1].id };
    } else if (musaitMuezzinler.length === 1) {
      gunlukTazeAtama = { asil: musaitMuezzinler[0].id, yedek: 'Sistem' };
    }

    let gununSonEkibi: string[] = [];

    for (const vakit of VAKITLER) {
      const atama = korunmusAtama?.(gun, vakit) ?? gunlukTazeAtama;
      gunPlan[gun][vakit] = atama;

      sistemDisiUidler(atama).forEach((uid) => {
        buHaftakiYukler[uid] = (buHaftakiYukler[uid] || 0) + 1;
      });
      gununSonEkibi = sistemDisiUidler(atama);
    }

    oncekiVakitUidler = gununSonEkibi;
  }

  return gunPlan;
}
