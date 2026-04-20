import { Muezzin } from '../../src/types.ts';

export function tieBreakerSirala(
  muezzinleri: (Muezzin & { id: string })[], 
  buHaftakiYukler: Record<string, number>
): (Muezzin & { id: string })[] {
  return [...muezzinleri].sort((a, b) => {
    // 1. Aylık vakit sayısı
    if (a.aylikVakitSayisi !== b.aylikVakitSayisi) {
      return a.aylikVakitSayisi - b.aylikVakitSayisi;
    }
    // 2. Bu haftaki yük
    const loadA = buHaftakiYukler[a.id] || 0;
    const loadB = buHaftakiYukler[b.id] || 0;
    if (loadA !== loadB) return loadA - loadB;
    // 3. İsim
    return a.displayName.localeCompare(b.displayName);
  });
}
