import { describe, it, expect } from 'vitest';
import { gunlukKredileriHesapla } from '../../src/lib/gunlukKrediHesaplama';

describe('gunlukKredileriHesapla', () => {
  it('asil bekliyor kaldıysa kredi verir ve okundu_varsayilan işaretler', () => {
    const sonuc = gunlukKredileriHesapla([
      { tip: 'asil', durum: 'bekliyor', uid: 'a' },
    ]);
    expect(sonuc.asilKredi).toEqual({ a: 1 });
    expect(sonuc.okunduVarsayilanIndeksleri).toEqual([0]);
    expect(sonuc.uyariUids).toEqual([]);
  });

  it('asil kendi onayını verdiyse (onaylandi) kredi verir ama işaretlemez', () => {
    const sonuc = gunlukKredileriHesapla([
      { tip: 'asil', durum: 'onaylandi', uid: 'a' },
    ]);
    expect(sonuc.asilKredi).toEqual({ a: 1 });
    expect(sonuc.okunduVarsayilanIndeksleri).toEqual([]);
  });

  it('asil mazeret bildirdiyse (reddedildi) hiç kredi vermez', () => {
    const sonuc = gunlukKredileriHesapla([
      { tip: 'asil', durum: 'reddedildi', uid: 'a' },
    ]);
    expect(sonuc.asilKredi).toEqual({});
  });

  it('Cuma vaktinde asil olan için ayrıca cumaKredi verir', () => {
    const sonuc = gunlukKredileriHesapla([
      { tip: 'asil', durum: 'bekliyor', uid: 'a', cumaMi: true },
    ]);
    expect(sonuc.asilKredi).toEqual({ a: 1 });
    expect(sonuc.cumaKredi).toEqual({ a: 1 });
  });

  it('yedek bekliyor kaldıysa yedekKredi verir (asilKredi değil) ve işaretler', () => {
    const sonuc = gunlukKredileriHesapla([
      { tip: 'yedek', durum: 'bekliyor', uid: 'b' },
    ]);
    expect(sonuc.yedekKredi).toEqual({ b: 1 });
    expect(sonuc.asilKredi).toEqual({});
    expect(sonuc.okunduVarsayilanIndeksleri).toEqual([0]);
  });

  it('yedek kendi onayını verdiyse (onaylandi) yedekKredi verir', () => {
    const sonuc = gunlukKredileriHesapla([
      { tip: 'yedek', durum: 'onaylandi', uid: 'b' },
    ]);
    expect(sonuc.yedekKredi).toEqual({ b: 1 });
  });

  // Mantık denetimi regresyonu: gorev_cagrisi (acil çağrı) önceden HİÇBİR
  // durum dalında kredi almıyordu — kişi görevi bilfiil yapsa (onaylandi)
  // bile aylikVakitSayisi'na hiç yansımıyordu, tekrar acil çağrılan biri
  // adalet algoritmasında sistematik olarak "az yüklü" görünüyordu.
  it('gorev_cagrisi onaylandi ise asil ile AYNI ağırlıkta kredi verir (mantık denetimi regresyonu)', () => {
    const sonuc = gunlukKredileriHesapla([
      { tip: 'gorev_cagrisi', durum: 'onaylandi', uid: 'c' },
    ]);
    expect(sonuc.asilKredi).toEqual({ c: 1 });
    expect(sonuc.uyariUids).toEqual([]);
  });

  it('gorev_cagrisi bekliyor kaldıysa yine asilKredi verir, işaretler VE admin uyarısına düşer', () => {
    const sonuc = gunlukKredileriHesapla([
      { tip: 'gorev_cagrisi', durum: 'bekliyor', uid: 'c' },
    ]);
    expect(sonuc.asilKredi).toEqual({ c: 1 });
    expect(sonuc.okunduVarsayilanIndeksleri).toEqual([0]);
    expect(sonuc.uyariUids).toEqual(['c']);
  });

  it('gorev_cagrisi Cuma vaktindeyse cumaKredi de verir', () => {
    const sonuc = gunlukKredileriHesapla([
      { tip: 'gorev_cagrisi', durum: 'onaylandi', uid: 'c', cumaMi: true },
    ]);
    expect(sonuc.cumaKredi).toEqual({ c: 1 });
  });

  it('birden fazla kişinin kredisini aynı anda doğru biriktirir', () => {
    const sonuc = gunlukKredileriHesapla([
      { tip: 'asil', durum: 'bekliyor', uid: 'a' },
      { tip: 'yedek', durum: 'bekliyor', uid: 'b' },
      { tip: 'gorev_cagrisi', durum: 'onaylandi', uid: 'c' },
      { tip: 'asil', durum: 'reddedildi', uid: 'd' },
    ]);
    expect(sonuc.asilKredi).toEqual({ a: 1, c: 1 });
    expect(sonuc.yedekKredi).toEqual({ b: 1 });
    expect(sonuc.okunduVarsayilanIndeksleri).toEqual([0, 1]);
    expect(sonuc.puanIslenenIndeksleri).toEqual([0, 1, 2]);
  });

  // Kod denetimi bulgusu (regresyon kanıtı): script'in aynı gün için ikinci
  // kez çalıştırılması (ör. GitHub Actions manuel "Re-run failed jobs" —
  // kredi batch'i başarıyla commit olduktan SONRA ay/yıl sonu reset
  // adımlarından biri başarısız olup job'ı "failed" gösterirse) daha önce
  // ZATEN kredilendirilmiş 'onaylandi' kayıtları ikinci kez sayardı, çünkü
  // yalnızca 'bekliyor'→'okundu_varsayilan' durum değişimi tekrar-sayıma
  // karşı korumalıydı. `puanIslendi:true` işaretli bir kayıt artık
  // durumundan BAĞIMSIZ olarak tamamen atlanır.
  it('puanIslendi:true olan bir kayıt tekrar kredilendirilmez (tekrar-çalıştırma güvenliği)', () => {
    const sonuc = gunlukKredileriHesapla([
      { tip: 'asil', durum: 'onaylandi', uid: 'a', puanIslendi: true },
      { tip: 'yedek', durum: 'onaylandi', uid: 'b', puanIslendi: true },
      { tip: 'asil', durum: 'onaylandi', uid: 'c' }, // bu kayıt henüz işlenmemiş, kredi almalı
    ]);
    expect(sonuc.asilKredi).toEqual({ c: 1 });
    expect(sonuc.yedekKredi).toEqual({});
    expect(sonuc.puanIslenenIndeksleri).toEqual([2]);
  });
});
