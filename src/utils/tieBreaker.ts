import { Muezzin } from '../types';

/**
 * THE JUSTICE SCALE (Adalet Terazisi) v2.0
 * Provides a highly fair and balanced assignment ranking.
 */
export function tieBreakerSirala(
 muezzinleri: (Muezzin & { id: string })[],
 buHaftakiYukler: Record<string, number>,
 oncekiVakitUidler: string[] = [], // [asilId, yedekId]
 isFriday: boolean = false,
 aylikCumaSayilari: Record<string, number> = {}
): (Muezzin & { id: string })[] {

 return [...muezzinleri].sort((a, b) => {
 // 1. SOS (Sistemsel Dinlenme): Bir önceki vakitte görevli olanlar en sona
 const aWasActive = oncekiVakitUidler.includes(a.id);
 const bWasActive = oncekiVakitUidler.includes(b.id);
 if (aWasActive !== bWasActive) return aWasActive ? 1 : -1;

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
 const multiplier = isFriday ? 1.5 : 1;
 const totalA = (a.aylikVakitSayisi || 0) + ((buHaftakiYukler[a.id] || 0) * multiplier);
 const totalB = (b.aylikVakitSayisi || 0) + ((buHaftakiYukler[b.id] || 0) * multiplier);
 
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
