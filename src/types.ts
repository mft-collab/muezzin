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
 notificationSettings?: {
 nobetHatirlatici?: boolean;
 duyurular?: boolean;
 mazeretDurumu?: boolean;
 };
 aylikVakitSayisi: number;
 haftalikIzinGunu?: number;
 puan?: number;
 kayitTarihi?: string;
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
