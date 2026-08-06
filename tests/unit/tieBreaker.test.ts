import { describe, it, expect } from 'vitest';
import { tieBreakerSirala, ARD_ARDA_YEDEK_ESIGI } from '../../src/utils/tieBreaker';
import { Muezzin } from '../../src/types';

function muezzin(id: string, overrides: Partial<Muezzin> = {}): Muezzin & { id: string } {
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

describe('tieBreakerSirala', () => {
  it('sıralamayı aylık + haftalık ağırlıklı toplam yüke göre artan sırada verir', () => {
    const muezzinler = [
      muezzin('a', { aylikVakitSayisi: 10 }),
      muezzin('b', { aylikVakitSayisi: 2 }),
      muezzin('c', { aylikVakitSayisi: 6 }),
    ];

    const sirali = tieBreakerSirala(muezzinler, { a: 0, b: 0, c: 0 });

    expect(sirali.map((m) => m.id)).toEqual(['b', 'c', 'a']);
  });

  it('bir önceki vakitte görevli olanları toplam yük eşit olsa bile en sona atar (SOS kuralı)', () => {
    const muezzinler = [
      muezzin('a', { aylikVakitSayisi: 5 }),
      muezzin('b', { aylikVakitSayisi: 5 }),
      muezzin('c', { aylikVakitSayisi: 5 }),
    ];

    const sirali = tieBreakerSirala(muezzinler, {}, ['a', 'b']);

    expect(sirali[0].id).toBe('c');
    expect(sirali.map((m) => m.id).slice(1)).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('orijinal diziyi mutasyona uğratmaz', () => {
    const muezzinler = [
      muezzin('a', { aylikVakitSayisi: 10 }),
      muezzin('b', { aylikVakitSayisi: 2 }),
    ];
    const originalOrder = muezzinler.map((m) => m.id);

    tieBreakerSirala(muezzinler, {});

    expect(muezzinler.map((m) => m.id)).toEqual(originalOrder);
  });

  it('Cuma vakitlerinde bu haftaki yükü 1.5 kat ağırlıklandırarak sıralamayı değiştirebilir', () => {
    // a: aylık 3, bu hafta 0 görev -> normal ağırlıklı toplam 3
    // b: aylık 0, bu hafta 2 görev -> normal ağırlıklı toplam 2 (b önde)
    // Cuma çarpanıyla b'nin toplamı 0 + 2*1.5 = 3'e çıkıp a'nınkine eşitlenir; bu durumda
    // sıralama haftalık yük eşitliği kuralına düşer ve haftalık yükü daha düşük olan a öne geçer.
    const muezzinler = [
      muezzin('a', { aylikVakitSayisi: 3 }),
      muezzin('b', { aylikVakitSayisi: 0 }),
    ];
    const buHaftakiYukler = { a: 0, b: 2 };

    const normalGun = tieBreakerSirala(muezzinler, buHaftakiYukler, [], false);
    const cuma = tieBreakerSirala(muezzinler, buHaftakiYukler, [], true);

    expect(normalGun.map((m) => m.id)).toEqual(['b', 'a']);
    expect(cuma.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('Cuma adaleti kademesi, aylık toplamın Cuma çarpanını bastırdığı durumda devreye girer', () => {
    // a: aylık toplamı düşük (3) ama bu ay zaten 3 kez Cuma yapmış.
    // b: aylık toplamı yüksek (10) ama bu ay hiç Cuma yapmamış.
    // Eski davranışta (aylikCumaSayilari verilmeden) Cuma'da bile a'nın düşük
    // aylık toplamı kazanırdı — bu da Cuma ağırlığının ay ilerledikçe
    // görünmez hale gelmesi sorunuydu. Yeni kademe bunu SOS'tan hemen sonra,
    // ağırlıklı toplamdan önce karşılaştırarak düzeltir.
    const muezzinler = [
      muezzin('a', { aylikVakitSayisi: 3 }),
      muezzin('b', { aylikVakitSayisi: 10 }),
    ];
    const aylikCumaSayilari = { a: 3, b: 0 };

    const cumaOncesi = tieBreakerSirala(muezzinler, {}, [], true); // aylikCumaSayilari verilmedi
    const cumaSonrasi = tieBreakerSirala(muezzinler, {}, [], true, aylikCumaSayilari);

    expect(cumaOncesi.map((m) => m.id)).toEqual(['a', 'b']); // eski davranış: aylık toplam kazanır
    expect(cumaSonrasi.map((m) => m.id)).toEqual(['b', 'a']); // yeni davranış: Cuma adaleti kazanır
  });

  it('Cuma adaleti kademesi, Cuma olmayan günlerde devreye girmez', () => {
    const muezzinler = [
      muezzin('a', { aylikVakitSayisi: 3 }),
      muezzin('b', { aylikVakitSayisi: 10 }),
    ];
    const aylikCumaSayilari = { a: 3, b: 0 };

    const sirali = tieBreakerSirala(muezzinler, {}, [], false, aylikCumaSayilari);

    expect(sirali.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('art arda yedek eşiğini aşan kişi, ağırlıklı toplamı en düşük olsa bile tekrar yedek seçilmez (K6 sınır testi)', () => {
    // a: dün asildi, yüklü. b: dün yedekti, en az yüklü AMA art arda yedek
    // eşiğini zaten aşmış. c: dün boştaydı (SOS'tan muaf, her zaman asil).
    // Eşik olmasaydı b (en az yüklü) tekrar yedek olurdu — küçük kadrolarda
    // bu süresiz bir yedek kilidine yol açıyordu (bkz. mimari denetim K6).
    const muezzinler = [
      muezzin('a', { aylikVakitSayisi: 100 }),
      muezzin('b', { aylikVakitSayisi: 0 }),
      muezzin('c', { aylikVakitSayisi: 50 }),
    ];
    const ardArdaYedekSayilari = { b: ARD_ARDA_YEDEK_ESIGI };

    const sirali = tieBreakerSirala(muezzinler, {}, ['a', 'b'], false, {}, ardArdaYedekSayilari);

    expect(sirali[0].id).toBe('c'); // SOS'tan muaf, her zaman asil
    expect(sirali[1].id).toBe('a'); // b eşiği aştığı için yedek yarışından çıkar, a yedek olur
    expect(sirali[2].id).toBe('b'); // b o gün tamamen boşta kalır
  });

  it('art arda yedek eşiğinin altındaki kişi normal ağırlıklı toplama göre sıralanır', () => {
    const muezzinler = [
      muezzin('a', { aylikVakitSayisi: 100 }),
      muezzin('b', { aylikVakitSayisi: 0 }),
      muezzin('c', { aylikVakitSayisi: 50 }),
    ];
    const ardArdaYedekSayilari = { b: ARD_ARDA_YEDEK_ESIGI - 1 }; // eşiğin altında

    const sirali = tieBreakerSirala(muezzinler, {}, ['a', 'b'], false, {}, ardArdaYedekSayilari);

    expect(sirali[0].id).toBe('c');
    expect(sirali[1].id).toBe('b'); // eşik aşılmadı, en az yüklü (b) yedek olur
    expect(sirali[2].id).toBe('a');
  });

  it('tüm kriterler eşitse alfabetik değil, id karakter kodu toplamına göre sıralar', () => {
    // Alfabetik sırada 'aa-uid' < 'b-uid' olurdu; karakter kodu toplamına göre ise
    // 'b-uid' (465) 'aa-uid' (561) toplamından küçük olduğu için önce gelir.
    const muezzinler = [
      muezzin('aa-uid'),
      muezzin('b-uid'),
    ];

    const sirali = tieBreakerSirala(muezzinler, {});

    expect(sirali.map((m) => m.id)).toEqual(['b-uid', 'aa-uid']);
  });
});
