import { describe, it, expect } from 'vitest';
import {
  korumaliSlotMu,
  guncelSlotBildirimleriniSec,
  SlotBildirimVerisi,
} from '../../src/lib/slotKorumasi';
import { haftalikPlanUret, MuezzinAday, VAKITLER } from '../../src/lib/planlamaCekirdegi';
import { Muezzin, Vakit, VakitAtama } from '../../src/types';

function ts(millis: number) {
  return { toMillis: () => millis };
}

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

/**
 * src/services/planServisi.ts'teki `korunmusAtama` çözücüsünün SAF kopyası —
 * Firestore'a dokunmadan bir "self-healing" turunu simüle edebilmek için.
 * Buradaki mantık orayla birebir aynı kalmalı; iki fonksiyon da
 * src/lib/slotKorumasi.ts'in aynı iki kararını kullanır.
 */
function selfHealSimulasyonu(
  slotlar: Record<string, SlotBildirimVerisi[]>,
  mevcutGunler: Record<string, Record<string, VakitAtama>>,
  izinliUidler: (gun: string) => ReadonlySet<string> = () => new Set<string>()
) {
  return (gun: string, vakit: Vakit) => {
    const slotBildirimleri = slotlar[`${gun}_${vakit}`] || [];
    if (!korumaliSlotMu(slotBildirimleri, izinliUidler(gun))) return null;

    const mevcutAtama = mevcutGunler[gun]?.[vakit];
    const { asil: asilBildirim, yedek: yedekBildirim } = guncelSlotBildirimleriniSec(slotBildirimleri);
    return {
      asil: asilBildirim?.uid || mevcutAtama?.asil || 'Sistem',
      yedek: yedekBildirim?.uid || mevcutAtama?.yedek || 'Sistem',
      asilYukSayilmasin: asilBildirim?.durum === 'reddedildi',
      yedekYukSayilmasin: yedekBildirim?.durum === 'reddedildi',
    };
  };
}

describe('guncelSlotBildirimleriniSec', () => {
  it('yedek terfisi sonrası ESKİ (reddedilmiş) asil belgesini değil, TERFİ EDEN belgeyi seçer', () => {
    // Terfi YERİNDE yapılır (bkz. scripts/mazeretDevirleriniIsle.ts ve
    // mazeretServisi.ts kriziBaslat): `..._yedek` belgesinin `tip`i 'asil'e
    // çevrilir, mazeret bildirenin `..._asil` belgesi denetim izi olarak
    // KALIR. Firestore sorgu sonucu belge-ID sırasındadır (`_asil` < `_yedek`),
    // bu yüzden eski `find(tip === 'asil')` HER ZAMAN mazeret bildireni
    // döndürüyordu.
    const slot: SlotBildirimVerisi[] = [
      { tip: 'asil', uid: 'mazeretli', durum: 'reddedildi', sonGuncelleme: ts(1000) },
      { tip: 'asil', uid: 'terfi_eden', durum: 'bekliyor', sonGuncelleme: ts(2000) },
    ];

    const { asil, yedek } = guncelSlotBildirimleriniSec(slot);

    expect(asil?.uid).toBe('terfi_eden');
    expect(asil?.durum).toBe('bekliyor');
    // Terfi sonrası slotta artık `tip: 'yedek'` belge kalmaz.
    expect(yedek).toBeUndefined();
  });

  it('terfi belgesi ID sırasında ÖNCE gelse bile aynı sonucu verir (sıralamaya bağımlı değil)', () => {
    const slot: SlotBildirimVerisi[] = [
      { tip: 'asil', uid: 'terfi_eden', durum: 'bekliyor', sonGuncelleme: ts(2000) },
      { tip: 'asil', uid: 'mazeretli', durum: 'reddedildi', sonGuncelleme: ts(1000) },
    ];

    expect(guncelSlotBildirimleriniSec(slot).asil?.uid).toBe('terfi_eden');
  });

  it('tek bir asil/yedek çifti varsa eski davranışın aynısını üretir', () => {
    const slot: SlotBildirimVerisi[] = [
      { tip: 'asil', uid: 'a', durum: 'onaylandi', sonGuncelleme: ts(1) },
      { tip: 'yedek', uid: 'b', durum: 'bekliyor', sonGuncelleme: ts(1) },
    ];

    const { asil, yedek } = guncelSlotBildirimleriniSec(slot);
    expect(asil?.uid).toBe('a');
    expect(yedek?.uid).toBe('b');
  });

  it('terfi olmadan yalnızca reddedilmiş bir asil belgesi varsa yine onu döndürür (PL-O5 yük muafiyeti korunur)', () => {
    // mazeretDevirleriniIsle.ts henüz çalışmadıysa (ya da uygun yedek
    // bulunamadıysa) slotta tek bir 'asil' belgesi vardır ve `reddedildi`
    // olmasına rağmen seçilmelidir — `asilYukSayilmasin` bayrağı buna bağlı.
    const slot: SlotBildirimVerisi[] = [
      { tip: 'asil', uid: 'mazeretli', durum: 'reddedildi', sonGuncelleme: ts(1000) },
      { tip: 'yedek', uid: 'yedekci', durum: 'bekliyor', sonGuncelleme: ts(500) },
    ];

    const { asil, yedek } = guncelSlotBildirimleriniSec(slot);
    expect(asil?.uid).toBe('mazeretli');
    expect(asil?.durum).toBe('reddedildi');
    expect(yedek?.uid).toBe('yedekci');
  });

  it('iki aday da reddedilmemişse en son güncellenen kazanır', () => {
    const slot: SlotBildirimVerisi[] = [
      { tip: 'asil', uid: 'eski', durum: 'bekliyor', sonGuncelleme: ts(100) },
      { tip: 'asil', uid: 'yeni', durum: 'bekliyor', sonGuncelleme: ts(900) },
    ];

    expect(guncelSlotBildirimleriniSec(slot).asil?.uid).toBe('yeni');
  });
});

