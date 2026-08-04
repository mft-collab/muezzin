import { describe, it, expect } from 'vitest';
import { mazeretKapaliMi, MAZERET_SON_BASVURU_DAKIKA } from '../../src/lib/mazeretKurallari';

// 2026-08-06 Perşembe (Cuma değil), 2026-08-07 Cuma — bkz. planlamaCekirdegi.test.ts'teki
// aynı doğrulanmış tarih aralığı.
const PERSEMBE = new Date(2026, 7, 6);
const CUMA = new Date(2026, 7, 7);

describe('mazeretKapaliMi', () => {
  it('Cuma günü, vakit veya zamandan bağımsız olarak her zaman kapalıdır', () => {
    const ogleVakti = new Date(2026, 7, 7, 13, 0);
    const cokErken = new Date(2026, 7, 7, 6, 0); // ogle'den çok saatler önce

    const durum = mazeretKapaliMi(
      { gunTarihi: CUMA, vakit: 'ogle', vakitSaati: ogleVakti, oncekiGunYatsiSaati: null },
      cokErken
    );

    expect(durum.kapali).toBe(true);
    expect(durum.sebep).toMatch(/Cuma/);
  });

  it('Cuma dışı bir vakitte, ezana 1 saatten fazla varsa açıktır', () => {
    const ikindiVakti = new Date(2026, 7, 6, 16, 0);
    const suAn = new Date(2026, 7, 6, 14, 30); // 1.5 saat önce

    const durum = mazeretKapaliMi(
      { gunTarihi: PERSEMBE, vakit: 'ikindi', vakitSaati: ikindiVakti, oncekiGunYatsiSaati: null },
      suAn
    );

    expect(durum.kapali).toBe(false);
  });

  it('Cuma dışı bir vakitte, ezana tam 1 saat kala kapanır', () => {
    const ikindiVakti = new Date(2026, 7, 6, 16, 0);
    const tamBirSaatKala = new Date(ikindiVakti.getTime() - MAZERET_SON_BASVURU_DAKIKA * 60000);

    const acikDurum = mazeretKapaliMi(
      { gunTarihi: PERSEMBE, vakit: 'ikindi', vakitSaati: ikindiVakti, oncekiGunYatsiSaati: null },
      new Date(tamBirSaatKala.getTime() - 1000)
    );
    const kapaliDurum = mazeretKapaliMi(
      { gunTarihi: PERSEMBE, vakit: 'ikindi', vakitSaati: ikindiVakti, oncekiGunYatsiSaati: null },
      tamBirSaatKala
    );

    expect(acikDurum.kapali).toBe(false);
    expect(kapaliDurum.kapali).toBe(true);
  });

  it('sabah vaktinde pencere, sabahın kendi saatine değil önceki günün yatsısına göre kapanır', () => {
    // Sabah 04:30, önceki gün yatsı 21:00. Normal kuralda (sabah-1sa) pencere
    // 03:30'da kapanırdı; sabah istisnasında ise yatsı+1sa = 22:00'de kapanır.
    const oncekiGunYatsi = new Date(2026, 7, 5, 21, 0); // Çarşamba yatsı (Perşembe sabahının öncesi)

    const yatsidan45DakikaSonra = new Date(2026, 7, 5, 21, 45); // hâlâ açık olmalı (1 saat dolmadı)
    const yatsidan75DakikaSonra = new Date(2026, 7, 5, 22, 15); // artık kapalı olmalı

    const acikDurum = mazeretKapaliMi(
      { gunTarihi: PERSEMBE, vakit: 'sabah', vakitSaati: null, oncekiGunYatsiSaati: oncekiGunYatsi },
      yatsidan45DakikaSonra
    );
    const kapaliDurum = mazeretKapaliMi(
      { gunTarihi: PERSEMBE, vakit: 'sabah', vakitSaati: null, oncekiGunYatsiSaati: oncekiGunYatsi },
      yatsidan75DakikaSonra
    );

    expect(acikDurum.kapali).toBe(false);
    expect(kapaliDurum.kapali).toBe(true);
    expect(kapaliDurum.sebep).toMatch(/[Ss]abah/);
  });

  it('referans saat bilinmiyorsa (veri yoksa) kısıtlama uygulamaz', () => {
    const durum = mazeretKapaliMi(
      { gunTarihi: PERSEMBE, vakit: 'yatsi', vakitSaati: null, oncekiGunYatsiSaati: null },
      new Date(2026, 7, 6, 23, 0)
    );

    expect(durum.kapali).toBe(false);
  });
});
