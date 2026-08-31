import { db, Timestamp } from './lib/firebaseAdminInit.ts';
import { aylikVakitleriCek, aylikVakitleriGrupla, type AylikVakitGrubu } from '../src/services/ezanVaktiServisi.ts';
import { getTurkeyNow, getTurkeyDateString } from '../src/lib/dateUtils.ts';

/**
 * Günlük vakit verisi sağlık kontrolü.
 *
 * `useVakitStore.ts` istemci tarafında bugün/yarın verisi eksikse kendi
 * kendine API'den tazeleniyor, ama bu yalnızca bir kullanıcı uygulamayı
 * AÇTIĞINDA tetiklenir ve admin'e hiçbir iz bırakmaz. Bu script aynı
 * eksikliği kullanıcı beklemeden, her gün proaktif olarak tespit edip
 * düzeltir ve kök nedenin araştırılabilmesi için adminUyarilari'na bir
 * kayıt bırakır (bkz. aylik-ezan-takvimi.yml'nin ayda bir çalışması —
 * bu iş arada geçen boşlukları yakalayan bir güvenlik ağıdır).
 */

async function gunVerisiTamMi(ilceId: string, tarih: string): Promise<boolean> {
  const [y, m] = tarih.split('-');
  const docId = `${ilceId}_${y}-${m}`;
  const snap = await db.collection('vakitler').doc(docId).get();
  if (!snap.exists) return false;
  const gun = snap.data()?.gunler?.[tarih];
  return !!(gun?.sabah && gun?.ogle && gun?.ikindi && gun?.aksam && gun?.yatsi);
}

async function main() {
  const settingsSnap = await db.collection('settings').doc('system').get();
  const settings = settingsSnap.data() as { ilceId?: string; ilceAdi?: string } | undefined;
  const ilceId = settings?.ilceId || '9148';
  const ilceAdi = settings?.ilceAdi || 'Ceyhan';

  const simdi = getTurkeyNow();
  const bugun = getTurkeyDateString(simdi);
  const yarinTarih = new Date(simdi);
  yarinTarih.setDate(simdi.getDate() + 1);
  const yarin = getTurkeyDateString(yarinTarih);

  const [bugunTamam, yarinTamam] = await Promise.all([
    gunVerisiTamMi(ilceId, bugun),
    gunVerisiTamMi(ilceId, yarin),
  ]);

  if (bugunTamam && yarinTamam) {
    console.log(`Vakit verisi sağlıklı: ${bugun} ve ${yarin} için tam kayıt mevcut (${ilceId}).`);
    return;
  }

  console.warn(
    `Vakit verisi eksik — bugün(${bugun}): ${bugunTamam ? 'tam' : 'EKSİK'}, yarın(${yarin}): ${yarinTamam ? 'tam' : 'EKSİK'}. API'den tazeleniyor...`
  );

  // BİLİNÇLİ OLARAK resmi Diyanet API'sini (scripts/lib/diyanetResmiApi.ts)
  // KULLANMIYOR — bu script GÜNLÜK çalıştığından, bir kesinti sırasında her
  // gün tekrar tekrar denenip aylık kotayı hızla tüketirdi (bkz. o dosyadaki
  // yorum). Anahtarsız zincirde (emushaf/Aladhan) kalır; resmi API yalnızca
  // AYDA BİR çalışan aylikEzanTakvimiGuncelle.ts'te kullanılıyor.
  //
  // "bugün" ve "yarın" farklı takvim aylarına düşebilir (ayın son günü) —
  // `aylikVakitleriCek(yil, ay)` Aladhan fallback'inde (calendarByCity)
  // KESİN olarak tek bir takvim ayına kilitlidir, bir sonraki ayı asla
  // döndürmez. Bu yüzden her iki tarihin ait olduğu ayı ayrı ayrı çekip
  // birleştiriyoruz (bkz. 2026-08-31 → 2026-09-01 canlı arızası: Eylül
  // verisi bu adım tek bir aya kilitliyken hiç yazılamamıştı).
  const gerekliAylar = new Map<string, { yil: number; ay: number }>();
  for (const tarih of [bugun, yarin]) {
    const [y, m] = tarih.split('-').map(Number);
    gerekliAylar.set(`${y}-${m}`, { yil: y, ay: m });
  }

  const gruplar: Record<string, AylikVakitGrubu> = {};
  for (const { yil, ay } of gerekliAylar.values()) {
    const parca = await aylikVakitleriCek(yil, ay, ilceId, ilceAdi);
    // Kayan pencereyi gerçek takvim ayına göre bölen paylaşılan çekirdek
    // (bkz. vakitCacheServisi.ts, scripts/aylikEzanTakvimiGuncelle.ts,
    // useVakitStore.ts — mimari/mantık denetimi O5) — burada elle yeniden
    // yazılmış aynı mantığın yerine geçer.
    Object.assign(gruplar, aylikVakitleriGrupla(parca));
  }

  for (const [ayId, grup] of Object.entries(gruplar)) {
    const docId = `${ilceId}_${ayId}`;
    // NOT: `gunler` gerçek bir iç içe (nested) obje olarak gönderilmeli —
    // `{'gunler.2026-07-30': ...}` gibi nokta içeren düz anahtarlar
    // set(...,{merge:true}) ile literal alan adı olarak yazılır, nested
    // path olarak YORUMLANMAZ (bu tam olarak üretimde yaşanan veri
    // bozulmasının sebebiydi).
    await db.collection('vakitler').doc(docId).set(
      {
        ilceId,
        kaynakApi: grup.kaynakApi,
        guncellenmeTarihi: Timestamp.now(),
        gunler: grup.gunler,
      },
      { merge: true }
    );
    console.log(`Tazelendi: ${docId} (${Object.keys(grup.gunler).length} gün yazıldı)`);
  }

  await db.collection('adminUyarilari').add({
    tip: 'apiHatasi',
    mesaj: `Vakit verisi otomatik tazelendi: "${ilceId}" ilçesi için bugün (${bugun}) veya yarın (${yarin}) verisi eksikti, günlük sağlık kontrolü API'den yeniden çekip doldurdu. Aylık güncelleme cron'unun (aylik-ezan-takvimi.yml) neden zamanında/doğru dokümana yazmadığını kontrol edin.`,
    cozuldu: false,
    olusturmaTarihi: Timestamp.now(),
  });

  const [bugunTamam2, yarinTamam2] = await Promise.all([
    gunVerisiTamMi(ilceId, bugun),
    gunVerisiTamMi(ilceId, yarin),
  ]);
  if (!bugunTamam2 || !yarinTamam2) {
    console.error('Tazeleme denemesinden sonra hâlâ eksik veri var (API de veri döndürmemiş olabilir).');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Kritik hata:', err);
  process.exitCode = 1;
});
