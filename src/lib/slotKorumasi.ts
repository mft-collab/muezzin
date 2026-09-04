/**
 * Bir gün/vakit slotunun `bildirimler` belgelerini yorumlayan SAF (yan
 * etkisiz) kararlar. `src/services/planServisi.ts` bu kararları Firestore
 * snapshot'larından türettiği düz verilerle çağırır — mantığın kendisi
 * burada olduğundan birim testlerle (tests/unit/slotKorumasi.test.ts)
 * doğrudan doğrulanabilir.
 *
 * İki karar var:
 *  1. `korumaliSlotMu` — bu slot taze hesaplamadan MUAF mı?
 *  2. `guncelSlotBildirimleriniSec` — slotun ŞU ANKİ asil/yedek belgesi hangisi?
 */

/** `bildirimler` belgesinin bu modülün ihtiyaç duyduğu alanları. */
export interface SlotBildirimVerisi {
  uid?: string;
  tip?: string;
  durum?: string;
  vekaletDevredildi?: boolean;
  vekaletDevriBekliyor?: boolean;
  manuelAtama?: boolean;
  sonGuncelleme?: { toMillis(): number } | null;
}

// 'okundu_varsayilan': yatsiSonuIslemleri.ts'in gün sonunda dokunulmamış
// bekleyen bildirimlere verdiği "tamamlandı" durumu — bu listede olmazsa
// tamamlanmış GEÇMİŞ günler bile bir sonraki plan yeniden üretiminde silinip
// farklı bir kişiye atanabiliyordu (bkz. mimari denetim K7).
export const KORUNAN_DURUMLAR = ['onaylandi', 'reddedildi', 'okundu_varsayilan'];

/**
 * Slottaki hangi belgeler korumayı SAĞLIYOR — yani bu slotun taze
 * hesaplamadan muaf tutulmasının sebebi hangileri.
 *
 * vekaletDevredildi: true — scripts/vekaletDevirleriniIsle.ts GERÇEK
 * transferi uyguladığında yazar. Kabul edilen bir vekalet devri, bildirimin
 * `durum`unu DEĞİŞTİRMEZ (hâlâ 'bekliyor' kalabilir) — bu alan olmadan
 * korumaliSlotMu bu slotu korumasız sanıp plan yeniden üretiminde
 * sessizce eski sahibine geri döndürüyordu (bkz. mimari denetim K5).
 * vekaletDevriBekliyor: true — vekaletServisi.ts'teki vekaletKabulEt
 * bunu YAZAR (istemci artık transferi anlık yapmıyor, bkz. "1000 ifade
 * tavanı" kök neden çözümü). Script çalışana kadar (~10-15 dk) geçen
 * pencerede bu bayrak OLMADAN korumaliSlotMu slotu yine korumasız
 * sanıp, script daha transferi uygulamadan bir admin manuel ataması
 * veya haftalık plan yeniden üretimi kabul edilmiş devri sessizce
 * ezebilirdi — vekaletDevredildi'nin bu geçişteki AYNI rolü.
 * manuelAtama: true — vakitAtamasiniGuncelle (admin'in elle ataması)
 * yazar. `durum` bu anda hâlâ 'bekliyor' kaldığından (kişi henüz
 * onaylamadı/reddetmedi), bu bayrak olmadan taze bir manuel atama hiçbir
 * KORUNAN_DURUMLAR'a girmiyor ve bir sonraki plan yeniden üretiminde
 * sessizce eziliyordu (premium hata analizi PL-K2).
 */
export function korumaSaglayanBildirimler(
  slotBildirimleri: (SlotBildirimVerisi | undefined)[]
): SlotBildirimVerisi[] {
  return slotBildirimleri.filter((data): data is SlotBildirimVerisi =>
    !!data && (
      KORUNAN_DURUMLAR.includes(data.durum as string) ||
      data.tip === 'gorev_cagrisi' ||
      data.vekaletDevredildi === true ||
      data.vekaletDevriBekliyor === true ||
      data.manuelAtama === true
    )
  );
}

/**
 * Bu koruma, ONAYLI BİR İZİN tarafından ezilebilir mi?
 *
 * Yalnızca "kişi bu görevi kabul etti / admin elle atadı" türü koruma
 * ezilebilir. KASITLI OLARAK dışarıda bırakılanlar:
 * - `reddedildi` (mazeret kaydı): belgenin kendisi denetim izidir ve
 *   scripts/mazeretDevirleriniIsle.ts'in `devirSonucu` üzerinden işleyeceği
 *   HEDEFTİR — silinirse hem geçmiş hem bekleyen uzlaştırma kaybolur.
 * - `okundu_varsayilan`: yalnızca günü BİTMİŞ (yatsı sonrası) slotlarda
 *   oluşur — geçmişi yeniden yazmamak için dokunulmaz (bkz. K7).
 * - `gorev_cagrisi`: admin'in elle başlattığı acil çağrı.
 * - `vekaletDevredildi` / `vekaletDevriBekliyor`: devam eden ya da
 *   tamamlanmış bir görev devri; izin, devrin KARŞI tarafını da ilgilendirir,
 *   bu yüzden otomatik olarak ezilmez (admin müdahalesine bırakılır).
 */
