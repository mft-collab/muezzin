import assert from 'node:assert/strict';
import {
  calculateKerahatTimes,
  calculateLastThirdOfNight,
  calculateVakitProgress,
  getHaftaIdFromDate,
  parseVakitToDate,
  toTurkishUpperCase
} from '../src/lib/dateUtils';
import { tieBreakerSirala } from '../src/utils/tieBreaker';
import { haftalikPlanUret } from '../src/lib/planlamaCekirdegi';
import { mevcutVaktiHesapla, sonrakiVaktiHesapla } from '../src/services/ezanVaktiServisi';
import { Muezzin } from '../src/types';
import { isRamazanArifeOncesi, isKurbanArifeOncesi, isRamazanBaslangiciOncesi } from '../src/lib/islamicCalendar';

type TestCase = {
  name: string;
  run: () => void;
};

const muezzin = (id: string, aylikVakitSayisi = 0): Muezzin & { id: string } => ({
  id,
  displayName: id.toUpperCase(),
  photoURL: '',
  role: 'muezzin',
  aktif: true,
  fcmToken: null,
  aylikVakitSayisi
});

function withFakeNow<T>(isoDate: string, run: () => T): T {
  const RealDate = globalThis.Date;
  const fixedTime = new RealDate(isoDate).getTime();

  class FakeDate extends RealDate {
    constructor(...args: ConstructorParameters<typeof Date>) {
      if (args.length === 0) {
        super(fixedTime);
      } else {
        super(...args);
      }
    }

    static now() {
      return fixedTime;
    }

    getTimezoneOffset() {
      return 0;
    }
  }

  globalThis.Date = FakeDate as DateConstructor;
  try {
    return run();
  } finally {
    globalThis.Date = RealDate;
  }
}

