import { db, Timestamp } from './firebaseAdminInit.ts';

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

  await db.collection('adminUyarilari').add({
    tip,
    mesaj: `Otomasyon hatası: "${isAdi}" GitHub Actions işi başarısız oldu. Loglara bakın ve gerekirse elle çalıştırın (workflow_dispatch).`,
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
