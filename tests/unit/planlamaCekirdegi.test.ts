import { describe, it, expect, vi } from 'vitest';
import { haftalikPlanUret, tekKisiliGunleriBul, kapsamsizGunleriBul, nobeteAtanabilirMi, VAKITLER, MuezzinAday, OnayliIzin } from '../../src/lib/planlamaCekirdegi';
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

  it('oncekiHaftaSonEkibi parametresi, yeni haftanın ilk gününde SOS kuralını tetikler', () => {
    // Önceki turdaki denetimde bulunan gerçek hata: her hafta ayrı bir
    // haftalikPlanUret() çağrısıyla üretildiği için dinlenme kuralı hafta
    // sınırında sıfırlanıyordu (Pazar ekibi Pazartesi tekrar seçilebiliyordu).
    const muezzinler = [muezzin('a'), muezzin('b'), muezzin('c'), muezzin('d')];

    const plan = haftalikPlanUret(['2026-08-03'], muezzinler, [], undefined, ['a', 'b']);

    const gun1Ekip = new Set([plan['2026-08-03'].sabah.asil, plan['2026-08-03'].sabah.yedek]);
    const kesisim = [...gun1Ekip].filter((uid) => ['a', 'b'].includes(uid));
    expect(kesisim.length).toBeLessThan(2);
  });

  it('oncekiHaftaSonEkibi verilmezse (varsayılan boş dizi) SOS kısıtlaması uygulanmaz', () => {
    const muezzinler = [muezzin('a'), muezzin('b'), muezzin('c'), muezzin('d')];

    // Aynı girdiyle, oncekiHaftaSonEkibi olmadan çağrı — mevcut (geriye dönük
    // uyumlu) davranışın bozulmadığını doğrular.
    const planA = haftalikPlanUret(['2026-08-03'], muezzinler, []);
    const planB = haftalikPlanUret(['2026-08-03'], muezzinler, [], undefined, []);

    expect(planA['2026-08-03']).toEqual(planB['2026-08-03']);
  });

  it('yedek olmak asil olmaktan daha az yük sayılır (0.5 kat) — bir sonraki gün tekrar asil seçilmeyi kolaylaştırır', () => {
    const muezzinler = [muezzin('a'), muezzin('b')];

    const plan = haftalikPlanUret(['2026-08-03', '2026-08-04'], muezzinler, []);
    const gun1 = plan['2026-08-03'].sabah;
    const gun2 = plan['2026-08-04'].sabah;

    // Gün 1'de SOS her iki taraf için de eşit (tek çift müsait), tiebreak hash
    // ile kararlaştırılır. Gün 2'de SOS yine ikisini de eşit "aktif" sayar
    // (2 kişiyle her gün ikisi de görevli), bu yüzden ayrımı yalnızca
    // ağırlıklı yük yapar: dün yedek olan, dün asil olandan daha az yük
    // taşıdığından gün 2'de asil seçilir.
    expect(gun2.asil).toBe(gun1.yedek);
    expect(gun2.yedek).toBe(gun1.asil);
  });

  it('tekKisiliGunleriBul, yalnızca tek kişinin (yedeksiz) müsait olduğu günleri tespit eder', () => {
    const muezzinler = [
      muezzin('a'),
      muezzin('b', { haftalikIzinGunu: 1 }), // Pazartesi izinli
    ];

    const plan = haftalikPlanUret(['2026-08-03', '2026-08-04'], muezzinler, []);

    // 2026-08-03 Pazartesi: yalnızca a müsait (b izinli) -> tek kişili.
    // 2026-08-04 Salı: ikisi de müsait -> tek kişili değil.
    expect(tekKisiliGunleriBul(plan)).toEqual(['2026-08-03']);
  });

  it('tekKisiliGunleriBul, hiç kimsenin müsait olmadığı (Sistem/Sistem) günleri saymaz', () => {
    const muezzinler = [
      muezzin('a', { haftalikIzinGunu: 1 }),
      muezzin('b', { haftalikIzinGunu: 1 }),
    ];

    const plan = haftalikPlanUret(['2026-08-03'], muezzinler, []);

    expect(tekKisiliGunleriBul(plan)).toEqual([]);
  });

  it('kapsamsizGunleriBul, hiç kimsenin müsait olmadığı günleri tespit eder (O3 regresyonu)', () => {
    // Önceden bu durum (kadro yeterli ama belirli bir gün herkes izinli)
    // hiçbir uyarı üretmiyordu — bkz. mimari denetim O3.
    const muezzinler = [
      muezzin('a', { haftalikIzinGunu: 1 }), // Pazartesi izinli
      muezzin('b', { haftalikIzinGunu: 1 }), // Pazartesi izinli
    ];

    const plan = haftalikPlanUret(['2026-08-03', '2026-08-04'], muezzinler, []);

    expect(kapsamsizGunleriBul(plan)).toEqual(['2026-08-03']);
  });

  it('kapsamsizGunleriBul, tek kişinin müsait olduğu günü kapsamsız saymaz', () => {
    const muezzinler = [
      muezzin('a'),
      muezzin('b', { haftalikIzinGunu: 1 }),
    ];

    const plan = haftalikPlanUret(['2026-08-03'], muezzinler, []);

    expect(kapsamsizGunleriBul(plan)).toEqual([]);
  });

  it('sürekli yedek kalma kilidini kırar: 3 kişilik kadroda 4 hafta sonunda herkes en az bir kez asil olmuş olur (K6 regresyonu)', () => {
    // Mimari denetimde bulunan gerçek hata: yedeklik hiçbir kalıcı sayaca
    // işlenmediği için SOS + haftalık-yük-sıfırlama etkileşimi bir kişiyi
    // süresiz yedekte kilitliyordu (4 hafta sonunda gözlenen gerçek dağılım:
    // asil {aaa:70, bbb:0, ccc:70}). Bu test, scripts/yatsiSonuIslemleri.ts'in
    // gün sonu kalıcı kredilendirmesini (aylikVakitSayisi + aylikYedekSayisi)
    // hafta hafta simüle ederek kilidin artık kırıldığını doğrular.
    let muezzinler: MuezzinAday[] = [muezzin('aaa'), muezzin('bbb'), muezzin('ccc')];
    const haftalar = [
      ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09'],
      ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'],
      ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23'],
      ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'],
    ];
    const toplamAsilSayisi: Record<string, number> = { aaa: 0, bbb: 0, ccc: 0 };
    let oncekiHaftaSonEkibi: string[] = [];

    for (const gunler of haftalar) {
      const plan = haftalikPlanUret(gunler, muezzinler, [], undefined, oncekiHaftaSonEkibi);

      const haftaAsilKredi: Record<string, number> = { aaa: 0, bbb: 0, ccc: 0 };
      const haftaYedekKredi: Record<string, number> = { aaa: 0, bbb: 0, ccc: 0 };
      for (const gun of gunler) {
        for (const vakit of VAKITLER) {
          const atama = plan[gun][vakit];
          if (atama.asil !== 'Sistem') {
            haftaAsilKredi[atama.asil]++;
            toplamAsilSayisi[atama.asil]++;
          }
          if (atama.yedek !== 'Sistem') haftaYedekKredi[atama.yedek]++;
        }
      }

      // scripts/yatsiSonuIslemleri.ts'in gün sonu kalıcı kredilendirmesinin
      // hafta sonundaki eşdeğeri.
      muezzinler = muezzinler.map((m) => ({
        ...m,
        aylikVakitSayisi: (m.aylikVakitSayisi || 0) + haftaAsilKredi[m.id],
        aylikYedekSayisi: (m.aylikYedekSayisi || 0) + haftaYedekKredi[m.id],
      }));

      const sonGun = gunler[6];
      const sonVakitAtama = plan[sonGun].yatsi;
      oncekiHaftaSonEkibi = [sonVakitAtama.asil, sonVakitAtama.yedek].filter((uid) => uid !== 'Sistem');
    }

    expect(Object.values(toplamAsilSayisi).every((n) => n > 0)).toBe(true);
  });
});

describe('nobeteAtanabilirMi', () => {
  it('aktif, onay bekleyen olmayan bir muezzin icin true doner', () => {
    expect(nobeteAtanabilirMi({ role: 'muezzin', onayBekliyor: false })).toBe(true);
  });

  it('onayBekliyor alani hic olmayan (eski) bir muezzin icin true doner (fail-open)', () => {
    expect(nobeteAtanabilirMi({ role: 'muezzin' })).toBe(true);
  });

  it('onayBekliyor:true olan bir davetli icin false doner (Y4 regresyonu)', () => {
    // AuthGuard bu kisiye zaten bir bekleme ekrani gosteriyor — gorevini
    // goremedigi bir vakte atanmamali (bkz. mimari denetim Y4).
    expect(nobeteAtanabilirMi({ role: 'muezzin', onayBekliyor: true })).toBe(false);
  });

  it('admin/gozlemci rolu icin false doner', () => {
    expect(nobeteAtanabilirMi({ role: 'admin', onayBekliyor: false })).toBe(false);
    expect(nobeteAtanabilirMi({ role: 'gozlemci', onayBekliyor: false })).toBe(false);
  });
});
