import { collection, query, where, getDocs, doc, setDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Muezzin, Bildirim } from '../types';
import { tieBreakerSirala } from '../utils/tieBreaker';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export async function haftalikPlanOlustur(haftaId: string): Promise<void> {
  const path = 'haftaPlanlari';
  try {
    // 1. Personel Çekme (Adminler dahil edilebilir ama genellikle sadece müezzinler planlanır)
    const muezzinSnapshot = await getDocs(query(collection(db, 'muezzins'), where('aktif', '==', true)));
    const muezzinler = muezzinSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Muezzin & { id: string }))
      .filter(m => m.role !== 'gozlemci');

    if (muezzinler.length < 2) {
      throw new Error('Planlama için en az 2 aktif personel gereklidir (Gözlemciler hariç).');
    }

    // 2. Onaylanmış İzinleri Çek
    const izinSnapshot = await getDocs(query(collection(db, 'izinler'), where('durum', '==', 'onaylandi')));
    const onayliIzinler = izinSnapshot.docs.map(doc => doc.data());

    // 3. Hafta Bilgilerini Hesapla (W-yyyy-mm-dd formatından)
    const startStr = haftaId.substring(1); // "yyyy-MM-dd"
    const [year, month, day] = startStr.split('-').map(Number);
    const pazartesi = new Date(year, month - 1, day);
    
    const gunler: string[] = [];
    for (let i = 0; i < 7; i++) {
      const gun = new Date(pazartesi);
      gun.setDate(pazartesi.getDate() + i);
      const y = gun.getFullYear();
      const m = String(gun.getMonth() + 1).padStart(2, '0');
      const d = String(gun.getDate()).padStart(2, '0');
      gunler.push(`${y}-${m}-${d}`);
    }
    const haftaBitisStr = gunler[6];

    const buHaftakiYukler: Record<string, number> = {};
    muezzinler.forEach(m => buHaftakiYukler[m.id] = 0);

    const vakitler = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'];
    const gunPlan: Record<string, Record<string, { asil: string; yedek: string }>> = {};
    const batch = writeBatch(db);

    let oncekiVakitUidler: string[] = [];

    for (const gun of gunler) {
      gunPlan[gun] = {};
      const [gY, gM, gD] = gun.split('-').map(Number);
      const currentGunDate = new Date(gY, gM - 1, gD);
      const gunIndex = (currentGunDate.getDay() + 6) % 7; // 0=Pazartesi, ..., 6=Pazar
      const isFriday = currentGunDate.getDay() === 5;
      
      const bugunIzinliUidler = onayliIzinler
        .filter(izin => gun >= izin.baslangic && gun <= izin.bitis)
        .map(izin => izin.uid);
      
      // Sabit izin gününü de dahil et
      const musaitMuezzinler = muezzinler.filter(m => {
        const isOnIzin = bugunIzinliUidler.includes(m.id);
        const isFixedDayOff = m.haftalikIzinGunu === gunIndex;
        return !isOnIzin && !isFixedDayOff;
      });

      const adaylar = musaitMuezzinler.length >= 2 ? musaitMuezzinler : muezzinler;
      const sirali = tieBreakerSirala(adaylar, buHaftakiYukler, oncekiVakitUidler, isFriday);
      
      const asil = sirali[0];
      const yedek = sirali[1];

      buHaftakiYukler[asil.id] += 1;
      // Bir sonraki gün için dinlenme listesini güncelle
      oncekiVakitUidler = [asil.id, yedek.id];

      for (const vakit of vakitler) {
        gunPlan[gun][vakit] = { asil: asil.id, yedek: yedek.id };
        
        // Bildirimleri ekle
        const bAsilRef = doc(collection(db, 'bildirimler'));
        batch.set(bAsilRef, {
          haftaId, tarih: gun, vakit, uid: asil.id, tip: 'asil',
          durum: 'bekliyor', pendingAck: true, olusturmaTarihi: Timestamp.now(),
          sonGuncelleme: Timestamp.now()
        });

        const bYedekRef = doc(collection(db, 'bildirimler'));
        batch.set(bYedekRef, {
          haftaId, tarih: gun, vakit, uid: yedek.id, tip: 'yedek',
          durum: 'bekliyor', pendingAck: true, olusturmaTarihi: Timestamp.now(),
          sonGuncelleme: Timestamp.now()
        });
      }
    }

    // Haftalık plan dökümanını kaydet
    const planRef = doc(db, 'haftaPlanlari', haftaId);
    batch.set(planRef, {
      haftaBaslangic: startStr,
      haftaBitis: haftaBitisStr,
      durum: 'yayinda',
      olusturmaTarihi: Timestamp.now(),
      gunler: gunPlan
    });

    await batch.commit();
  } catch (err) {
    throw handleFirestoreError(err, OperationType.WRITE, path);
  }
}
