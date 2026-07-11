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

  await db.collection('adminUyarilari').add({
    tip: 'apiHatasi',
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