function izinIleEzilebilirKoruma(data: SlotBildirimVerisi): boolean {
  if (data.durum === 'reddedildi' || data.durum === 'okundu_varsayilan') return false;
  if (data.tip === 'gorev_cagrisi') return false;
  if (data.vekaletDevredildi === true || data.vekaletDevriBekliyor === true) return false;
  return data.durum === 'onaylandi' || data.manuelAtama === true;
}

/**
 * Bu slot taze hesaplamadan muaf mı?
 *
 * `izinliUidler` verilirse (self-healing yolu), o gün ONAYLI İZİNDE olan
 * kişilerin uid'leri beklenir. Bir slotun korumasını yalnızca "kabul edilmiş
 * / elle atanmış görev" sağlıyorsa VE koruyan belgelerden biri o gün onaylı
 * izinliyse, koruma DÜŞER — böylece plan yeniden üretimi o kişiyi slottan
 * çıkarıp yerine adalet/tie-breaker kurallarıyla seçilmiş birini koyabilir.
 *
 * Kök neden: plan yayınlanır → müezzin "okudum" der (durum 'onaylandi') →
 * SONRA aynı güne izni onaylanır. Koruma koşulsuz olduğu sürece
 * `haftalikPlanUret`'in izin filtresi bu slota HİÇ ulaşamıyor, kişi onaylı
 * izninde nöbetçi kalmaya devam ediyordu; admin'in elindeki tek yol
 * Firestore'u elle düzenlemekti (vakitAtamasiniGuncelle de aynı korumaya
 * takılıp 'protected' dönüyordu).
 */
export function korumaliSlotMu(
  slotBildirimleri: (SlotBildirimVerisi | undefined)[],
  izinliUidler?: ReadonlySet<string>
): boolean {
  const koruyanlar = korumaSaglayanBildirimler(slotBildirimleri);
  if (koruyanlar.length === 0) return false;
  if (!izinliUidler || izinliUidler.size === 0) return true;

  // Koruyan belgelerden BİRİ bile ezilemez türdeyse (mazeret/görev
  // çağrısı/vekalet/geçmiş gün) slot bütünüyle korunur — kısmi silme, aynı
  // slotun bildirim belgeleriyle plan belgesini birbirinden ayırırdı.
  if (!koruyanlar.every(izinIleEzilebilirKoruma)) return true;

  return !koruyanlar.some((data) => !!data.uid && izinliUidler.has(data.uid));
}

/**
 * Slotun ŞU ANKİ (yetkili) asil ve yedek bildirim belgelerini seçer.
 *
 * Neden bir "seçim" gerekiyor: yedek terfisi (scripts/mazeretDevirleriniIsle.ts
 * ve src/services/mazeretServisi.ts `kriziBaslat`) YERİNDE yapılır — var olan
 * `..._yedek` belgesinin `tip` alanı 'asil'e çevrilir, mazeret bildiren
 * kişinin `..._asil` belgesi ise (denetim izi olduğundan) SİLİNMEZ ve `tip`i
 * hâlâ 'asil'dir. Yani terfi sonrası slotta `tip === 'asil'` olan İKİ belge
 * bulunur. Basit bir `find(tip === 'asil')` çağrısı, Firestore'un belge-ID
 * (`__name__`) sıralaması nedeniyle her zaman ESKİ `..._asil` belgesini
 * (`_asil` < `_yedek`) döndürüyordu: self-healing, mazeret bildiren kişiyi
 * hâlâ asil sanıp terfiyi `haftaPlanlari`'nda SESSİZCE GERİ ALIYOR, terfi
 * eden kişi ise ne haftalık yük ne dinlenme (SOS) kredisi alıyordu — plan ile
 * bildirimler/push bildirimleri birbirine düşüyordu.
 *
 * Seçim kuralı: aynı `tip` için birden fazla aday varsa
 *  1. `reddedildi` OLMAYAN belge kazanır (mazeret bildiren kişi tanım gereği
 *     artık o slotun sahibi değildir),
 *  2. eşitlikte en son güncellenen (`sonGuncelleme`) kazanır — terfi eden
 *     belge her zaman taze bir `sonGuncelleme` ile yazılır,
 *  3. o da eşitse girdi sırası korunur (eski davranış).
 */
export function guncelSlotBildirimleriniSec(
  slotBildirimleri: (SlotBildirimVerisi | undefined)[]
): { asil?: SlotBildirimVerisi; yedek?: SlotBildirimVerisi } {
  const mevcutlar = slotBildirimleri.filter((d): d is SlotBildirimVerisi => !!d);
  return {
    asil: enGuncelBildirim(mevcutlar.filter((d) => d.tip === 'asil')),
    yedek: enGuncelBildirim(mevcutlar.filter((d) => d.tip === 'yedek')),
  };
}

function enGuncelBildirim(adaylar: SlotBildirimVerisi[]): SlotBildirimVerisi | undefined {
  if (adaylar.length <= 1) return adaylar[0];
  // Array.prototype.sort kararlıdır (ES2019+) — 3. kural (girdi sırası)
  // bundan gelir.
  return [...adaylar].sort((a, b) => {
    const aRed = a.durum === 'reddedildi' ? 1 : 0;
    const bRed = b.durum === 'reddedildi' ? 1 : 0;
    if (aRed !== bRed) return aRed - bRed;
    return (b.sonGuncelleme?.toMillis() ?? 0) - (a.sonGuncelleme?.toMillis() ?? 0);
  })[0];
}
