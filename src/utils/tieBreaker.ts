import { Muezzin } from '../types';

export function tieBreakerSirala(
  muezzinleri: (Muezzin & { id: string })[],
  buHaftakiYukler: Record<string, number>
): (Muezzin & { id: string })[] {
  return [...muezzinleri].sort((a, b) => {
    // 1. Toplam Yük (Aylık + Bu Haftaki)
    const totalA = (a.aylikVakitSayisi || 0) + (buHaftakiYukler[a.id] || 0);
    const totalB = (b.aylikVakitSayisi || 0) + (buHaftakiYukler[b.id] || 0);
    
    if (totalA !== totalB) {
      return totalA - totalB;
    }
    
    // 2. Eğer toplam yük eşitse, sadece haftalık yüke bak
    const loadA = buHaftakiYukler[a.id] || 0;
    const loadB = buHaftakiYukler[b.id] || 0;
    if (loadA !== loadB) return loadA - loadB;

    // 3. İsim sıralaması (Alfabetik)
    return (a.displayName || '').localeCompare(b.displayName || '');
  });
}
