import { doc, runTransaction, increment, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { getTurkeyNow, parseVakitToDate } from '../lib/dateUtils';

export async function okudumOnayla(bildirimId: string): Promise<void> {
 // İstemci tarafı tepe yükü düzleştirme (Jittering: Spark planda ezan vakti eşzamanlı veritabanı yazma baskısını önler)
 const randomDelay = Math.floor(Math.random() * 1500);
 await new Promise(resolve => setTimeout(resolve, randomDelay));

 const bildirimRef = doc(db, 'bildirimler', bildirimId);
 
 await runTransaction(db, async (transaction) => {
 const bildirimDoc = await transaction.get(bildirimRef);
 if (!bildirimDoc.exists()) throw new Error('Bildirim bulunamadı');
 
 const bildirim = bildirimDoc.data();
 if (bildirim.uid !== auth.currentUser?.uid) throw new Error('Yetkisiz işlem');
 if (bildirim.durum !== 'bekliyor') throw new Error('Bu görev zaten sonuçlandırılmış.');

 // Get system settings to fetch district prefix (ilceId) dynamically
 const settingsDoc = await transaction.get(doc(db, 'settings', 'system'));
 const ilceId = settingsDoc.exists() ? (settingsDoc.data()?.ilceId || '9148') : '9148';

 // Ezan saati kontrolü (Dynamic prefix fixed)
 const buAyYYYYMM = bildirim.tarih.slice(0, 7);
 const buAyDocId = `${ilceId}_${buAyYYYYMM}`;
 const vakitDoc = await transaction.get(doc(db, 'vakitler', buAyDocId));
 const vakitSaati = vakitDoc.data()?.gunler[bildirim.tarih][bildirim.vakit];
 
 if (!vakitSaati) throw new Error('Vakit bilgisi bulunamadı');

 const ezanSaati = parseVakitToDate(bildirim.tarih, vakitSaati);
 if (!ezanSaati) throw new Error('Vakit bilgisi bulunamadı');
 const simdi = getTurkeyNow();

 if (simdi.getTime() < ezanSaati.getTime()) {
 throw new Error('Henüz ezan vakti gelmedi');
 }

 // Not: aylikVakitSayisi puanı burada artırılmıyor — bu alan Firestore
 // kurallarında müezzinin kendi profilini güncelleme iznine dahil değil
 // (bkz. firestore.rules `muezzins` self-update). Puan, gece yatsı sonrası
 // cron'unda (scripts/yatsiSonuIslemleri.ts) bu bildirimin `durum` alanına
 // bakılarak merkezi olarak veriliyor.
 transaction.update(bildirimRef, { durum: 'onaylandi', pendingAck: false, sonGuncelleme: serverTimestamp() });
 });
}

export async function adminOkudumOnayla(bildirimId: string): Promise<void> {
  const bildirimRef = doc(db, 'bildirimler', bildirimId);
  
  await runTransaction(db, async (transaction) => {
    const bildirimDoc = await transaction.get(bildirimRef);
    if (!bildirimDoc.exists()) {
      throw new Error('Bildirim bulunamadı');
    }
    
    const bildirim = bildirimDoc.data();
    if (bildirim.durum !== 'bekliyor') {
      throw new Error('Bu görev zaten sonuçlandırılmış.');
    }

    transaction.update(bildirimRef, { 
      durum: 'onaylandi', 
      pendingAck: false, 
      sonGuncelleme: serverTimestamp() 
    });
    
    transaction.update(doc(db, 'muezzins', bildirim.uid), {
      aylikVakitSayisi: increment(1)
    });
  });
}

