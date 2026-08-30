import { createHash } from 'node:crypto';
import { db } from './lib/firebaseAdminInit.ts';

/**
 * config/bootstrap dokümanındaki superAdminEmailHashes listesine e-posta
 * ekler. Kaynak koda gömülü süper-admin e-postası yerine geçer (bkz.
 * firestore.rules isSuperAdminEmail, src/store/useAuthStore.ts).
 *
 * Doküman DÜZ METİN e-posta değil, SHA-256 hex hash tutar — `config/bootstrap`
 * `allow read: if isSignedIn()` ile herhangi bir giriş yapmış kullanıcıya açık
 * olmak ZORUNDA (client bootstrap akışı gereği, bkz. firestore.rules
 * `config/{docId}` yorumu — proje Spark planında kalmayı tercih ettiğinden bu
 * kontrolü sunucu tarafına taşıyacak bir Cloud Function katmanı yok); düz
 * metin e-posta saklamak bu listeyi tüm ekibe ifşa ederdi (bkz. kod
 * denetimi). Hash tek yönlü olduğundan sızsa bile e-postaların kendisini
 * geri vermez.
 *
 * En yüksek yetkili config belgesini değiştirdiğinden — `backfillCumaMi.ts`
 * ile AYNI güvenlik ağı deseni uygulanır (bkz. kod denetimi): varsayılan
 * KURU ÇALIŞTIRMA, gerçek yazım için `--apply` gerekir.
 *
 * Kullanım:
 *   tsx scripts/seedSuperAdminConfig.ts admin@example.com [baska@example.com ...]            # yalnızca rapor, yazmaz
 *   tsx scripts/seedSuperAdminConfig.ts admin@example.com [baska@example.com ...] --apply     # gerçekten yazar
 */
function sha256Hex(email: string): string {
  return createHash('sha256').update(email, 'utf8').digest('hex');
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const emails = args
    .filter((a) => a !== '--apply')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    throw new Error('En az bir e-posta adresi verilmeli. Örnek: tsx scripts/seedSuperAdminConfig.ts admin@example.com --apply');
  }

  const ref = db.collection('config').doc('bootstrap');
  const snap = await ref.get();
  const existingHashes: string[] = snap.exists ? (snap.data()?.superAdminEmailHashes || []) : [];
  const yeniHashler = emails.map(sha256Hex);
  const merged = Array.from(new Set([...existingHashes, ...yeniHashler]));
  const eklenecekler = emails.filter((e) => !existingHashes.includes(sha256Hex(e)));

  console.log(apply ? 'UYGULAMA MODU — config/bootstrap yazılacak.' : 'KURU ÇALIŞTIRMA — hiçbir şey yazılmayacak (--apply ile gerçek çalıştırma yapın).');
  console.log(`Mevcut süper-admin hash sayısı: ${existingHashes.length}`);
  console.log(`Eklenecek yeni e-postalar: ${eklenecekler.length > 0 ? eklenecekler.join(', ') : '(hepsi zaten listede)'}`);

  if (!apply) {
    console.log('\nGerçek yazım için: tsx scripts/seedSuperAdminConfig.ts <e-posta...> --apply');
    return;
  }

  await ref.set({ superAdminEmailHashes: merged }, { merge: true });
  console.log(`config/bootstrap güncellendi. Toplam süper-admin hash sayısı: ${merged.length}`);
}

main().catch((err) => {
  console.error('Süper-admin seed hatası:', err);
  process.exit(1);
});