describe('self-healing turu, mazeret sonrası yedek terfisini GERİ ALMAZ', () => {
  const GUN = '2026-08-03'; // Pazartesi
  const muezzinler = [muezzin('mazeretli'), muezzin('terfi_eden'), muezzin('ucuncu')];

  function terfiSonrasiSlotlar() {
    const slotlar: Record<string, SlotBildirimVerisi[]> = {};
    for (const vakit of VAKITLER) {
      slotlar[`${GUN}_${vakit}`] = [
        // Mazeret bildiren kişinin belgesi — SİLİNMEZ, `tip`i hâlâ 'asil'.
        { tip: 'asil', uid: 'mazeretli', durum: 'reddedildi', sonGuncelleme: ts(1000) },
        // scripts/mazeretDevirleriniIsle.ts'in YERİNDE terfi ettirdiği belge.
        { tip: 'asil', uid: 'terfi_eden', durum: 'bekliyor', sonGuncelleme: ts(2000) },
      ];
    }
    return slotlar;
  }

  it('plan, terfi eden kişiyi asil olarak korur (mazeret bildiren geri gelmez)', () => {
    // haftaPlanlari, terfi transaction'ında zaten senkronlanmıştı.
    const mevcutGunler = {
      [GUN]: Object.fromEntries(VAKITLER.map((v) => [v, { asil: 'terfi_eden', yedek: 'Sistem' }])),
    };

    const plan = haftalikPlanUret(
      [GUN],
      muezzinler,
      [],
      selfHealSimulasyonu(terfiSonrasiSlotlar(), mevcutGunler)
    );

    for (const vakit of VAKITLER) {
      // Hatalı davranış: { asil: 'mazeretli', yedek: 'Sistem' } — terfi
      // sessizce geri alınıyor, plan ile bildirimler/push birbirine düşüyordu.
      expect(plan[GUN][vakit]).toEqual({ asil: 'terfi_eden', yedek: 'Sistem' });
    }
  });

  it('terfi eden kişi haftalık yük ve dinlenme (SOS) kredisini alır', () => {
    const ERTESI = '2026-08-04';
    const mevcutGunler = {
      [GUN]: Object.fromEntries(VAKITLER.map((v) => [v, { asil: 'terfi_eden', yedek: 'Sistem' }])),
    };

    const plan = haftalikPlanUret(
      [GUN, ERTESI],
      muezzinler,
      [],
      selfHealSimulasyonu(terfiSonrasiSlotlar(), mevcutGunler)
    );

    // Terfi eden kişi Pazartesi fiilen asil görev yaptı — Salı günü SOS
    // (dinlenme) kuralıyla asil seçilemez. Hatalı davranışta bu gün hiç
    // kimseye asil kredisi yazılmadığından ('mazeretli' + asilYukSayilmasin)
    // SOS listesi boş kalıyor ve terfi eden kişi ertesi gün de asil
    // olabiliyordu.
    expect(plan[ERTESI].sabah.asil).not.toBe('terfi_eden');
  });
});

