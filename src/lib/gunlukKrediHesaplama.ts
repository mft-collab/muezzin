/**
 * Bir günün (yatsı sonrası) tüm bildirimlerinden kalıcı aylık yük
 * sayaçlarına (aylikVakitSayisi/aylikCumaSayisi/aylikYedekSayisi) işlenecek
 * kredileri hesaplayan SAF (yan etkisiz) çekirdek — scripts/yatsiSonuIslemleri.ts
 * bunu çağırıp sonucu Firestore'a yazar. planlamaCekirdegi.ts'teki "saf
 * çekirdek, ince I/O sarmalayıcı" desenini izler: mantık burada test edilir,
 * script yalnızca sorgu/batch-commit yapar.
 */

export type GunlukBildirimTipi = 'asil' | 'yedek' | 'gorev_cagrisi' | string;

export interface GunlukKrediGirdisi {
  tip: GunlukBildirimTipi;
  durum: string;
  uid: string;
  cumaMi?: boolean;
}

export interface GunlukKrediSonucu {
  /** Asil (ve asil'le eşdeğer ağırlıklı acil çağrı) kredisi. */
  asilKredi: Record<string, number>;
  /** Cuma vakitlerinde asil olunan gün sayısı — aylikVakitSayisi'ndan ayrı
   *  tutulur (bkz. tieBreaker.ts, algoritma denetimi). */
  cumaKredi: Record<string, number>;
  /** Yedek görevi asil'in yarısı ağırlığında kalıcı sayaca işlenir (bkz. K6). */
  yedekKredi: Record<string, number>;
  /** Kendi onayını vermeden gün sonuna kalan acil çağrı sahipleri — admin uyarısı için. */
  uyariUids: string[];
  /** `bildirimler` girdi listesindeki, 'bekliyor' kaldığı için
   *  durum:'okundu_varsayilan' olarak işaretlenmesi gereken kayıtların indeksleri. */
  okunduVarsayilanIndeksleri: number[];
}

/**
 * `bekliyor` → varsayılan olarak görevi yapmış sayılır (kredi + gerekiyorsa
 * okundu_varsayilan işareti). `onaylandi` → kendi onayını vermiş, kredi
 * verilir ama işaret zaten `okudumOnayla`'da set edilmiştir. `reddedildi`
 * (mazeret bildirilmiş) → kredi yok.
 *
 * `gorev_cagrisi` (acil çağrı — hem asil hem yedek mazeret bildirdiğinde
 * devreye giren üçüncü kişi), asil'le birebir aynı işi fiilen yaptığından
 * asilKredi ile aynı ağırlıkta kredilendirilir — önceden HİÇBİR durum dalında
 * kredi verilmiyordu, bu yüzden tekrar acil çağrılan biri adalet
 * algoritmasında sistematik olarak "az yüklü" görünüyordu (bkz. mantık
 * denetimi, aynı sınıf adaletsizlik tieBreaker.ts K6'da zaten ele alınmıştı).
 */
export function gunlukKredileriHesapla(bildirimler: GunlukKrediGirdisi[]): GunlukKrediSonucu {
  const asilKredi: Record<string, number> = {};
  const cumaKredi: Record<string, number> = {};
  const yedekKredi: Record<string, number> = {};
  const uyariUids: string[] = [];
  const okunduVarsayilanIndeksleri: number[] = [];

  bildirimler.forEach((data, index) => {
    if (data.tip === 'asil') {
      if (data.durum === 'bekliyor') {
        okunduVarsayilanIndeksleri.push(index);
        asilKredi[data.uid] = (asilKredi[data.uid] || 0) + 1;
        if (data.cumaMi === true) cumaKredi[data.uid] = (cumaKredi[data.uid] || 0) + 1;
      } else if (data.durum === 'onaylandi') {
        asilKredi[data.uid] = (asilKredi[data.uid] || 0) + 1;
        if (data.cumaMi === true) cumaKredi[data.uid] = (cumaKredi[data.uid] || 0) + 1;
      }
    } else if (data.tip === 'gorev_cagrisi') {
      if (data.durum === 'bekliyor') {
        okunduVarsayilanIndeksleri.push(index);
        asilKredi[data.uid] = (asilKredi[data.uid] || 0) + 1;
        if (data.cumaMi === true) cumaKredi[data.uid] = (cumaKredi[data.uid] || 0) + 1;
        uyariUids.push(data.uid);
      } else if (data.durum === 'onaylandi') {
        asilKredi[data.uid] = (asilKredi[data.uid] || 0) + 1;
        if (data.cumaMi === true) cumaKredi[data.uid] = (cumaKredi[data.uid] || 0) + 1;
      }
      // durum === 'reddedildi': gorev_cagrisi zaten mazeret akışının ürettiği
      // bir devir değil (kriziBaslat/vekalet ile terfi ettirilir), bu dala
      // pratikte düşmez.
    } else if (data.tip === 'yedek') {
      if (data.durum === 'bekliyor') {
        okunduVarsayilanIndeksleri.push(index);
        yedekKredi[data.uid] = (yedekKredi[data.uid] || 0) + 1;
      } else if (data.durum === 'onaylandi') {
        yedekKredi[data.uid] = (yedekKredi[data.uid] || 0) + 1;
      }
    }
  });

  return { asilKredi, cumaKredi, yedekKredi, uyariUids, okunduVarsayilanIndeksleri };
}
