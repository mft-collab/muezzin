import {
  collection,
  deleteField,
  doc,
  deleteDoc,
  FirestoreError,
  onSnapshot,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Invite, Muezzin } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { telemetryService } from './telemetryService';
import { haftalikPlanOlustur } from './planServisi';
import { getHaftaIdFromDate, getTurkeyDateString } from '../lib/dateUtils';

type MuezzinDoc = Muezzin & { id: string };
type InviteDoc = Invite & { id: string };

/** Bir personelin sistemdeki son aktif yönetici olup olmadığını belirler — son yönetici pasife/arşive alınamaz. */
export function isLastActiveAdmin(m: MuezzinDoc, muezzinler: MuezzinDoc[]): boolean {
  const activeAdmins = muezzinler.filter(user => user.role === 'admin' && user.aktif === true && user.arsivlendi !== true);
  return m.role === 'admin' && m.aktif === true && activeAdmins.length <= 1;
}

/** Bekleyen davetleri canlı dinler (yalnızca admin panelinde kullanılır). */
export function invitesAbone(
  onData: (invites: InviteDoc[]) => void,
  onError: (error: FirestoreError) => void
): () => void {
  return onSnapshot(
    collection(db, 'invites'),
    (snap) => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }) as InviteDoc)),
    onError
  );
}

/** Gece cron'unun (scripts/haftalikPlanOlustur.ts) ürettiği kadar ileri hafta
 * sayısı — bkz. mimari denetim O4: kadro değişikliği yalnızca bu haftayı
 * yeniliyordu, +1/+2 haftalarındaki planlarda pasife alınan personel
 * atanmış kalmaya devam ediyordu, hiçbir uyarı da üretilmiyordu. */
const GUVENLI_YENILEME_HAFTA_SAYISI = 3;

/** Mevcut VE gece cron'unun ürettiği kadar ileri haftaların (bu hafta +
 * sonraki 2 hafta) her biri için güvenli bir yeniden hesaplama dener —
 * `role==='muezzin'` guard'ı YOK, çağıran taraf bu kararı verir (bkz.
 * `haftaPlaniniGuvenliYenile` ve mimari denetim O1). Başarısızlık sessizce
 * raporlanır — asıl işlemi engellemez; bir haftanın başarısız olması
 * diğerlerinin denenmesini engellemez. */
async function haftalikPlanlariYenile(): Promise<boolean> {
  const bugun = getTurkeyDateString();
  let hepsiBasarili = true;
  for (let haftaOffset = 0; haftaOffset < GUVENLI_YENILEME_HAFTA_SAYISI; haftaOffset++) {
    try {
      const [y, mo, d] = bugun.split('-').map(Number);
      const hedefTarih = new Date(y, mo - 1, d + haftaOffset * 7);
      const hedefTarihStr = getTurkeyDateString(hedefTarih);
      const haftaId = getHaftaIdFromDate(hedefTarihStr);
      await haftalikPlanOlustur(haftaId);
    } catch (err) {
      console.warn(`Kadro değişikliği sonrası plan yenilenemedi (hafta +${haftaOffset}):`, err);
      hepsiBasarili = false;
    }
  }
  return hepsiBasarili;
}

/** Kadro değişikliğinin (aktiflik/onay/arşiv geçişleri) plan yenilemesi
 * gerektirip gerektirmediğine `role==='muezzin'` bakarak karar verir —
 * `personelAktiflikDegistir`/`personelOnayla`/`personelGeriYukle`/
 * `personelArsivle` bu geçişlerin hepsinde kişinin rolü zaten 'muezzin'
 * olarak sabit kalır, yalnızca `aktif`/`onayBekliyor`/`arsivlendi` değişir. */
async function haftaPlaniniGuvenliYenile(m: MuezzinDoc): Promise<boolean> {
  if (m.role !== 'muezzin') return true;
  return haftalikPlanlariYenile();
}

