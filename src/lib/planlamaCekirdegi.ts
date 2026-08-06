import { Muezzin, Vakit, VakitAtama } from '../types';
import { tieBreakerSirala, YEDEK_YUK_CARPANI } from '../utils/tieBreaker';
import { isFriday as isFridayTarih } from './dateUtils';

export const VAKITLER: Vakit[] = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'];
export const SISTEM_ATAMA: VakitAtama = { asil: 'Sistem', yedek: 'Sistem' };
// YEDEK_YUK_CARPANI artık src/utils/tieBreaker.ts'te tanımlı (kalıcı aylık
// yedek sayacı da aynı ağırlığı kullanmak zorunda — bkz. mimari denetim K6);
// burada geriye dönük uyumluluk için yeniden dışa aktarılıyor.
export { YEDEK_YUK_CARPANI };

export interface OnayliIzin {
  uid: string;
  baslangic: string;
  bitis: string;
}

/**
 * Bir personelin nöbete atanabilir olup olmadığını belirler — çağıran
 * taraflar (scripts/haftalikPlanOlustur.ts, src/services/planServisi.ts)
 * `haftalikPlanUret`'e geçirdikleri `muezzinler` listesini bununla filtreler.
 * `onayBekliyor: true` olan (admin henüz onaylamamış) bir davetli, kendi
 * profilini oluşturduğu andan itibaren `aktif: true` olsa da nöbete
 * atanmamalı — `AuthGuard` ona zaten bir bekleme ekranı gösterdiğinden,
 * atandığı vakit kimsenin göremeyeceği şekilde sessizce boş kalıyordu (bkz.
 * mimari denetim Y4).
 */
export function nobeteAtanabilirMi(m: Pick<Muezzin, 'role' | 'onayBekliyor'>): boolean {
  return m.role === 'muezzin' && m.onayBekliyor !== true;
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
  korunmusAtama?: KorunmusAtamaResolver,
  /** Bir önceki haftanın son vaktinin (Pazar yatsı) ekibi — hafta sınırında
   * dinlenme kuralının sıfırlanmasını önlemek için (bkz. algoritma denetimi,
   * çağıran taraf src/lib/dateUtils.ts `getOncekiHafta` ile hesaplar). */
  oncekiHaftaSonEkibi: string[] = []
): Record<string, Record<Vakit, VakitAtama>> {
  const buHaftakiYukler: Record<string, number> = {};
  const aylikCumaSayilari: Record<string, number> = {};
  // Art arda kaç gündür yedek kalındığı — bkz. src/utils/tieBreaker.ts
  // ARD_ARDA_YEDEK_ESIGI, mimari denetim K6.
  const ardArdaYedekSayilari: Record<string, number> = {};
  muezzinler.forEach((m) => {
    buHaftakiYukler[m.id] = 0;
    aylikCumaSayilari[m.id] = m.aylikCumaSayisi || 0;
    ardArdaYedekSayilari[m.id] = 0;
  });

  const gunPlan: Record<string, Record<Vakit, VakitAtama>> = {};
  let oncekiVakitUidler: string[] = oncekiHaftaSonEkibi;

  for (const gun of gunler) {
    gunPlan[gun] = {} as Record<Vakit, VakitAtama>;

    const [gY, gM, gD] = gun.split('-').map(Number);
    const gunTarihi = new Date(gY, gM - 1, gD);
    // Pazartesi=1 ... Pazar=7 (haftalikIzinGunu ile aynı ölçek)
    const gunIndex = (gunTarihi.getDay() + 6) % 7;
    const isFriday = isFridayTarih(gunTarihi);

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
      const sirali = tieBreakerSirala(musaitMuezzinler, buHaftakiYukler, oncekiVakitUidler, isFriday, aylikCumaSayilari, ardArdaYedekSayilari);
      gunlukTazeAtama = { asil: sirali[0].id, yedek: sirali[1].id };
    } else if (musaitMuezzinler.length === 1) {
      gunlukTazeAtama = { asil: musaitMuezzinler[0].id, yedek: 'Sistem' };
    }

    let gununSonEkibi: string[] = [];
    let gununSonAtama: VakitAtama = gunlukTazeAtama;

    for (const vakit of VAKITLER) {
      const atama = korunmusAtama?.(gun, vakit) ?? gunlukTazeAtama;
      gunPlan[gun][vakit] = atama;

      if (atama.asil && atama.asil !== 'Sistem' && atama.asil !== 'SISTEM') {
        buHaftakiYukler[atama.asil] = (buHaftakiYukler[atama.asil] || 0) + 1;
      }
      if (atama.yedek && atama.yedek !== 'Sistem' && atama.yedek !== 'SISTEM') {
        buHaftakiYukler[atama.yedek] = (buHaftakiYukler[atama.yedek] || 0) + YEDEK_YUK_CARPANI;
      }
      gununSonEkibi = sistemDisiUidler(atama);
      gununSonAtama = atama;
    }

    oncekiVakitUidler = gununSonEkibi;

    // Art arda yedek sayacını güncelle: o gün yedek olan kişi için artır,
    // asil ya da tamamen boşta kalan için sıfırla (bkz. ARD_ARDA_YEDEK_ESIGI).
    muezzinler.forEach((m) => {
      ardArdaYedekSayilari[m.id] = gununSonAtama.yedek === m.id
        ? (ardArdaYedekSayilari[m.id] || 0) + 1
        : 0;
    });
  }

  return gunPlan;
}

