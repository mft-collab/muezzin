import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * `firebase deploy --only firestore:indexes` TAM SENKRON çalışır: canlıda
 * var ama firestore.indexes.json'da olmayan bir composite index'i SESSİZCE
 * SİLER. Biri Firebase konsolundan elle bir index eklerse (ör. bir arıza
 * anında hızlı çözüm için), commit edilmediği sürece bir sonraki deploy onu
 * geri alır — hiçbir hata/uyarı vermeden (bkz. deploy.yml denetimi).
 *
 * Bu script deploy'dan ÖNCE çalışır: canlıdan indirilen index listesini
 * (bkz. deploy.yml "Canlıdaki Firestore index'lerini indir" adımı)
 * firestore.indexes.json ile karşılaştırır, repo'da tanımlı olmayan bir
 * canlı index bulursa deploy'u DURDURUR — sessiz silinme yerine görünür bir
 * hata.
 */

type IndexField = { fieldPath: string; order?: string; arrayConfig?: string };
type FirestoreIndex = { collectionGroup: string; queryScope: string; fields: IndexField[] };
type FirestoreIndexesFile = { indexes: FirestoreIndex[] };

function indexKey(index: FirestoreIndex): string {
  const fields = index.fields.map((f) => `${f.fieldPath}:${f.order ?? f.arrayConfig ?? ''}`).join('|');
  return `${index.collectionGroup}[${index.queryScope}]:${fields}`;
}

const livePath = process.argv[2];
assert.ok(livePath, 'Kullanım: verify-no-index-drift.ts <canli-index-dosyasi.json>');

const local = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as FirestoreIndexesFile;
const live = JSON.parse(readFileSync(livePath, 'utf8')) as FirestoreIndexesFile;

const localKeys = new Set(local.indexes.map(indexKey));
const orphaned = live.indexes.filter((index) => !localKeys.has(indexKey(index)));

if (orphaned.length > 0) {
  console.error(
    `HATA: Firebase konsolunda firestore.indexes.json'da TANIMLI OLMAYAN ${orphaned.length} composite index bulundu.`
  );
  console.error(
    "`firebase deploy --only firestore:indexes` tam senkron çalışır ve bunları SESSİZCE SİLER. " +
    'Devam etmeden önce bu index(ler)i firestore.indexes.json\'a ekleyip commit edin ' +
    '(veya kasıtlı olarak siliniyorsa bu adımı atlayın).'
  );
  for (const index of orphaned) {
    console.error(`  - ${indexKey(index)}`);
  }
  process.exit(1);
}

console.log(`Index drift yok: canlıdaki ${live.indexes.length} composite index'in tamamı firestore.indexes.json'da tanımlı.`);
