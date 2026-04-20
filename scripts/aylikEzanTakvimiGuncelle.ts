import { db, Timestamp } from './lib/firebaseAdminInit';
import { aylikVakitleriCek } from './lib/ezanFetch';

async function main() {
  const simdi = new Date();
  const gelecekAy = new Date(simdi.getFullYear(), simdi.getMonth() + 1, 1);
  const yil = gelecekAy.getFullYear();
  const ay = gelecekAy.getMonth() + 1;
  const ayId = `${yil}-${String(ay).padStart(2, '0')}`;

  try {
    const vakitler = await aylikVakitleriCek(yil, ay);
    await db.collection('vakitler').doc(ayId).set({
      ceyhanId: '9148',
      gunler: vakitler,
      kaynakApi: 'diyanet',
      guncellenmeTarihi: Timestamp.now()
    });
    console.log(`Takvim güncellendi: ${ayId}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    await db.collection('adminUyarilari').add({
      tip: 'apiHatasi',
      mesaj: 'Ezan takvim güncellenemedi!',
      tarih: new Date().toISOString().split('T')[0],
      cozuldu: false,
      olusturmaTarihi: Timestamp.now()
    });
    process.exit(1);
  }
}

main();
