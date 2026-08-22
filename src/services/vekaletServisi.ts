import { deleteDoc, doc, getDoc, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { mazeretZamanKontrolYap } from './mazeretServisi';
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

  // Cuma günleri ve mazeretin 1 saatlik son başvuru penceresi, görev devri
  // (vekalet) için de geçerlidir — aksi halde mazeret kısıtlaması bu yoldan
  // atlatılabilir (bkz. mimari denetim K3/K4). Bildirim belgesindeki
  // (eski belgelerde eksik olabilen) `cumaMi` alanına GÜVENMEZ, `tarih`'ten
  // taze türetir — bkz. src/services/mazeretServisi.ts `mazeretZamanKontrolYap`.
  // Asıl uygulama sunucu tarafındadır (firestore.rules `isValidVekaletCreate`);
  // bu yalnızca gereksiz bir yazım denemesini önleyen erken geri bildirimdir.
  const mazeretDurumu = await mazeretZamanKontrolYap(tarih, vakit, saat);
  if (mazeretDurumu.kapali) {
    throw new Error(mazeretDurumu.sebep ?? 'Bu görev için görev devri (vekalet) kullanılamaz.');
  }

  const talepId = buildVekaletTalebiId(haftaId, tarih, vakit, tip, aliciUid);
  const talepRef = doc(db, 'vekalet_talepleri', talepId);

  // Talep ID'si deterministik (haftaId_tarih_vakit_tip_aliciUid) — aynı
  // alıcıya aynı görev için ikinci kez teklif göndermek normalde bir
  // `update` sayılır ve hiçbir kuralla eşleşmediği için reddedilir. Daha
  // önce reddedilmiş bir talep varsa önce sil (aşağıdaki create bu yüzden
  // gerçek bir create olur) — aksi halde bir kez reddedilen teklif o
  // gün/vakit için kalıcı olarak kilitleniyordu (bkz. mimari denetim O7).
  const oncekiTalepSnap = await getDoc(talepRef);
  if (oncekiTalepSnap.exists() && oncekiTalepSnap.data().durum === 'reddedildi') {
    await deleteDoc(talepRef);
  }

  await setDoc(talepRef, {
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

  // Mazeret zaman penceresi kontrolü Firestore'dan ezan verisi çekmek zorunda
  // olduğundan transaction dışında yapılır (mazeretBildir ile aynı desen).
  // Teklif gönderildikten SONRA ezan vakti geçmiş olabileceğinden bu kontrol
  // kabul anında AYRICA yapılmalı — yalnızca teklif anında bakmak yetmez
  // (bkz. mimari denetim K4). Aşağıdaki transaction'daki 'beklemede' ve
  // bildirim 'bekliyor' kontrolleri otoriter kalır; bu yalnızca erken bir
  // reddir, kabulü tetikleyen esas doğrulama değildir.
  const onKontrolSnap = await getDoc(talepRef);
  if (!onKontrolSnap.exists()) throw new Error('Vekalet talebi bulunamadı.');
  const onKontrolTalep = onKontrolSnap.data() as VekaletTalebi;
  const mazeretDurumu = await mazeretZamanKontrolYap(onKontrolTalep.tarih, onKontrolTalep.vakit, onKontrolTalep.saat);
  if (mazeretDurumu.kapali) {
    throw new Error(mazeretDurumu.sebep ?? 'Bu görev için vekalet kabul penceresi kapandı.');
  }

  // NOT ("1000 ifade tavanı" kök neden çözümü): bu transaction eskiden
  // bildirimler.uid'i BURADA, anlık olarak flip ediyordu — bu,
  // firestore.rules'taki `isAcceptedVekaletBildirimTransfer`'in emülatörün
  // "1000 ifade" bütçesine çarpan ~45 terimlik çapraz-belge doğrulamasını
  // (talep korelasyonu + atanabilirlik + Cuma + izin-günü, hepsi CEL'de)
  // gerektiriyordu. Artık istemci yalnızca (1) talebi kabul edildi olarak
  // işaretliyor ve (2) bildirime dar bir "niyet" bayrağı
  // (vekaletDevriBekliyor) yazıyor — GERÇEK transfer (uid flip'i + tüm iş
  // kurallarının taze veriyle yeniden doğrulanması, audit-log dahil) artık
  // scripts/vekaletDevirleriniIsle.ts'te, Admin SDK ile (kural bütçesi yok)
  // gerçekleşiyor; script'in bir sonraki çalışmasına kadar (~10-15 dk)
  // gecikmeli.
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
    transaction.update(bildirimRef, { vekaletDevriBekliyor: true, sonGuncelleme: serverTimestamp() });
  });
}

export async function vekaletReddet(talepId: string): Promise<void> {
  const talepRef = doc(db, 'vekalet_talepleri', talepId);
  await updateDoc(talepRef, { durum: 'reddedildi', sonGuncelleme: serverTimestamp() });
}