/**
 * Üretilmiş bir gün planında, yalnızca tek kişinin müsait olduğu (yedek hep
 * 'Sistem' kalan) günleri tespit eder — çağıran taraf bunun için admin'e
 * "bu hafta X günü yedeksiz kalıyor" uyarısı üretebilir (bkz. algoritma
 * denetimi). Hiç kimsenin müsait olmadığı (asil de Sistem) günler bu listeye
 * dahil edilmez — o durum ayrı bir fonksiyonla (`kapsamsizGunleriBul`,
 * aşağıda) tespit edilir; eskiden bu durumun cron'daki toplam kadro
 * uyarısıyla kapsandığı iddia ediliyordu ama o uyarı yalnızca kadro
 * mevcuduna bakıyordu, belirli bir günün tamamen boş kalmasına değil
 * (bkz. mimari denetim O3).
 */
export function tekKisiliGunleriBul(gunPlan: Record<string, Record<Vakit, VakitAtama>>): string[] {
  return Object.entries(gunPlan)
    .filter(([, vakitler]) =>
      VAKITLER.some((v) => vakitler[v].asil !== 'Sistem') &&
      VAKITLER.every((v) => vakitler[v].yedek === 'Sistem')
    )
    .map(([gun]) => gun)
    .sort();
}

/**
 * Üretilmiş bir gün planında, HİÇ KİMSENİN müsait olmadığı (tüm vakitlerde
 * asil de 'Sistem' kalan) günleri tespit eder — sistemdeki en ağır durum.
 * `tekKisiliGunleriBul`'un eski docstring'i bu durumun cron'daki toplam kadro
 * uyarısıyla zaten kapsandığını iddia ediyordu, ama o uyarı yalnızca
 * `muezzinler.length < 2` (kadro mevcudu) koşuluna bakıyor — belirli bir
 * günde herkesin izinli/haftalık izin gününde olmasıyla ilgisi yok. Sonuç:
 * kadro yeterliyken bile herkesin izinli olduğu bir gün hiçbir uyarı
 * üretmeden sessizce geçiyordu (bkz. mimari denetim O3).
 */
export function kapsamsizGunleriBul(gunPlan: Record<string, Record<Vakit, VakitAtama>>): string[] {
  return Object.entries(gunPlan)
    .filter(([, vakitler]) => VAKITLER.every((v) => vakitler[v].asil === 'Sistem'))
    .map(([gun]) => gun)
    .sort();
}
