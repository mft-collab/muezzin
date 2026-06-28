import { doc, collection, addDoc, updateDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { telemetryService } from './telemetryService';

export async function vekaletTeklifEt(
  bildirimId: string,
  tarih: string,
  vakit: string,
  saat: string,
  tip: 'asil' | 'yedek' | 'gorev_cagrisi',
  aliciUid: string,
  aliciIsim: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Oturum açmış bir kullanıcı bulunamadı.');

  await addDoc(collection(db, 'vekalet_talepleri'), {
    bildirimId,
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

  // Audit log için transaction dışında tutulacak veriler (transaction içinde Firestore-dışı async çağrı yapılamaz)
  let auditDetails: { gonderenIsim: string; aliciIsim: string; tarih: string; vakit: string } | null = null;

  await runTransaction(db, async (transaction) => {
    // 1. Vekalet Talebini Oku
    const talepDoc = await transaction.get(talepRef);
    if (!talepDoc.exists()) throw new Error('Vekalet talebi bulunamadı.');

    const talep = talepDoc.data();
    if (talep.durum !== 'beklemede') throw new Error('Bu talep zaten sonuçlandırılmış.');

    // 2. Orijinal Bildirimi Oku
    const bildirimRef = doc(db, 'bildirimler', talep.bildirimId);
    const bildirimDoc = await transaction.get(bildirimRef);
    if (!bildirimDoc.exists()) throw new Error('Orijinal görev bildirimi bulunamadı.');

    const bildirim = bildirimDoc.data();
    if (bildirim.durum !== 'bekliyor') throw new Error('Bu görev zaten ifa edilmiş veya mazeret bildirilmiş.');

    // 3. Hafta Planını Oku
    const planRef = doc(db, 'haftaPlanlari', bildirim.haftaId);
    const planDoc = await transaction.get(planRef);
    if (!planDoc.exists()) throw new Error('Haftalık plan kaydı bulunamadı.');

    const plan = planDoc.data();
    const gunler = { ...plan.gunler };

    // Gün ve vakit hücresinde güncelleme yap
    if (gunler[talep.tarih] && gunler[talep.tarih][talep.vakit]) {
      const cell = { ...gunler[talep.tarih][talep.vakit] };
      if (talep.tip === 'asil') {
        cell.asil = talep.aliciUid;
      } else if (talep.tip === 'yedek') {
        cell.yedek = talep.aliciUid;
      }
      gunler[talep.tarih][talep.vakit] = cell;
    }

    // 4. Güncellemeleri Atomic Olarak Uygula
    transaction.update(talepRef, { durum: 'kabul_edildi', sonGuncelleme: serverTimestamp() });
    transaction.update(bildirimRef, { uid: talep.aliciUid, sonGuncelleme: serverTimestamp() });
    transaction.update(planRef, { gunler });

    // Audit verisini dışarı aktar — transaction commit sonrası kullanılacak
    auditDetails = {
      gonderenIsim: talep.gonderenIsim,
      aliciIsim: talep.aliciIsim,
      tarih: talep.tarih,
      vakit: talep.vakit,
    };
  });

  // Denetim izi — Firestore transaction COMMIT'inden SONRA çağrılmalı
  if (auditDetails) {
    const { gonderenIsim, aliciIsim, tarih, vakit } = auditDetails;
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
