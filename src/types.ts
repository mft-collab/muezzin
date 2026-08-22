import { Timestamp } from 'firebase/firestore';

export type Vakit = "sabah" | "ogle" | "ikindi" | "aksam" | "yatsi";
export type VakitAtama = { asil: string; yedek: string };

export interface Muezzin {
 displayName: string;
 email?: string;
 photoURL: string;
 role: "muezzin" | "admin" | "gozlemci";
 aktif: boolean;
 fcmToken: string | null;
 /** Çok cihazlı FCM token haritası: { [token]: kayitTarihi } */
 fcmTokens?: { [token: string]: import('firebase/firestore').Timestamp };
 notificationSettings?: {
 nobetHatirlatici?: boolean;
 duyurular?: boolean;
 mazeretDurumu?: boolean;
 };
 aylikVakitSayisi: number;
 /** Bu ay kaç kez Cuma vaktinde asil görevli oldu — Cuma adaletinin aylık
  * toplam tarafından bastırılmasını önlemek için ayrı tutulur (bkz.
  * src/utils/tieBreaker.ts, scripts/yatsiSonuIslemleri.ts). */
 aylikCumaSayisi?: number;
 /** Bu ay kaç kez yedek görevi tamamladı — kalıcı bir sayaca işlenmezse
  * sürekli yedek kalan biri her hafta yeniden "en az yüklü" ölçülüp tekrar
  * yedeğe atanabiliyordu (bkz. src/utils/tieBreaker.ts, mimari denetim K6). */
 aylikYedekSayisi?: number;
 /** Bu takvim yılında ONAYLANMIŞ yıllık izin olarak kullanılan gün sayısı
  * (yıllık 30 gün kotasının kalıcı sayacı) — her 1 Ocak'ta
  * scripts/yatsiSonuIslemleri.ts tarafından sıfırlanır (bkz.
  * src/lib/dateUtils.ts izinGunSayisi, firestore.rules isValidMuezzin). */
 yillikIzinKullanilanGun?: number;
 haftalikIzinGunu?: number;
 kayitTarihi?: string;
 /** Davet kabul edip hesap oluşturdu ama admin onayı bekliyor */
 onayBekliyor?: boolean;
 /** Personel arşivlendi mi (soft-delete) — bkz. src/pages/admin/modules/MuezzinYonetimi.tsx */
 arsivlendi?: boolean;
 arsivTarihi?: Timestamp | null;
}

export interface Invite {
 id?: string;
 email: string;
 displayName: string;
 role: "muezzin" | "admin" | "gozlemci";
 haftalikIzinGunu?: number;
 olusturmaTarihi: Timestamp;
}

export interface VakitKaydi {
 sabah: string;
 gunes: string;
 ogle: string;
 ikindi: string;
 aksam: string;
 yatsi: string;
}

export interface Vakitler {
 ilceId: string;
 gunler: { [key: string]: VakitKaydi };
 kaynakApi: "diyanet" | "aladhan";
 guncellenmeTarihi: Timestamp;
}

export interface HaftaPlanGun {
 sabah: VakitAtama;
 ogle: VakitAtama;
 ikindi: VakitAtama;
 aksam: VakitAtama;
 yatsi: VakitAtama;
}

export interface HaftaPlan {
 id?: string;
 haftaBaslangic: string;
 haftaBitis: string;
 durum: "yayinda" | "arsiv";
 olusturmaTarihi: Timestamp;
 gunler: { [key: string]: HaftaPlanGun };
}

