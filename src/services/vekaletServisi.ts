import { doc, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { telemetryService } from './telemetryService';
import { Bildirim, Vakit, VekaletTalebi } from '../types';

function buildVekaletTalebiId(
  haftaId: string,
  tarih: string,
  vakit: Vakit,
  tip: 'asil' | 'yedek' | 'gorev_cagrisi',
  aliciUid: string
) {
  return `${haftaId}_${tarih}_${vakit}_${tip}_${aliciUid}`;
}

export async function vekaletTeklifEt(
  bildirimId: string,
  haftaId: string,
  tarih: string,
  vakit: Vakit,
  saat: string,
  tip: 'asil' | 'yedek' | 'gorev_cagrisi',
  aliciUid: string,
  aliciIsim: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Oturum açmış bir kullanıcı bulunamadı.');

  const talepId = buildVekaletTalebiId(haftaId, tarih, vakit, tip, aliciUid);

  await setDoc(doc(db, 'vekalet_talepleri', talepId), {
    bildirimId,
    haftaId,
    gonderenUid: currentUser.uid,
    gonderenIsim: currentUser.displayName || currentUser.email || 'Değerli Hocam',
    aliciUid,
    aliciIsim,
    tarih,
    vakit,
    saat,
    tip,
    durum: 'beklemede',
    olusturmaTarihi: serverTimestamp()
  });
}

export async function vekaletKabulEt(talepId: string): Promise<void> {
  const talepRef = doc(db, 'vekalet_talepleri', talepId);

  let auditDetails: { gonderenIsim: string; aliciIsim: string; tarih: string; vakit: string } | null = null;

  await runTransaction(db, async (transaction) => {
    const talepDoc = await transaction.get(talepRef);
    if (!talepDoc.exists()) throw new Error('Vekalet talebi bulunamadı.');

    const talep = talepDoc.data() as VekaletTalebi;
    if (talep.durum !== 'beklemede') throw new Error('Bu talep zaten sonuçlandırılmış.');
    if (talep.aliciUid !== auth.currentUser?.uid) throw new Error('Bu vekalet teklifi size ait değil.');

    const bildirimRef = doc(db, 'bildirimler', talep.bildirimId);
    const bildirimDoc = await transaction.get(bildirimRef);
    if (!bildirimDoc.exists()) throw new Error('Orijinal görev bildirimi bulunamadı.');

    const bildirim = bildirimDoc.data() as Bildirim;
    if (bildirim.durum !== 'bekliyor') throw new Error('Bu görev zaten sonuçlandırılmış.');

    transaction.update(talepRef, { durum: 'kabul_edildi', sonGuncelleme: serverTimestamp() });
    transaction.update(bildirimRef, { uid: talep.aliciUid, sonGuncelleme: serverTimestamp() });

    auditDetails = {
      gonderenIsim: talep.gonderenIsim,
      aliciIsim: talep.aliciIsim,
      tarih: talep.tarih,
      vakit: talep.vakit,
    };
  });

  // NOT: `as` ile açık tip ataması kasıtlı — auditDetails, kapsayan bir async
  // closure içinde yeniden atanan bir `let` olduğundan TypeScript'in kontrol
  // akışı analizi burada `vakit` alanını yanlışlıkla `never`'a daraltıyor
  // (bilinen bir TS closure-narrowing sınırlaması). Açık cast bu zinciri kırar.
  const finalAuditDetails = auditDetails as { gonderenIsim: string; aliciIsim: string; tarih: string; vakit: string } | null;
  if (finalAuditDetails) {
    const { gonderenIsim, aliciIsim, tarih, vakit } = finalAuditDetails;
    const details = `${gonderenIsim} görevi otonom vekalet ile ${aliciIsim} hocaya devretti.`;
    await telemetryService.logAudit(
      'Görev Vekaleti Devri',
      `${tarih} - ${vakit.toUpperCase()}`,
      details
    );
  }
}

export async function vekaletReddet(talepId: string): Promise<void> {
  const talepRef = doc(db, 'vekalet_talepleri', talepId);
  await updateDoc(talepRef, { durum: 'reddedildi', sonGuncelleme: serverTimestamp() });
}
