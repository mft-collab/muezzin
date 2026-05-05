import { doc, getDoc, runTransaction, increment } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { getTurkeyNow, parseVakitToDate } from '../lib/dateUtils';

export async function okudumOnayla(bildirimId: string): Promise<void> {
  const bildirimRef = doc(db, 'bildirimler', bildirimId);
  
  await runTransaction(db, async (transaction) => {
    const bildirimDoc = await transaction.get(bildirimRef);
    if (!bildirimDoc.exists()) throw new Error('Bildirim bulunamadı');
    
    const bildirim = bildirimDoc.data();
    if (bildirim.uid !== auth.currentUser?.uid) throw new Error('Yetkisiz işlem');

    // Ezan saati kontrolü (Buffer kaldırıldı)
    const vakitDoc = await transaction.get(doc(db, 'vakitler', bildirim.tarih.slice(0, 7)));
    const vakitSaati = vakitDoc.data()?.gunler[bildirim.tarih][bildirim.vakit];
    
    if (!vakitSaati) throw new Error('Vakit bilgisi bulunamadı');

    const ezanSaati = parseVakitToDate(bildirim.tarih, vakitSaati);
    const simdi = getTurkeyNow();

    if (simdi.getTime() < ezanSaati.getTime()) {
      throw new Error('Henüz ezan vakti gelmedi');
    }

    transaction.update(bildirimRef, { durum: 'onaylandi', pendingAck: false, sonGuncelleme: getTurkeyNow() });
    // Puan artış
    transaction.update(doc(db, 'muezzins', auth.currentUser!.uid), {
      aylikVakitSayisi: increment(1)
    });
  });
}

export async function adminOkudumOnayla(bildirimId: string): Promise<void> {
  const bildirimRef = doc(db, 'bildirimler', bildirimId);
  
  await runTransaction(db, async (transaction) => {
    const bildirimDoc = await transaction.get(bildirimRef);
    const bildirim = bildirimDoc.data()!;

    transaction.update(bildirimRef, { durum: 'onaylandi', pendingAck: false });
    transaction.update(doc(db, 'muezzins', bildirim.uid), {
      aylikVakitSayisi: increment(1)
    });
  });
}
