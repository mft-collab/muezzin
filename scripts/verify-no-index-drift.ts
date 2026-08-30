import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * `firebase deploy --only firestore:indexes` TAM SENKRON çalışır: canlıda
 * var ama firestore.indexes.json'da olmayan bir composite index'i VEYA
 * field override'ı SESSİZCE SİLER. Biri Firebase konsolundan elle bir index/
 * override eklerse (ör. bir arıza anında hızlı çözüm için), commit
 * edilmediği sürece bir sonraki deploy onu geri alır — hiçbir hata/uyarı
 * vermeden (bkz. deploy.yml denetimi).
 *
 * Bu script deploy'dan ÖNCE çalışır: canlıdan indirilen listeyi (bkz.
 * deploy.yml "Canlıdaki Firestore index'lerini indir" adımı)
 * firestore.indexes.json ile karşılaştırır, repo'da tanımlı olmayan bir
 * canlı index/override bulursa deploy'u DURDURUR — sessiz silinme yerine
 * görünür bir hata.
 */

type IndexField = { fieldPath: string; order?: string; arrayConfig?: string };
type FirestoreIndex = { collectionGroup: string; queryScope: string; fields: IndexField[] };
type FieldOverrideIndex = { queryScope: string; order?: string; arrayConfig?: string };
type FieldOverride = { collectionGroup: string; fieldPath: string; indexes: FieldOverrideIndex[] };
type FirestoreIndexesFile = { indexes: FirestoreIndex[]; fieldOverrides?: FieldOverride[] };

function indexKey(index: FirestoreIndex): string {
  const fields = index.fields.map((f) => `${f.fieldPath}:${f.order ?? f.arrayConfig ?? ''}`).join('|');
  return `${index.collectionGroup}[${index.queryScope}]:${fields}`;
}

function overrideKey(override: FieldOverride): string {
  const indexes = override.indexes
    .map((i) => `${i.queryScope}:${i.order ?? i.arrayConfig ?? ''}`)
    .sort()
    .join('|');
  return `${override.collectionGroup}.${override.fieldPath}:${indexes}`;
}

/**
 * `firebase firestore:indexes` çıktısına `npx`/`firebase-tools`'un stdout'a
 * bastığı bir güncelleme bildirimi vb. karışabilir (ör. soğuk bir CI cache'inde) —
 * bu durumda dosya artık saf JSON olmuyor. Doğrudan JSON.parse ham bir stack
 * trace'le başarısız olup gerçek nedeni ("index drift" değil, kirli çıktı)
 * gizlerdi (bkz. kod denetimi, ikinci tur). En dıştaki `{...}` bloğunu
 * çıkarıp onu ayrıştırmayı dener, olmazsa açık bir hata verir.
 */
function parseIndexesFile(path: string): FirestoreIndexesFile {
  const raw = readFileSync(path, 'utf8');
  try {
    return JSON.parse(raw) as FirestoreIndexesFile;
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as FirestoreIndexesFile;
      } catch {
        // aşağıdaki assert.fail'e düş
      }
    }
    assert.fail(
      `${path} geçerli JSON değil (firebase-tools/npx çıktıya beklenmeyen metin karıştırmış olabilir). ` +
      `İlk 200 karakter: ${raw.slice(0, 200)}`
    );
  }
}

const livePath = process.argv[2];
assert.ok(livePath, 'Kullanım: verify-no-index-drift.ts <canli-index-dosyasi.json>');

const local = parseIndexesFile('firestore.indexes.json');
const live = parseIndexesFile(livePath);

const localIndexKeys = new Set(local.indexes.map(indexKey));
const orphanedIndexes = live.indexes.filter((index) => !localIndexKeys.has(indexKey(index)));

const localOverrideKeys = new Set((local.fieldOverrides ?? []).map(overrideKey));
const orphanedOverrides = (live.fieldOverrides ?? []).filter((o) => !localOverrideKeys.has(overrideKey(o)));

if (orphanedIndexes.length > 0 || orphanedOverrides.length > 0) {
  console.error(
    `HATA: Firebase konsolunda firestore.indexes.json'da TANIMLI OLMAYAN ` +
    `${orphanedIndexes.length} composite index ve ${orphanedOverrides.length} field override bulundu.`
  );
  console.error(
    "`firebase deploy --only firestore:indexes` tam senkron çalışır ve bunları SESSİZCE SİLER. " +
    'Devam etmeden önce bunları firestore.indexes.json\'a ekleyip commit edin ' +
    '(veya kasıtlı olarak siliniyorsa bu adımı atlayın).'
  );
  for (const index of orphanedIndexes) {
    console.error(`  - [index] ${indexKey(index)}`);
  }
  for (const override of orphanedOverrides) {
    console.error(`  - [fieldOverride] ${overrideKey(override)}`);
  }
  process.exit(1);
}

console.log(
  `Index drift yok: canlıdaki ${live.indexes.length} composite index ve ` +
  `${(live.fieldOverrides ?? []).length} field override'ın tamamı firestore.indexes.json'da tanımlı.`
);
