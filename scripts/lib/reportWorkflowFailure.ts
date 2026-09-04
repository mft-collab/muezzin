import { db, Timestamp } from './firebaseAdminInit.ts';
import { getTurkeyDateString } from '../../src/lib/dateUtils.ts';

/** `isAdi`den (workflow adı) deterministik bir belge ID'si türetir — bkz.
 * altındaki main() yorumu: aynı iş tekrar tekrar başarısız olursa (10
 * dakikalık cron'larda günde ~288 kez olabilir) her seferinde YENİ bir
 * belge yerine AYNI belge güncellenir. */
function slugify(s: string): string {
  return s.toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '').slice(0, 80) || 'bilinmeyen';
}

/**
 * Bir GitHub Actions cron job'u başarısız olduğunda admin panelinde
 * görünür bir uyarı bırakır (bkz. src/pages/admin/modules/KrizAlarmlari.tsx).
 * Argüman olarak başarısız olan workflow'un adı verilir; process.argv'den okunur
 * ki `.github/workflows/*.yml` içindeki `if: failure()` adımı basitçe
 * `npx tsx scripts/lib/reportWorkflowFailure.ts "<İş Adı>"` çağırabilsin.
 */
async function main() {
  const isAdi = process.argv[2] || 'Bilinmeyen İş';

  // Önceden BEŞ farklı cron'un (aylık ezan takvimi, günlük log temizliği,
  // günlük yatsı sonu, haftalık plan, vakit veri sağlığı) hepsi 'apiHatasi'
  // tipiyle raporlanıyordu — bu tip aslında "dış API'ye ulaşılamıyor"
  // anlamına geliyor (bkz. src/pages/admin/modules/KrizAlarmlari.tsx ikon/
  // renk/başlık eşlemesi: 'API BAĞLANTI ARIZASI'), oysa bir GitHub Actions
  // işinin çökmesinin nedeni genelde API'yle ilgisiz (kod hatası, zaman
  // aşımı, kota vb.). Admin panelinde bu beşi diğer gerçek API arızalarından
  // (ör. scripts/vakitVeriSagligiKontrol.ts'in kendi 'apiHatasi' uyarısı)
  // ayırt edilemiyordu (bkz. kod denetimi). Yeni, daha doğru bir kategori.
  const tip = process.argv[3] || 'otomasyonHatasi';

  // Deterministik ID (tip+isAdi) — bkz. yukarıdaki slugify yorumu. Aynı iş
  // tekrar başarısız olursa (10 dakikalık cron'larda sık) `.add()`'in
  // ürettiği gibi her seferinde yeni bir belge değil, AYNI belge
  // güncellenir; admin panelinde onlarca kopya birikmesi önlenir (düşük
  // öncelikli bulgu). İş daha önce çözülmüş (cozuldu:true) ama yeniden
  // başarısız olduysa bu, belgeyi doğru şekilde tekrar açar.
  const docId = `otomasyon_${slugify(tip)}_${slugify(isAdi)}`;

  await db.collection('adminUyarilari').doc(docId).set({
    tip,
    mesaj: `Otomasyon hatası: "${isAdi}" GitHub Actions işi başarısız oldu. Loglara bakın ve gerekirse elle çalıştırın (workflow_dispatch).`,
    tarih: getTurkeyDateString(),
    vakit: null,
    cozuldu: false,
    olusturmaTarihi: Timestamp.now()
  });

  console.log(`Admin uyarısı oluşturuldu: ${isAdi}`);
}

main().catch((err) => {
  // Bu script'in kendisi bir "iyi denemedir" (best-effort) — asıl işin
  // başarısızlığını maskelememesi için burada process.exit(1) YAPILMAZ,
  // sadece loglanır.
  console.error('Başarısızlık bildirimi yazılamadı:', err);
});
