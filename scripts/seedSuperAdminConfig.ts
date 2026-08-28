import { db } from './lib/firebaseAdminInit.ts';

/**
 * config/bootstrap dokümanındaki superAdminEmails listesine e-posta ekler.
 * Kaynak koda gömülü süper-admin e-postası yerine geçer (bkz. firestore.rules
 * isSuperAdminEmail, src/store/useAuthStore.ts).
 *
 * En yüksek yetkili config belgesini değiştirdiğinden — `backfillCumaMi.ts`
 * ile AYNI güvenlik ağı deseni uygulanır (bkz. kod denetimi): varsayılan
 * KURU ÇALIŞTIRMA, gerçek yazım için `--apply` gerekir.
 *
 * Kullanım:
 *   tsx scripts/seedSuperAdminConfig.ts admin@example.com [baska@example.com ...]            # yalnızca rapor, yazmaz
 *   tsx scripts/seedSuperAdminConfig.ts admin@example.com [baska@example.com ...] --apply     # gerçekten yazar
 */
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
  const existing: string[] = snap.exists ? (snap.data()?.superAdminEmails || []) : [];
  const merged = Array.from(new Set([...existing, ...emails]));
  const eklenecekler = emails.filter((e) => !existing.includes(e));

  console.log(apply ? 'UYGULAMA MODU — config/bootstrap yazılacak.' : 'KURU ÇALIŞTIRMA — hiçbir şey yazılmayacak (--apply ile gerçek çalıştırma yapın).');
  console.log(`Mevcut süper-admin e-postaları: ${existing.length > 0 ? existing.join(', ') : '(yok)'}`);
  console.log(`Eklenecek yeni e-postalar: ${eklenecekler.length > 0 ? eklenecekler.join(', ') : '(hepsi zaten listede)'}`);

  if (!apply) {
    console.log('\nGerçek yazım için: tsx scripts/seedSuperAdminConfig.ts <e-posta...> --apply');
    return;
  }

  await ref.set({ superAdminEmails: merged }, { merge: true });
  console.log(`config/bootstrap güncellendi. Süper-admin e-postaları: ${merged.join(', ')}`);
}

main().catch((err) => {
  console.error('Süper-admin seed hatası:', err);
  process.exit(1);
});
