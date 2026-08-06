import { Muezzin } from '../types';

/** Yedek görevi, rotasyon adaletinde asil'in yarısı kadar yük sayılır — yedek
 * çoğu zaman fiilen görev yapmaz, yalnızca hazır bulunur. Burada tanımlı
 * (planlamaCekirdegi.ts'in içinde değil) çünkü hem haftalık yük birikimi
 * (planlamaCekirdegi.ts) hem de kalıcı aylık yedek sayacı (aşağıdaki tier 2.5)
 * aynı ağırlığı kullanmalı — planlamaCekirdegi.ts bunu buradan import eder
 * (bkz. algoritma denetimi). */
export const YEDEK_YUK_CARPANI = 0.5;

/** Bir kişi en fazla bu kadar gün ART ARDA yedek kalabilir — aşarsa tier 1.2
 * devreye girip o kişiyi bir sonraki günün yedek yarışından çıkarır (bkz.
 * mimari denetim K6). Küçük (özellikle 3 kişilik) kadrolarda, ağırlıklı
 * toplamın SIFIRA tam eşitlendiği durumlar (bkz. tier 2 yorumu) tek başına
 * yeterli olmayabiliyordu — bu sert bir alt sınır olarak devrede kalır. */
export const ARD_ARDA_YEDEK_ESIGI = 2;

/**
 * THE JUSTICE SCALE (Adalet Terazisi) v2.0
 * Provides a highly fair and balanced assignment ranking.
 */
export function tieBreakerSirala(
 muezzinleri: (Muezzin & { id: string })[],
 buHaftakiYukler: Record<string, number>,
 oncekiVakitUidler: string[] = [], // [asilId, yedekId]
 isFriday: boolean = false,
 aylikCumaSayilari: Record<string, number> = {},
 /** Her kişinin kaç gündür ART ARDA yedek kaldığı (bkz. ARD_ARDA_YEDEK_ESIGI
  * ve mimari denetim K6). Çağıran taraf (planlamaCekirdegi.ts) bunu gün gün
  * günceller — bir kişi asil ya da tamamen boşta kalınca sıfırlanır. */
 ardArdaYedekSayilari: Record<string, number> = {}
): (Muezzin & { id: string })[] {

 return [...muezzinleri].sort((a, b) => {
 // 1. SOS (Sistemsel Dinlenme): Bir önceki vakitte görevli olanlar en sona
 const aWasActive = oncekiVakitUidler.includes(a.id);
 const bWasActive = oncekiVakitUidler.includes(b.id);
 if (aWasActive !== bWasActive) return aWasActive ? 1 : -1;

 // 1.2 Sürekli Yedek Kilidi Kırıcı: SOS ikisini de eşit "bloklu" saydığı
 // durumda (yani ikisi de bir önceki vaktin ekibindeydi — asil+yedek
 // çiftinin arasındaki asıl yarış tam olarak burada geçer), art arda
 // ARD_ARDA_YEDEK_ESIGI kez yedek kalmış biri bu kez yedek yarışından
 // çıkarılır (rank2/"boşta" konumuna itilir). Küçük kadrolarda tier 2'nin
 // ağırlıklı toplamı bile tam sayısal eşitlik yüzünden bu kişiyi süresiz
 // yedekte kilitleyebiliyordu (bkz. mimari denetim K6) — bu sert sınır,
 // ağırlıklı toplamın sonucundan BAĞIMSIZ olarak rotasyonu garanti eder.
 const esikA = (ardArdaYedekSayilari[a.id] || 0) >= ARD_ARDA_YEDEK_ESIGI;
 const esikB = (ardArdaYedekSayilari[b.id] || 0) >= ARD_ARDA_YEDEK_ESIGI;
 if (esikA !== esikB) return esikA ? 1 : -1;

 // 1.5 Cuma Adaleti: haftalık yüke uygulanan 1.5x çarpanı ay ilerledikçe
 // aylikVakitSayisi'nin (kalıcı, büyük) toplamı tarafından bastırılıyordu
 // (bkz. algoritma denetimi). Bu yüzden Cuma vakitlerinde, bu ay kaç kez
 // Cuma yapıldığı kalıcı ve bağımsız bir kademe olarak önce karşılaştırılır.
 if (isFriday) {
 const cumaA = aylikCumaSayilari[a.id] || 0;
 const cumaB = aylikCumaSayilari[b.id] || 0;
 if (cumaA !== cumaB) return cumaA - cumaB;
 }

 // 2. Ağırlıklı Toplam Yük (Cuma vakitleri 1.5 kat yük sayılır)
 //
 // aylikYedekSayisi: yedeklik daha önce yalnızca HAFTALIK yükte (aşağıdaki
 // buHaftakiYukler) 0.5x ağırlıkla sayılıyor, hafta bitince bu ağırlık
 // hiçbir kalıcı sayaca işlenmiyordu. Sonuç: SOS her gün önceki asil+yedeği
 // eleyip geriye kalan tek kişiyi asil yaptığından, bir kez yedeğe düşen
 // kişi her hafta yeniden "en düşük toplam" olarak ölçülüp tekrar yedeğe
 // atanıyor — küçük kadrolarda (özellikle 3 kişi) süresiz bir kilide
 // dönüşüyordu (bkz. mimari denetim K6). aylikYedekSayisi
 // (scripts/yatsiSonuIslemleri.ts tarafından her tamamlanan yedek günü için
 // artırılan kalıcı sayaç) aynı ağırlıkla toplama dahil edilerek bu kilit
 // zamanla kırılır: sürekli yedek kalan kişinin toplamı gerçek yükünü
 // yansıtmaya başlar ve bir noktada asil'e terfi eder.
 const multiplier = isFriday ? 1.5 : 1;
 const totalA = (a.aylikVakitSayisi || 0) + ((a.aylikYedekSayisi || 0) * YEDEK_YUK_CARPANI) + ((buHaftakiYukler[a.id] || 0) * multiplier);
 const totalB = (b.aylikVakitSayisi || 0) + ((b.aylikYedekSayisi || 0) * YEDEK_YUK_CARPANI) + ((buHaftakiYukler[b.id] || 0) * multiplier);

 if (Math.abs(totalA - totalB) > 0.1) {
 return totalA - totalB;
 }
 
 // 3. Haftalık Yük Eşitliği
 const loadA = buHaftakiYukler[a.id] || 0;
 const loadB = buHaftakiYukler[b.id] || 0;
 if (loadA !== loadB) return loadA - loadB;

 // 4. Deterministik Rastgelelik (ID tabanlı hash benzeri bir karşılaştırma)
 // Alfabetik sıranın adaletsizliğini (A isimli personelin hep ilk seçilmesi) engeller
 const hashA = a.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
 const hashB = b.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
 
 return hashA - hashB;
 });
}
