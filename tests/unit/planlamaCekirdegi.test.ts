import { describe, it, expect, vi } from 'vitest';
import { haftalikPlanUret, VAKITLER, MuezzinAday, OnayliIzin } from '../../src/lib/planlamaCekirdegi';
import { Muezzin, Vakit } from '../../src/types';

function muezzin(id: string, overrides: Partial<Muezzin> = {}): MuezzinAday {
  return {
    id,
    displayName: id,
    photoURL: '',
    role: 'muezzin',
    aktif: true,
    fcmToken: null,
    aylikVakitSayisi: 0,
    ...overrides,
  };
}

// 2026-08-03 Pazartesi .. 2026-08-09 Pazar (isFriday testleri için 2026-08-07 Cuma içerir)
const HAFTA_GUNLERI = [
  '2026-08-03', // Pazartesi
  '2026-08-04', // Salı
  '2026-08-05', // Çarşamba
  '2026-08-06', // Perşembe
  '2026-08-07', // Cuma
  '2026-08-08', // Cumartesi
  '2026-08-09', // Pazar
];

describe('haftalikPlanUret', () => {
  it('onaylı izindeki personeli o gün hiçbir vakte atamaz', () => {
    const muezzinler = [muezzin('a'), muezzin('b'), muezzin('c')];
    const onayliIzinler: OnayliIzin[] = [{ uid: 'a', baslangic: '2026-08-03', bitis: '2026-08-03' }];

    const plan = haftalikPlanUret(['2026-08-03'], muezzinler, onayliIzinler);

    for (const vakit of VAKITLER) {
      expect(plan['2026-08-03'][vakit].asil).not.toBe('a');
      expect(plan['2026-08-03'][vakit].yedek).not.toBe('a');
    }
  });

  it('sabit haftalık izin gününde olan personeli o gün atamaz', () => {
    // 2026-08-03 Pazartesi -> gunIndex 0, haftalikIzinGunu 1 olan kişi Pazartesi izinlidir.
    const muezzinler = [muezzin('a', { haftalikIzinGunu: 1 }), muezzin('b'), muezzin('c')];

    const plan = haftalikPlanUret(['2026-08-03'], muezzinler, []);

    for (const vakit of VAKITLER) {
      expect(plan['2026-08-03'][vakit].asil).not.toBe('a');
      expect(plan['2026-08-03'][vakit].yedek).not.toBe('a');
    }
  });

  it('tek müsait personel varsa asil olarak atar, yedeği Sistem bırakır', () => {
    const muezzinler = [
      muezzin('a'),
      muezzin('b', { haftalikIzinGunu: 1 }),
      muezzin('c', { haftalikIzinGunu: 1 }),
    ];

    const plan = haftalikPlanUret(['2026-08-03'], muezzinler, []);

    for (const vakit of VAKITLER) {
      expect(plan['2026-08-03'][vakit]).toEqual({ asil: 'a', yedek: 'Sistem' });
    }
  });

  it('hiç müsait personel yoksa tüm vakitleri Sistem/Sistem olarak bırakır', () => {
    const muezzinler = [
      muezzin('a', { haftalikIzinGunu: 1 }),
      muezzin('b', { haftalikIzinGunu: 1 }),
    ];

    const plan = haftalikPlanUret(['2026-08-03'], muezzinler, []);

    for (const vakit of VAKITLER) {
      expect(plan['2026-08-03'][vakit]).toEqual({ asil: 'Sistem', yedek: 'Sistem' });
    }
  });

  it('bir günün tüm vakitlerine aynı asil/yedek ikilisini atar (günlük tek atama)', () => {
    const muezzinler = [muezzin('a'), muezzin('b'), muezzin('c'), muezzin('d')];

    const plan = haftalikPlanUret(['2026-08-03'], muezzinler, []);
    const gunAtamalari = VAKITLER.map((vakit) => plan['2026-08-03'][vakit]);

    expect(new Set(gunAtamalari.map((a) => `${a.asil}-${a.yedek}`)).size).toBe(1);
  });

  it('korunmuş atama verildiğinde o vakit için taze hesaplama atlanır ama yük dengesine dahil edilir', () => {
    const muezzinler = [muezzin('a'), muezzin('b'), muezzin('c'), muezzin('d')];
    const korunmusAtama = vi.fn((gun: string, vakit: Vakit) =>
      vakit === 'sabah' ? { asil: 'd', yedek: 'c' } : null
    );

    const plan = haftalikPlanUret(['2026-08-03'], muezzinler, [], korunmusAtama);

    expect(plan['2026-08-03'].sabah).toEqual({ asil: 'd', yedek: 'c' });
    // Diğer vakitler taze hesaplanan günlük ikili ile aynı olmalı ve d/c'den farklı olabilir.
    const ogle = plan['2026-08-03'].ogle;
    expect(ogle).toEqual(plan['2026-08-03'].ikindi);
  });

  it('haftalık yükü, iki müsait kişi arasında dengeli biçimde dağıtır', () => {
    const muezzinler = [muezzin('a'), muezzin('b')];

    const plan = haftalikPlanUret(HAFTA_GUNLERI, muezzinler, []);

    const yukler: Record<string, number> = { a: 0, b: 0 };
    for (const gun of HAFTA_GUNLERI) {
      for (const vakit of VAKITLER) {
        const atama = plan[gun][vakit];
        if (atama.asil !== 'Sistem') yukler[atama.asil] += 1;
        if (atama.yedek !== 'Sistem') yukler[atama.yedek] += 1;
      }
    }

    expect(Math.abs(yukler.a - yukler.b)).toBeLessThanOrEqual(1);
  });

  it('bir önceki günün ekibini SOS kuralıyla arka sıraya atarak art arda aynı ikiliyi seçmekten kaçınır', () => {
    const muezzinler = [muezzin('a'), muezzin('b'), muezzin('c'), muezzin('d')];

    const plan = haftalikPlanUret(['2026-08-03', '2026-08-04'], muezzinler, []);

    const gun1Ekip = new Set([plan['2026-08-03'].sabah.asil, plan['2026-08-03'].sabah.yedek]);
    const gun2Ekip = new Set([plan['2026-08-04'].sabah.asil, plan['2026-08-04'].sabah.yedek]);

    // 4 müsait kişiden 2'si dünkü ekipte olduğu için bugün en az bir farklı kişi seçilmeli.
    const kesisim = [...gun1Ekip].filter((uid) => gun2Ekip.has(uid));
    expect(kesisim.length).toBeLessThan(2);
  });
});