export interface Bildirim {
 id?: string;
 haftaId: string;
 tarih: string;
 vakit: Vakit;
 uid: string;
 tip: "asil" | "yedek" | "gorev_cagrisi";
 durum: "bekliyor" | "onaylandi" | "reddedildi" | "sistem_atadi" | "iptal" | "okundu_varsayilan";
 pendingAck: boolean;
 retSebebi: string | null;
 olusturmaTarihi: Timestamp;
 sonGuncelleme: Timestamp;
 /** Bir mazeret bildiriminin sonucu (bkz. src/services/mazeretServisi.ts) */
 devirSonucu?: 'yedek_atandi' | 'alarm_bekliyor' | 'alarm_uretildi';
 /** Terfi eden bir yedek bildirimi üzerinde: mazereti bildiren asil görevlinin uid'si */
 asilMazeretUid?: string;
 /** admin-SDK uzlaştırma işi (scripts/mazeretDevirleriniIsle.ts) haftaPlanlari'nı bir MAZERET olayı için senkronize etti mi */
 mazeretPlanSenkronEdildi?: boolean;
 /** admin-SDK uzlaştırma işi (scripts/vekaletDevirleriniIsle.ts) haftaPlanlari'nı bir VEKALET olayı için senkronize etti mi.
  * Bu iki alan kasıtlı olarak AYRI — bkz. mimari denetim Y2. */
 vekaletPlanSenkronEdildi?: boolean;
 /**
  * Görevin tarihi bir Cuma'ya denk geliyor mu — oluşturulma anında hesaplanır.
  * Cuma günleri mazeret/görev devri kullanılamaz kuralının sunucu tarafı
  * uygulaması bu alana bakar (bkz. firestore.rules `isSelfBildirimUpdate`,
  * src/lib/mazeretKurallari.ts). Kasıtlı olarak opsiyonel — bu alan
  * eklenmeden önce oluşturulmuş eski belgelerde bulunmayabilir.
  */
 cumaMi?: boolean;
 /**
  * Bu görev bir vekalet (görev devri) kabulüyle mi el değiştirdi —
  * vekaletServisi.ts `vekaletKabulEt` tarafından yazılır. `durum` bu
  * geçişte değişmediğinden (hâlâ 'bekliyor' olabilir), planServisi.ts
  * bu alan olmadan slotu korumasız sanıp bir sonraki plan yeniden
  * üretiminde eski sahibine geri döndürebiliyordu (bkz. mimari denetim K5).
  */
 vekaletDevredildi?: boolean;
 /**
  * İstemcinin vekaletKabulEt sırasında yazdığı DAR bir "niyet" bayrağı —
  * gerçek sahiplik transferi (uid flip'i + vekaletDevredildi:true) artık
  * scripts/vekaletDevirleriniIsle.ts'te (Admin SDK) gerçekleşiyor, kısa bir
  * gecikmeyle (bkz. firestore.rules `isVekaletDevriBekliyorIsareti`, "1000
  * ifade tavanı" kök neden çözümü). `durum` bu geçişte değişmediğinden,
  * planServisi.ts bu alan olmadan da slotu korumasız sanıp script daha
  * çalışmadan (manuel atama veya haftalık plan yeniden üretimiyle) sessizce
  * ezebiliyordu — vekaletDevredildi'nin bu geçişteki AYNI rolü.
  */
 vekaletDevriBekliyor?: boolean;
}

export interface VekaletTalebi {
 id?: string;
 bildirimId: string;
 haftaId: string;
 gonderenUid: string;
 gonderenIsim: string;
 aliciUid: string;
 aliciIsim: string;
 tarih: string;
 vakit: Vakit;
 saat: string;
 tip: "asil" | "yedek" | "gorev_cagrisi";
 durum: "beklemede" | "kabul_edildi" | "reddedildi";
 olusturmaTarihi: Timestamp;
 sonGuncelleme?: Timestamp;
 /**
  * scripts/vekaletDevirleriniIsle.ts'in idempotency bayrağı — bu talep
  * kabul edildikten sonra ilgili bildirimler.uid transferi GERÇEKTEN
  * uygulandı mı. Yalnızca Admin SDK yazar (client bu alanı hiç görmez/
  * yazamaz — firestore.rules'taki isRecipientVekaletStatusUpdate ve
  * isVekaletDevriBekliyorIsaretiIcin bu alana dokunmaz).
  */
 bildirimUygulandi?: boolean;
 /**
  * `bildirimUygulandi` yalnızca "script bu talebi işledi mi" bilgisini taşır,
  * SONUCUNU değil — bu alan ikisini ayırt eder (bkz. mimari denetim,
  * scripts/vekaletDevirleriniIsle.ts yorumu). Yalnızca Admin SDK yazar.
  */
 talepSonuc?: 'uygulandi' | 'reddedildi';
}

export interface AdminUyarisi {
 tip: "zincirTukendi" | "apiHatasi" | "planOlusturulamadi";
 mesaj: string;
 tarih: string;
 vakit: string | null;
 cozuldu: boolean;
 olusturmaTarihi: Timestamp;
}

export interface GunlukVakit {
 tarih: string;
 sabah: string;
 gunes: string;
 ogle: string;
 ikindi: string;
 aksam: string;
 yatsi: string;
 imsak?: string;
}

export type AylikVakitler = Vakitler;

export interface Izin {
 id?: string;
 uid: string;
 baslangic: string; // ISO date (YYYY-MM-DD)
 bitis: string; // ISO date (YYYY-MM-DD)
 tip: "haftalik" | "yillik" | "mazeret";
 sebep: string;
 durum: "onay_bekliyor" | "onaylandi" | "reddedildi";
 olusturmaTarihi: Timestamp;
 /** Admin reddederken gerekçe girebilir (bkz. firestore.rules izinler update) */
 redSebebi?: string;
}

export interface SystemSettings {
 ilceId: string;
 ilceAdi: string;
 hicriDuzeltme?: number;
}

export interface SonrakiVakit {
 vakit: Vakit;
 ezanSaati: Date;
 baslangicZamani: Date;
 okudumAcilisZamani: Date;
 t1KilitZamani: Date;
}
