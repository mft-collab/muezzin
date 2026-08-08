import { describe, it, expect } from 'vitest';
import { izinAraligiCumaIceriyorMu } from '../../src/lib/dateUtils';

// 2026-05-22 tek başına bir Cuma — firestore.rules'taki
// izinAraligiCumaIceriyorMu testleriyle (scripts/firestore-rules-tests.ts)
// aynı referans tarih kullanılıyor, iki tarafın da tutarlı olduğunu
// doğrulamak için.
describe('izinAraligiCumaIceriyorMu', () => {
  it('tek başına bir Cuma günü true döner', () => {
    expect(izinAraligiCumaIceriyorMu('2026-05-22', '2026-05-22')).toBe(true);
  });

  it('aralığın ortasına düşen bir Cuma true döner', () => {
    // 2026-05-18 (Pzt) - 2026-05-24 (Paz) 2026-05-22 Cuma'yı kapsıyor.
    expect(izinAraligiCumaIceriyorMu('2026-05-18', '2026-05-24')).toBe(true);
  });

  it('Cuma içermeyen kısa bir aralık false döner', () => {
    // 2026-05-18 (Pzt) - 2026-05-21 (Per) — Cuma'ya ulaşmadan biter.
    expect(izinAraligiCumaIceriyorMu('2026-05-18', '2026-05-21')).toBe(false);
  });

  it('7+ günlük her aralık istatistiksel olarak bir Cuma içerir', () => {
    expect(izinAraligiCumaIceriyorMu('2026-05-19', '2026-05-26')).toBe(true);
  });

  it('ters çevrilmiş aralıkta (bitis < baslangic) döngüye girmeden false döner', () => {
    expect(izinAraligiCumaIceriyorMu('2026-05-25', '2026-05-20')).toBe(false);
  });

  it('ay sınırını aşıp Cuma içeren bir aralığı doğru tespit eder', () => {
    // 2026-05-29 (Cuma) ay sınırını aşan aralığın içinde.
    expect(izinAraligiCumaIceriyorMu('2026-05-27', '2026-06-01')).toBe(true);
  });
});
