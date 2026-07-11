import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type IndexField = {
  fieldPath: string;
  order?: string;
};

type FirestoreIndex = {
  collectionGroup: string;
  queryScope: string;
  fields: IndexField[];
};

type FirestoreIndexesFile = {
  indexes: FirestoreIndex[];
};

type RequiredIndex = {
  collectionGroup: string;
  fields: string[];
  reason: string;
};

const requiredIndexes: RequiredIndex[] = [
  {
    collectionGroup: 'bildirimler',
    fields: ['uid', 'tarih', 'vakit'],
    reason: 'useBugunkuGorevlerim ve kullanici bazli gunluk gorev sorgulari'
  },
  {
    collectionGroup: 'bildirimler',
    fields: ['tarih', 'vakit', 'durum'],
    reason: 'vakit/durum bazli operasyonel kontroller'
  },
  {
    collectionGroup: 'bildirimler',
    fields: ['tarih', 'vakit', 'tip'],
    reason: 'mazeret devrinde yedek bildirimi bulma'
  },
  {
    collectionGroup: 'bildirimler',
    fields: ['haftaId', 'tarih'],
    reason: 'admin haftalik cizelge gun bildirimleri'
  },
  {
    collectionGroup: 'bildirimler',
    fields: ['haftaId', 'tarih', 'vakit', 'tip'],
    reason: 'gorev devri automation yedek sorgusu'
  },
  {
    collectionGroup: 'bildirimler',
    fields: ['tip', 'durum'],
    reason: 'islenmemis asil mazeretleri bulma'
  },
  {
    collectionGroup: 'bildirimler',
    fields: ['tarih', 'pendingAck'],
    reason: 'yatsi sonu bekleyen onay kapatma'
  },
  {
    collectionGroup: 'bildirimler',
    fields: ['haftaId', 'tip', 'durum'],
    reason: 'haftalik plan bildirim durumu analizleri'
  },
  {
    collectionGroup: 'izinler',
    fields: ['durum', 'baslangic'],
    reason: 'onayli izin araligi sorgulari'
  },
  {
    collectionGroup: 'izinler',
    fields: ['durum', 'bitis'],
    reason: 'aktif izin filtreleme sorgulari'
  },
  {
    collectionGroup: 'adminUyarilari',
    fields: ['tarih', 'vakit', 'cozuldu'],
    reason: 'tekrar eden alarm uretimini engelleme'
  },
  {
    collectionGroup: 'vekalet_talepleri',
    fields: ['aliciUid', 'durum'],
    reason: 'muezzinin bekleyen vekalet tekliflerini listeleme'
  }
];

function fieldsKey(fields: IndexField[]) {
  return fields.map((field) => field.fieldPath).join('|');
}

const indexesFile = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as FirestoreIndexesFile;
const available = new Set(
  indexesFile.indexes.map((index) => `${index.collectionGroup}:${fieldsKey(index.fields)}`)
);

for (const required of requiredIndexes) {
  const key = `${required.collectionGroup}:${required.fields.join('|')}`;
  assert.ok(
    available.has(key),
    `Eksik Firestore index: ${key}. Gerekce: ${required.reason}`
  );
  console.log(`OK ${key}`);
}

console.log(`${requiredIndexes.length} firestore index verified`);
