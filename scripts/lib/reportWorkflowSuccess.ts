import { db, Timestamp } from './firebaseAdminInit.ts';
import { otomasyonUyarisiDocId } from './reportWorkflowFailure.ts';

/**
 * `reportWorkflowFailure.ts`'in companion'ı — bir GitHub Actions cron job'u
 * BAŞARIYLA tamamlandığında, aynı işin ÖNCEKİ bir çalışmasında bırakılmış
 * ve henüz elle çözülmemiş "otomasyonHatasi" uyarısını otomatik çözer.
 *
 * Öncesinde admin panelindeki uyarılar yalnızca ELLE çözülebiliyordu
 * (bkz. useKrizAlarmlariStore.ts'in alarmCoz fonksiyonu) — geçici bir
 * altyapı arızası (ör. GitHub Actions runner sorunu, geçici Firestore
 * kesintisi) düzeldikten sonra bile uyarı sonsuza dek "açık" kalıyordu,
 * admin'in gerçek/güncel sorunları eski gürültüden ayırt etmesini
 * zorlaştırıyordu ("bilinçli olarak dışarıda bırakılanlar" listesinden
 * kapatılan bulgu).
 *
 * `raporlaBasarisizlik` ile AYNI deterministik ID'yi (tip+isAdi) kullanır
 * — bu yüzden hangi uyarının çözüleceğini bulmak için sorgu YAPMAYA gerek
 * yok, doğrudan `.doc(docId).get()`.
 */
export async function raporlaBasari(isAdi: string, tip = 'otomasyonHatasi'): Promise<void> {
  const docId = otomasyonUyarisiDocId(tip, isAdi);
  const ref = db.collection('adminUyarilari').doc(docId);
  const snap = await ref.get();

  if (!snap.exists || snap.data()?.cozuldu === true) {
    // Zaten yok ya da zaten çözülmüş — yapılacak bir şey yok, sessizce çık.
    return;
  }

  await ref.update({ cozuldu: true, cozulmeTarihi: Timestamp.now() });
  console.log(`Önceki otomasyon uyarısı otomatik çözüldü: ${isAdi}`);
}

// `.github/workflows/*.yml` içindeki `if: success()` adımı basitçe
// `npx tsx scripts/lib/reportWorkflowSuccess.ts "<İş Adı>"` çağırır. Bu
// blok yalnızca dosya DOĞRUDAN çalıştırıldığında tetiklenir (bkz.
// reportWorkflowFailure.ts'teki AYNI desen) — dosya import edildiğinde
// (ör. tests/integration/reportWorkflowStatus.test.ts) istemeden bir
// "Bilinmeyen İş" başarı bildirimi yazmaz.
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  const isAdi = process.argv[2] || 'Bilinmeyen İş';
  const tip = process.argv[3] || 'otomasyonHatasi';
  raporlaBasari(isAdi, tip).catch((err) => {
    // Bu script de bir "iyi denemedir" (best-effort) — asıl işin
    // başarısını maskelememesi için process.exit(1) YAPILMAZ.
    console.error('Başarı bildirimi yazılamadı:', err);
  });
}