describe('korumaliSlotMu — onaylı izin ezmesi', () => {
  const onaylanmisSlot: SlotBildirimVerisi[] = [
    { tip: 'asil', uid: 'a', durum: 'onaylandi', sonGuncelleme: ts(10) },
    { tip: 'yedek', uid: 'b', durum: 'bekliyor', sonGuncelleme: ts(10) },
  ];

  it('izin bilgisi verilmezse eski davranış aynen korunur', () => {
    expect(korumaliSlotMu(onaylanmisSlot)).toBe(true);
    expect(korumaliSlotMu(onaylanmisSlot, new Set())).toBe(true);
  });

  it('korumasız (yalnızca bekleyen) bir slot korumasız kalır', () => {
    expect(korumaliSlotMu([{ tip: 'asil', uid: 'a', durum: 'bekliyor' }])).toBe(false);
  });

  it('"okudum" demiş kişinin o güne izni onaylanırsa koruma düşer', () => {
    expect(korumaliSlotMu(onaylanmisSlot, new Set(['a']))).toBe(false);
  });

  it('elle atanmış (manuelAtama) bir slotun korumasını da izin ezer', () => {
    const manuel: SlotBildirimVerisi[] = [
      { tip: 'asil', uid: 'a', durum: 'bekliyor', manuelAtama: true },
    ];
    expect(korumaliSlotMu(manuel)).toBe(true);
    expect(korumaliSlotMu(manuel, new Set(['a']))).toBe(false);
  });

  it('slottaki BAŞKA birinin izni korumayı düşürmez', () => {
    expect(korumaliSlotMu(onaylanmisSlot, new Set(['baskasi']))).toBe(true);
  });

  it('mazeret (reddedildi) kaydını izin EZMEZ — denetim izi ve devir hedefidir', () => {
    const mazeretli: SlotBildirimVerisi[] = [
      { tip: 'asil', uid: 'a', durum: 'reddedildi', sonGuncelleme: ts(10) },
    ];
    expect(korumaliSlotMu(mazeretli, new Set(['a']))).toBe(true);
  });

  it('tamamlanmış geçmiş günü (okundu_varsayilan) izin EZMEZ (K7 regresyonu)', () => {
    const gecmis: SlotBildirimVerisi[] = [
      { tip: 'asil', uid: 'a', durum: 'okundu_varsayilan', sonGuncelleme: ts(10) },
    ];
    expect(korumaliSlotMu(gecmis, new Set(['a']))).toBe(true);
  });

  it('görev çağrısını ve devam eden vekalet devrini izin EZMEZ', () => {
    expect(korumaliSlotMu([{ tip: 'gorev_cagrisi', uid: 'a', durum: 'bekliyor' }], new Set(['a']))).toBe(true);
    expect(korumaliSlotMu([{ tip: 'asil', uid: 'a', durum: 'bekliyor', vekaletDevriBekliyor: true }], new Set(['a']))).toBe(true);
    expect(korumaliSlotMu([{ tip: 'asil', uid: 'a', durum: 'bekliyor', vekaletDevredildi: true }], new Set(['a']))).toBe(true);
  });

  it('slotta ezilemez TÜRDE tek bir koruma bile varsa slot bütünüyle korunur', () => {
    // Kısmi silme, aynı slotun bildirim belgeleriyle plan belgesini
    // birbirinden ayırırdı.
    const karma: SlotBildirimVerisi[] = [
      { tip: 'asil', uid: 'a', durum: 'onaylandi', sonGuncelleme: ts(10) },
      { tip: 'yedek', uid: 'b', durum: 'reddedildi', sonGuncelleme: ts(10) },
    ];
    expect(korumaliSlotMu(karma, new Set(['a']))).toBe(true);
  });
});

describe('onaylandıktan SONRA onaylanan izin, kişiyi slottan çıkarır (self-healing turu)', () => {
  const GUN = '2026-08-03';

  it('izin onayı sonrası çalışan self-heal, izinli kişiyi hiçbir vakte atamaz', () => {
    const muezzinler = [muezzin('izinli'), muezzin('bbb'), muezzin('ccc')];
    // Plan yayınlandı, 'izinli' tüm vakitler için "okudum" dedi.
    const slotlar: Record<string, SlotBildirimVerisi[]> = {};
    for (const vakit of VAKITLER) {
      slotlar[`${GUN}_${vakit}`] = [
        { tip: 'asil', uid: 'izinli', durum: 'onaylandi', sonGuncelleme: ts(10) },
        { tip: 'yedek', uid: 'bbb', durum: 'bekliyor', sonGuncelleme: ts(10) },
      ];
    }
    const mevcutGunler = {
      [GUN]: Object.fromEntries(VAKITLER.map((v) => [v, { asil: 'izinli', yedek: 'bbb' }])),
    };
    const onayliIzinler = [{ uid: 'izinli', baslangic: GUN, bitis: GUN }];
    const izinliSet = () => new Set(['izinli']);

    // Ezme OLMADAN (eski davranış): koruma slotu taze hesaplamaya hiç
    // ulaştırmıyor, izinli kişi nöbetçi kalıyor.
    const eskiPlan = haftalikPlanUret(
      [GUN],
      muezzinler,
      onayliIzinler,
      selfHealSimulasyonu(slotlar, mevcutGunler)
    );
    expect(eskiPlan[GUN].sabah.asil).toBe('izinli');

    // Ezme İLE: slot korumasız sayılır, çekirdeğin izin filtresi devreye
    // girer ve yerine adalet/tie-breaker ile seçilmiş biri atanır.
    const yeniPlan = haftalikPlanUret(
      [GUN],
      muezzinler,
      onayliIzinler,
      selfHealSimulasyonu(slotlar, mevcutGunler, izinliSet)
    );
    for (const vakit of VAKITLER) {
      expect(yeniPlan[GUN][vakit].asil).not.toBe('izinli');
      expect(yeniPlan[GUN][vakit].yedek).not.toBe('izinli');
      expect(yeniPlan[GUN][vakit].asil).not.toBe('Sistem');
      expect(yeniPlan[GUN][vakit].yedek).not.toBe('Sistem');
    }
  });
});