const tests: TestCase[] = [
  {
    name: 'hafta id pazartesi baslangicina sabitlenir',
    run: () => {
      assert.equal(getHaftaIdFromDate('2026-05-18'), 'W2026-05-18');
      assert.equal(getHaftaIdFromDate('2026-05-22'), 'W2026-05-18');
      assert.equal(getHaftaIdFromDate('2026-05-24'), 'W2026-05-18');
      assert.equal(getHaftaIdFromDate('2026-05-25'), 'W2026-05-25');
    }
  },
  {
    name: 'vakit tarihi saat ve dakika bilgisini korur',
    run: () => {
      const parsed = parseVakitToDate('2026-05-22', '13:15');
      assert.ok(parsed);
      assert.equal(parsed.getFullYear(), 2026);
      assert.equal(parsed.getMonth(), 4);
      assert.equal(parsed.getDate(), 22);
      assert.equal(parsed.getHours(), 13);
      assert.equal(parsed.getMinutes(), 15);
      assert.equal(parsed.getSeconds(), 0);
    }
  },
  {
    name: 'turkce buyuk harf donusumu I harfini dogru ele alir',
    run: () => {
      assert.equal(toTurkishUpperCase('ikindi'), 'İKİNDİ');
      assert.equal(toTurkishUpperCase('i'), 'İ');
    }
  },
  {
    name: 'mevcut ve sonraki vakit ogle oncesinde tutarli hesaplanir',
    run: () => withFakeNow('2026-05-22T03:00:00.000Z', () => {
      const bugun = {
        tarih: '2026-05-22',
        sabah: '05:00',
        gunes: '06:30',
        ogle: '13:00',
        ikindi: '17:00',
        aksam: '20:00',
        yatsi: '21:30'
      };

      assert.equal(mevcutVaktiHesapla(bugun), 'sabah');
      const sonraki = sonrakiVaktiHesapla(bugun);
      assert.equal(sonraki?.vakit, 'ogle');
      assert.equal(sonraki?.ezanSaati.getHours(), 13);
    })
  },
  {
    name: 'gunun son vakti gecince sonraki vakit yarinin sabahidir',
    run: () => withFakeNow('2026-05-22T16:00:00.000Z', () => {
      const bugun = {
        tarih: '2026-05-22',
        sabah: '05:00',
        gunes: '06:30',
        ogle: '13:00',
        ikindi: '17:00',
        aksam: '20:00',
        yatsi: '21:30'
      };
      const yarin = {
        tarih: '2026-05-23',
        sabah: '05:01',
        gunes: '06:31',
        ogle: '13:01',
        ikindi: '17:01',
        aksam: '20:01',
        yatsi: '21:31'
      };

      const sonraki = sonrakiVaktiHesapla(bugun, yarin);
      assert.equal(sonraki?.vakit, 'sabah');
      assert.equal(sonraki?.ezanSaati.getDate(), 23);
      assert.equal(sonraki?.ezanSaati.getHours(), 5);
      assert.equal(sonraki?.ezanSaati.getMinutes(), 1);
    })
  },
  {
    name: 'tie breaker dusuk toplam yuku once siralar',
    run: () => {
      const sirali = tieBreakerSirala(
        [muezzin('a', 2), muezzin('b', 0), muezzin('c', 1)],
        { a: 0, b: 0, c: 0 }
      );
      assert.deepEqual(sirali.map(p => p.id), ['b', 'c', 'a']);
    }
  },
  {
    name: 'tie breaker onceki gorevlileri sona iter',
    run: () => {
      const sirali = tieBreakerSirala(
        [muezzin('a', 0), muezzin('b', 0), muezzin('c', 0)],
        {},
        ['a']
      );
      assert.equal(sirali.at(-1)?.id, 'a');
    }
  },
  {
    name: 'K3: haftalik plan ureticisi izinli personeli asla atamaz',
    run: () => {
      const gunler = ['2026-06-01', '2026-06-02'];
      const muezzinler = [muezzin('a'), muezzin('b'), muezzin('c')];
      const onayliIzinler = [{ uid: 'a', baslangic: '2026-06-01', bitis: '2026-06-01' }];

      const plan = haftalikPlanUret(gunler, muezzinler, onayliIzinler);

      for (const vakit of ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'] as const) {
        assert.notEqual(plan['2026-06-01'][vakit].asil, 'a', `2026-06-01 ${vakit}: izinli 'a' asil atanmis`);
        assert.notEqual(plan['2026-06-01'][vakit].yedek, 'a', `2026-06-01 ${vakit}: izinli 'a' yedek atanmis`);
      }
    }
  },
  {
    name: 'K3: haftalik plan ureticisi sabit haftalik izin gununde atama yapmaz',
    run: () => {
      // 2026-06-01 Pazartesi (haftalikIzinGunu ölçeği: Pazartesi=1)
      const gunler = ['2026-06-01'];
      const muezzinler = [
        { ...muezzin('a'), haftalikIzinGunu: 1 },
        muezzin('b'),
        muezzin('c')
      ];

      const plan = haftalikPlanUret(gunler, muezzinler, []);

      assert.notEqual(plan['2026-06-01'].sabah.asil, 'a');
      assert.notEqual(plan['2026-06-01'].sabah.yedek, 'a');
    }
  },
  {
    name: 'K3: korunmusAtama resolver mevcut atamayi degistirmeden korur',
    run: () => {
      const gunler = ['2026-06-01'];
      const muezzinler = [muezzin('a'), muezzin('b'), muezzin('c')];

      const plan = haftalikPlanUret(gunler, muezzinler, [], (gun, vakit) => {
        if (gun === '2026-06-01' && vakit === 'sabah') {
          return { asil: 'c', yedek: 'Sistem' };
        }
        return null;
      });

      assert.deepEqual(plan['2026-06-01'].sabah, { asil: 'c', yedek: 'Sistem' });
      // Korunmayan diğer vakitler taze hesaplanmaya devam eder (Sistem değil).
      assert.notEqual(plan['2026-06-01'].ogle.asil, 'Sistem');
    }
  },
  {
    name: 'kerahat ve gece hesaplari tutarli araliklar uretir',
    run: () => {
      const sabah = new Date(2026, 4, 22, 5, 30);
      const ogle = new Date(2026, 4, 22, 12, 45);
      const aksam = new Date(2026, 4, 22, 20, 0);
      const kerahat = calculateKerahatTimes(sabah, ogle, aksam);

      assert.equal(kerahat.sabah.bitis.getTime() - kerahat.sabah.baslangic.getTime(), 40 * 60 * 1000);
      assert.equal(kerahat.ogle.bitis.getTime() - kerahat.ogle.baslangic.getTime(), 15 * 60 * 1000);
      assert.equal(kerahat.aksam.bitis.getTime() - kerahat.aksam.baslangic.getTime(), 40 * 60 * 1000);

      const lastThird = calculateLastThirdOfNight(
        new Date(2026, 4, 22, 20, 0),
        new Date(2026, 4, 23, 4, 30)
      );
      assert.equal(lastThird.getHours(), 1);
      assert.equal(lastThird.getMinutes(), 40);
    }
  },
  {
    name: 'vakit progress 0 ve 1 arasinda kalir',
    run: () => {
      const start = new Date(2026, 4, 22, 10, 0);
      const end = new Date(2026, 4, 22, 11, 0);
      assert.equal(calculateVakitProgress(start, end, new Date(2026, 4, 22, 9, 0)), 0);
      assert.equal(calculateVakitProgress(start, end, new Date(2026, 4, 22, 10, 30)), 0.5);
      assert.equal(calculateVakitProgress(start, end, new Date(2026, 4, 22, 12, 0)), 1);
    }
  },
  {
    name: 'arife oncesi gunleri dogru tespit edilir',
    run: () => {
      // 2026 Kurban Bayramı Arefesi: 9 Zilhicce. 2026-05-26 Kurban Arefesidir (9 Zilhicce 1447)
      // Dolayısıyla 2026-05-25 Kurban Arefesinden 1 gün öncesidir (8 Zilhicce 1447)
      const arifeOncesiDate = new Date(2026, 4, 25, 12, 0, 0); // 25 May 2026
      const arifeDate = new Date(2026, 4, 26, 12, 0, 0); // 26 May 2026
      
      assert.ok(isKurbanArifeOncesi(arifeOncesiDate));
      assert.ok(!isKurbanArifeOncesi(arifeDate));
    }
  },
  {
    name: 'ramazan baslangici oncesi dogru tespit edilir',
    run: () => {
      // Ramazan 1. günü 2026-02-18 tarihindedir (1 Ramazan 1447)
      // Dolayısıyla 2026-02-17 tarihi Ramazan'dan 1 gün öncesidir (Şaban ayının son günü)
      const ramazanOncesiDate = new Date(2026, 1, 17, 12, 0, 0); // 17 Şubat 2026
      const ramazanBaslangicDate = new Date(2026, 1, 18, 12, 0, 0); // 18 Şubat 2026
      
      assert.ok(isRamazanBaslangiciOncesi(ramazanOncesiDate));
      assert.ok(!isRamazanBaslangiciOncesi(ramazanBaslangicDate));
    }
  }
];

for (const test of tests) {
  test.run();
  console.log(`OK ${test.name}`);
}

console.log(`${tests.length} smoke test passed`);