export async function personelAktiflikDegistir(m: MuezzinDoc, muezzinler: MuezzinDoc[]): Promise<{ planRefreshed: boolean }> {
  if (isLastActiveAdmin(m, muezzinler)) {
    throw new Error('Son aktif yönetici pasife alınamaz.');
  }
  const path = `muezzins/${m.id}`;
  try {
    await updateDoc(doc(db, 'muezzins', m.id), { aktif: !m.aktif, onayBekliyor: false });
    const planRefreshed = await haftaPlaniniGuvenliYenile(m);
    await telemetryService.logAudit('Kadro Durumu Değiştirme', m.displayName, `Personel aktiflik durumu ${!m.aktif ? 'AKTİF' : 'PASİF'} yapıldı.`);
    return { planRefreshed };
  } catch (err) {
    throw handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function personelOnayla(m: MuezzinDoc): Promise<{ planRefreshed: boolean }> {
  const path = `muezzins/${m.id}`;
  try {
    await updateDoc(doc(db, 'muezzins', m.id), { aktif: true, onayBekliyor: false });
    if (m.email) {
      await deleteDoc(doc(db, 'invites', m.email.toLowerCase()));
    }
    const planRefreshed = await haftaPlaniniGuvenliYenile(m);
    await telemetryService.logAudit('Personel Onaylama', m.displayName, 'Dizgeye katılım talebi onaylandı ve aktif kadroya dahil edildi.');
    return { planRefreshed };
  } catch (err) {
    throw handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function personelGeriYukle(m: MuezzinDoc): Promise<{ planRefreshed: boolean }> {
  const path = `muezzins/${m.id}`;
  try {
    await updateDoc(doc(db, 'muezzins', m.id), {
      aktif: true,
      onayBekliyor: false,
      arsivlendi: false,
      arsivTarihi: null,
    });
    const planRefreshed = await haftaPlaniniGuvenliYenile(m);
    await telemetryService.logAudit('Personel Geri Yükleme', m.displayName, 'Arşivlenmiş personel aktif kadroya geri yüklendi.');
    return { planRefreshed };
  } catch (err) {
    throw handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function personelArsivle(m: MuezzinDoc, muezzinler: MuezzinDoc[]): Promise<{ planRefreshed: boolean }> {
  if (isLastActiveAdmin(m, muezzinler)) {
    throw new Error('Son aktif yönetici arşive alınamaz.');
  }
  const path = `muezzins/${m.id}`;
  try {
    await updateDoc(doc(db, 'muezzins', m.id), {
      aktif: false,
      onayBekliyor: false,
      arsivlendi: true,
      arsivTarihi: Timestamp.now(),
    });
    const planRefreshed = await haftaPlaniniGuvenliYenile(m);
    await telemetryService.logAudit('Personel Arşivleme', m.displayName, 'Personel aktif kadrodan çıkarılarak arşiv kategorisine alındı.');
    return { planRefreshed };
  } catch (err) {
    throw handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function davetSil(inviteEmail: string): Promise<void> {
  const path = `invites/${inviteEmail}`;
  try {
    await deleteDoc(doc(db, 'invites', inviteEmail));
    await telemetryService.logAudit('Davetiye İptal', inviteEmail, 'Gönderilmiş dizge katılım davetiyesi iptal edildi ve silindi.');
  } catch (err) {
    throw handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export interface PersonelKaydetParams {
  editingUser: MuezzinDoc | null;
  muezzinler: MuezzinDoc[];
  fullName: string;
  role: 'muezzin' | 'admin' | 'gozlemci';
  haftalikIzinGunu: number;
  email: string;
}

/** Yeni personel daveti oluşturur veya mevcut bir personelin profilini günceller; rol/izin günü değişimi hafta planını güvenli şekilde yeniden dengeler.
 * `planRefreshed: false` dönmesi, kaydın kendisinin BAŞARISIZ olduğu anlamına gelmez — yalnızca artçı plan
 * yenilemesinin başarısız olduğunu (bkz. `haftalikPlanlariYenile`'in sessiz-raporlama deseni) belirtir; çağıran
 * taraf `personelAktiflikDegistir`/`personelOnayla`/`personelGeriYukle`/`personelArsivle` ile AYNI şekilde
 * `warnIfPlanNotRefreshed`-benzeri bir uyarı göstermeli (bkz. mimari denetim — bu alan bugüne kadar hiç
 * çağırana geri bildirilmiyordu, yalnızca console.warn'a düşüyordu). */
export async function personelKaydet(params: PersonelKaydetParams): Promise<{ planRefreshed: boolean }> {
  const { editingUser, muezzinler, fullName, role, haftalikIzinGunu } = params;

  if (editingUser) {
    const activeAdmins = muezzinler.filter(user => user.role === 'admin' && user.aktif === true && user.arsivlendi !== true);
    const isLastActiveAdminRoleChange = editingUser.role === 'admin' && editingUser.aktif === true && role !== 'admin' && activeAdmins.length <= 1;
    if (isLastActiveAdminRoleChange) {
      throw new Error('Son aktif yöneticinin yetki seviyesi değiştirilemez.');
    }

    const path = `muezzins/${editingUser.id}`;
    try {
      const impactsDutyPlan = editingUser.role === 'muezzin' || role === 'muezzin' || editingUser.haftalikIzinGunu !== haftalikIzinGunu;
      await updateDoc(doc(db, 'muezzins', editingUser.id), {
        displayName: fullName,
        role,
        haftalikIzinGunu: haftalikIzinGunu > 0 ? haftalikIzinGunu : deleteField(),
      });
      let planRefreshed = true;
      if (impactsDutyPlan) {
        // haftalikPlanlariYenile (guard'sız) kullanılır — haftaPlaniniGuvenliYenile
        // DEĞİL: o, geçirilen nesnenin YENİ rolüne bakıp 'muezzin' değilse
        // hiç yenilemiyordu, oysa rol muezzin'den BAŞKA bir şeye değiştiğinde
        // de (kişi rotasyondan çıkıyor) +1/+2 haftaların yenilenmesi gerekir
        // (bkz. mimari denetim O1).
        planRefreshed = await haftalikPlanlariYenile();
      }
      await telemetryService.logAudit('Profil Güncelleme', fullName, `Kullanıcı rolü: ${role.toUpperCase()}, İzin günü: ${haftalikIzinGunu > 0 ? haftalikIzinGunu : 'Yok'}`);
      return { planRefreshed };
    } catch (err) {
      throw handleFirestoreError(err, OperationType.UPDATE, path);
    }
  } else {
    const mail = params.email.trim().toLowerCase();
    if (!mail || !mail.includes('@')) {
      throw new Error('Geçerli bir e-posta adresi giriniz.');
    }

    const path = `invites/${mail}`;
    try {
      const inviteData: Record<string, unknown> = {
        email: mail,
        displayName: fullName,
        role,
        olusturmaTarihi: Timestamp.now(),
      };
      if (haftalikIzinGunu > 0) {
        inviteData.haftalikIzinGunu = haftalikIzinGunu;
      }
      await setDoc(doc(db, 'invites', mail), inviteData);
      await telemetryService.logAudit('Personel Daveti', mail, `Kullanıcı adı: ${fullName}, Davet edilen rol: ${role.toUpperCase()}`);
      return { planRefreshed: true };
    } catch (err) {
      throw handleFirestoreError(err, OperationType.CREATE, path);
    }
  }
}
