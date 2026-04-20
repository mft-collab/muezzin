import { db, Timestamp } from './lib/firebaseAdminInit';
import { aylikVakitleriCek } from './lib/ezanFetch';

async function main() {
  const simdi = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  // Mevcut ayı da çekelim ki boş kalmasın
  const aylar = [
    { y: simdi.getFullYear(), m: simdi.getMonth() + 1 },
    { y: new Date(simdi.getFullYear(), simdi.getMonth() + 1, 1).getFullYear(), m: new Date(simdi.getFullYear(), simdi.getMonth() + 1, 1).getMonth() + 1 }
  ];

  for (const dateInfo of aylar) {
    const yil = dateInfo.y;
    const ay = dateInfo.m;
    const ayId = `${yil}-${String(ay).padStart(2, '0')}`;

    console.log(`İşleniyor: ${ayId}...`);

    try {
      const vakitData = await aylikVakitleriCek(yil, ay);
      
      // vakitData içinden sadece gunler kısmını almayalım, 
      // çünkü aylikVakitleriCek komple AylikVakitler (Vakitler) objesi dönüyor.
      // Doc.set() ile direkt tüm objeyi yazabiliriz.
      await db.collection('vakitler').doc(ayId).set({
        ...vakitData,
        guncellenmeTarihi: Timestamp.now()
      });
      
      console.log(`Başarılı: ${ayId}`);
    } catch (err: any) {
      console.error(`Hata (${ayId}):`, err.message);
      await db.collection('adminUyarilari').add({
        tip: 'apiHatasi',
        mesaj: `Ezan takvimi güncellenemedi (${ayId}): ${err.message}`,
        tarih: new Date().toISOString().split('T')[0],
        cozuldu: false,
        olusturmaTarihi: Timestamp.now()
      });
      // Bir ay hata verse de diğerini deneyelim ama sonunda hata kodu dönelim
      process.exitCode = 1;
    }
  }
}

main();
