import { describe, it, expect } from 'vitest';
import { izinGunSayisi } from '../../src/lib/dateUtils';

describe('izinGunSayisi', () => {
  it('aynı gün için 1 döner (baslangic === bitis)', () => {
    expect(izinGunSayisi('2026-08-10', '2026-08-10')).toBe(1);
  });

  it('ardışık iki günü dahil sayar', () => {
    expect(izinGunSayisi('2026-08-10', '2026-08-11')).toBe(2);
  });

  it('bir haftalık aralığı (7 gün, her iki uç dahil) doğru sayar', () => {
    expect(izinGunSayisi('2026-08-10', '2026-08-16')).toBe(7);
  });

  it('ay sınırını aşan bir aralığı doğru sayar', () => {
    // 2026-08-28 .. 2026-09-02 = 6 gün (28,29,30,31,1,2)
    expect(izinGunSayisi('2026-08-28', '2026-09-02')).toBe(6);
  });

  it('yıl sınırını aşan bir aralığı doğru sayar', () => {
    // 2026-12-30 .. 2027-01-02 = 4 gün (30,31,1,2)
    expect(izinGunSayisi('2026-12-30', '2027-01-02')).toBe(4);
  });

  it('30 günlük tam yıllık izin kotasını doğru sayar', () => {
    // 2026-08-01 .. 2026-08-30 = 30 gün
    expect(izinGunSayisi('2026-08-01', '2026-08-30')).toBe(30);
  });
});
