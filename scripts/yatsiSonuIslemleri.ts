import { db, Timestamp } from './lib/firebaseAdminInit.ts';
import type { DocumentData } from 'firebase-admin/firestore';
import { getTurkeyNow } from '../src/lib/dateUtils.ts';
import { handleFirestoreError, OperationType } from './lib/errors.ts';
import { gunlukKredileriHesapla } from '../src/lib/gunlukKrediHesaplama.ts';
import { fcmGonderVeTemizle, kullaniciFcmTokenleriniTopla, type FcmMessage } from './lib/fcmNotify.ts';

function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function processYatsiSonuIslemleri() {
  console.log("Günlük yatsı sonrası işlemleri başladı...");
  
  // Debug info — `_databaseId` Admin SDK'nın Firestore tipinde public olarak
  // açıklanmamış dahili bir alan (yalnızca hedef proje/veritabanını loglamak
  // için okunuyor); public bir getter olmadığından yapısal bir tip ile
  // daraltılıyor, blanket `any` yerine.
  try {
    const internalDb = db as unknown as { _databaseId?: { projectId?: string; databaseId?: string } };
    const projId = internalDb._databaseId?.projectId || 'unknown';
    const dbId = internalDb._databaseId?.databaseId || 'unknown';
    console.log(`Hedef Proje: ${projId}, Hedef Veritabanı: ${dbId}`);
  } catch {
    console.log("Debug bilgisi alınamadı.");
  }

  // NOT: new Date() KULLANILMIYOR — bu script GitHub Actions üzerinde UTC
  // saatiyle çalışır; cron saati kaydırılırsa (ör. DST/mevsimsel ayar) UTC
  // gece yarısı sınırı ile Türkiye takvim günü uyuşmayabilir. getTurkeyNow()
  // her zaman Türkiye (UTC+3) takvim gününü verir.
  const bugün = formatDateLocal(getTurkeyNow());

  // ADIM 1: "Okudum" kontrolü
  // NOT: pendingAck filtresi KULLANILMIYOR — kendi "Okudum" onayını veren
  // müezzinlerin bildirimi gün içinde zaten durum:'onaylandi', pendingAck:false
  // olarak işaretlenmiş oluyor (bkz. src/services/okudumServisi.ts). Puan
  // hem bu şekilde erkenden onaylanmış görevlere hem de gün sonuna kadar
  // hiç dokunulmamış (varsayılan tamamlanmış sayılan) görevlere veriliyor.
  let bildirimler;
  try {
    bildirimler = await db.collection('bildirimler')
      .where('tarih', '==', bugün)
      .get();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'bildirimler');
    return; // handleFirestoreError throws, but for TS completeness
  }

  const batch = db.batch();

  // Kredi hesaplaması saf bir çekirdekte yapılır (bkz. src/lib/gunlukKrediHesaplama.ts)
  // — planlamaCekirdegi.ts'teki "saf çekirdek, ince I/O sarmalayıcı" deseniyle
  // aynı, mantık burada birim testle doğrulanabilir.
  const bildirimVerileri = bildirimler.docs.map(doc => doc.data());
  const { asilKredi, cumaKredi, yedekKredi, uyariUids, okunduVarsayilanIndeksleri, puanIslenenIndeksleri } =
    gunlukKredileriHesapla(bildirimVerileri as { tip: string; durum: string; uid: string; cumaMi?: boolean; puanIslendi?: boolean }[]);

  // Tekrar-çalıştırma güvenliği (bkz. gunlukKrediHesaplama.ts `puanIslendi`
  // yorumu): kredi verilen HER kayıt `puanIslendi:true` ile işaretlenir —
  // 'bekliyor' kalanlar zaten durum değişimiyle (okundu_varsayilan) bir daha
  // sorguya girmez, ama 'onaylandi' kalanlar (kullanıcının gün içinde kendi
  // okudumOnayla'sını verdiği) hiçbir durum değişikliği ALMADIĞINDAN bu
  // işaret olmadan script aynı gün için ikinci kez çalıştırılırsa (ör.
  // GitHub Actions'ta manuel "Re-run failed jobs") ikinci kez kredilendirilirdi.
  // İki indeks kümesi çakışabildiğinden (bekliyor→hem okundu_varsayilan HEM
  // puanIslendi) her belge için TEK bir birleşik update nesnesi kurulur.
  const guncellemeler = new Map<number, DocumentData>();
  okunduVarsayilanIndeksleri.forEach((i) => {
    guncellemeler.set(i, { durum: 'okundu_varsayilan', pendingAck: false, sonGuncelleme: Timestamp.now() });
  });
  puanIslenenIndeksleri.forEach((i) => {
    guncellemeler.set(i, { ...(guncellemeler.get(i) || {}), puanIslendi: true });
  });
  guncellemeler.forEach((alanlar, i) => {
    batch.update(bildirimler.docs[i].ref, alanlar);
  });

  // Asil ve yedek kişilere puanlarını ver
  if (Object.keys(asilKredi).length > 0 || Object.keys(yedekKredi).length > 0) {
    const muezzinlerDocs = await db.collection('muezzins').get();
    muezzinlerDocs.docs.forEach(mDoc => {
      if (!asilKredi[mDoc.id] && !yedekKredi[mDoc.id]) return;
      const updates: Record<string, number> = {};
      if (asilKredi[mDoc.id]) {
        updates.aylikVakitSayisi = (mDoc.data().aylikVakitSayisi || 0) + asilKredi[mDoc.id];
      }
      if (cumaKredi[mDoc.id]) {
        updates.aylikCumaSayisi = (mDoc.data().aylikCumaSayisi || 0) + cumaKredi[mDoc.id];
      }
      if (yedekKredi[mDoc.id]) {
        updates.aylikYedekSayisi = (mDoc.data().aylikYedekSayisi || 0) + yedekKredi[mDoc.id];
      }
      batch.update(mDoc.ref, updates);
    });
  }

  if (uyariUids.length > 0) {
    await db.collection('adminUyarilari').add({
      tip: 'zincirTukendi',
      mesaj: `Görev devredilen yedekler onay vermedi: ${uyariUids.join(', ')}`,
      tarih: bugün,
      cozuldu: false,
      olusturmaTarihi: Timestamp.now()
    });
  }

  // ADIM 2 & 3: Arşivle ve yarını hazırla (Özet mantık)
  console.log("Bugün arşivlendi, yarın için bildirimler tetiklendi.");
  await batch.commit();

  // YENİ: Yarınki Görevliler İçin Kişiselleştirilmiş FCM Anlık Bildirimi Tetikle
  try {
    const yarınTarih = getTurkeyNow();
    yarınTarih.setDate(yarınTarih.getDate() + 1);
    const yarınStr = formatDateLocal(yarınTarih);

    console.log(`Yarınki (${yarınStr}) görevliler taranıyor...`);

    // Yarınki tüm bildirimleri çek
    const yarınkiBildirimler = await db.collection('bildirimler')
      .where('tarih', '==', yarınStr)
      .get();

    const userDuties: Record<string, string[]> = {};
    yarınkiBildirimler.docs.forEach(doc => {
      const data = doc.data();
      const uid = data.uid;
      
      // Türkçe vakit isimleri eşleştirmesi
      const vakitCeviri: Record<string, string> = {
        sabah: 'Sabah',
        ogle: 'Öğle',
        ikindi: 'İkindi',
        aksam: 'Akşam',
        yatsi: 'Yatsı'
      };
      
      const vakitName = vakitCeviri[data.vakit] || data.vakit;
      const roleType = data.tip === 'asil' ? 'Asil' : 'Yedek';
      
      if (!userDuties[uid]) {
        userDuties[uid] = [];
      }
      userDuties[uid].push(`${vakitName} (${roleType})`);
    });

    const uidList = Object.keys(userDuties);
    if (uidList.length > 0) {
      const muezzinsSnap = await db.collection('muezzins').get();
      const muezzinMap: Record<string, any> = {};
      muezzinsSnap.docs.forEach(d => {
        muezzinMap[d.id] = d.data();
      });

      const messages: FcmMessage[] = [];
      const tokenToUidMap: Record<string, string> = {};
      for (const uid of uidList) {
        const userProfile = muezzinMap[uid];
        const remindersEnabled = userProfile?.notificationSettings?.nobetHatirlatici !== false;

        if (userProfile?.aktif === true && remindersEnabled) {
          const tokens = kullaniciFcmTokenleriniTopla(userProfile);

          const dutyListStr = userDuties[uid].join(', ');
          for (const token of tokens) {
            tokenToUidMap[token] = uid;
            messages.push({
              token,
              notification: {
                title: 'Yarınki Ezan Göreviniz var 🕌',
                body: `Yarın ${dutyListStr} göreviniz bulunmaktadır. Detaylar ve teyit için uygulamayı açın.`
              },
              data: {
                type: 'daily_duty_reminder',
                tarih: yarınStr
              }
            });
          }
        }
      }

      await fcmGonderVeTemizle(messages, tokenToUidMap, 'Günlük hatırlatma FCM bildirimi');
    } else {
      console.log('Yarın için planlanmış herhangi bir nöbet görevi bulunamadı.');
    }
  } catch (fcmErr) {
    console.error('FCM günlük hatırlatma bildirim gönderimi başarısız oldu:', fcmErr);
  }

  // ADIM 4: Aylık skor (örnek)
  const yarın = getTurkeyNow();
  yarın.setDate(yarın.getDate() + 1);
  if (yarın.getDate() === 1) {
    const muezzins = await db.collection('muezzins').get();
    const resetBatch = db.batch();
    muezzins.docs.forEach(doc => resetBatch.update(doc.ref, { aylikVakitSayisi: 0, aylikCumaSayisi: 0, aylikYedekSayisi: 0 }));
    await resetBatch.commit();
    console.log("Skorlar sıfırlandı.");
  }

  // ADIM 5: Yıllık izin kotası sıfırlama — yalnızca 1 Ocak'ta (ayın 1'i
  // OLUP ayrıca ayın Ocak olması gerekir; yukarıdaki aylık sıfırlama her
  // ayın 1'inde çalışır ama bu yalnızca takvim yılının başında). Kota
  // yıllikIzinKullanilanGun sert üst sınırı firestore.rules'ta tanımlıdır
  // (bkz. src/store/useAdminIzinlerStore.ts).
  if (yarın.getDate() === 1 && yarın.getMonth() === 0) {
    const muezzins = await db.collection('muezzins').get();
    const yillikResetBatch = db.batch();
    muezzins.docs.forEach(doc => yillikResetBatch.update(doc.ref, { yillikIzinKullanilanGun: 0 }));
    await yillikResetBatch.commit();
    console.log("Yıllık izin kotaları sıfırlandı (yeni takvim yılı).");
  }

  console.log("İşlemler tamam.");
}

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  processYatsiSonuIslemleri()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
}
