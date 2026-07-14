import { db } from './lib/firebaseAdminInit.ts';

/**
 * config/bootstrap dokümanındaki superAdminEmails listesine e-posta ekler.
 * Kaynak koda gömülü süper-admin e-postası yerine geçer (bkz. firestore.rules
 * isSuperAdminEmail, src/store/useAuthStore.ts).
 *
 * Kullanım: tsx scripts/seedSuperAdminConfig.ts admin@example.com [baska@example.com ...]
 */
async function main() {
  const emails = process.argv.slice(2).map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (emails.length === 0) {
    throw new Error('En az bir e-posta adresi verilmeli. Örnek: tsx scripts/seedSuperAdminConfig.ts admin@example.com');
  }

  const ref = db.collection('config').doc('bootstrap');
  const snap = await ref.get();
  const existing: string[] = snap.exists ? (snap.data()?.superAdminEmails || []) : [];
  const merged = Array.from(new Set([...existing, ...emails]));

  await ref.set({ superAdminEmails: merged }, { merge: true });

  console.log(`config/bootstrap güncellendi. Süper-admin e-postaları: ${merged.join(', ')}`);
}

main().catch((err) => {
  console.error('Süper-admin seed hatası:', err);
  process.exit(1);
});
