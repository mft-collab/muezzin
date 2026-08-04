/**
 * E2E ortam hazırlığı: Firestore + Auth emülatörlerine (firebase emulators:start
 * ile ayağa kalkmış olmalı) gerçek bir kullanıcı ve bekleyen bir "asil" görev
 * bildirimi seed eder, sonra o kullanıcı için imzalı bir custom token üretip
 * STDOUT'a yazar. tests/e2e/mazeret-flow.spec.ts bu token'ı yakalayıp
 * signInWithCustomToken ile GERÇEK bir Firebase Auth oturumu açar — böylece
 * uygulama Firestore güvenlik kurallarına göre gerçekten kimlikli istek atar
 * (önceki sürüm yalnızca localStorage üzerinden UI state'ini kandırıyordu ve
 * asıl Firestore çağrıları production'a kimliksiz gidiyordu).
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

const app = getApps().length ? getApps()[0]! : initializeApp({ projectId: firebaseConfig.projectId });
const db = getFirestore(app);
const auth = getAuth(app);

const UID = 'muezzin_e2e_asil';
const YEDEK_UID = 'muezzin_e2e_yedek';

/**
 * Uygulama "bugün"ü her zaman Türkiye saatiyle (UTC+3, bkz. src/lib/dateUtils.ts
 * getTurkeyDateString) hesaplıyor. Bu fonksiyon önceden çalıştıran makinenin
 * SİSTEM yerel saatini kullanıyordu — GitHub Actions runner'ları UTC'de
 * çalıştığından, 21:00–24:00 UTC arası (Türkiye'de gece yarısını geçmiş)
 * seed "bugün" ile uygulamanın gördüğü "bugün" bir takvim günü farklı oluyor,
 * seed edilen bildirim hiç bulunamıyor ve E2E testi rastgele/saat-bağımlı
 * biçimde başarısız oluyordu. UTC aritmetiği + UTC getter'ları kullanarak
 * makinenin yerel saat dilimi ayarından tamamen bağımsız, uygulamayla birebir
 * aynı "Türkiye bugünü"nü hesaplıyoruz.
 */
function turkeyTodayStr(): string {
  const turkeyMs = Date.now() + 3 * 60 * 60 * 1000; // UTC+3 sabit ofset (Türkiye'de DST yok)
  const turkey = new Date(turkeyMs);
  const y = turkey.getUTCFullYear();
  const m = String(turkey.getUTCMonth() + 1).padStart(2, '0');
  const d = String(turkey.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function seed(): Promise<string> {
  try {
    await auth.deleteUser(UID);
  } catch {
    // kullanıcı yoktu, sorun değil
  }
  await auth.createUser({ uid: UID, email: `${UID}@example.test`, displayName: 'E2E Asil' });

  await db.collection('muezzins').doc(UID).set({
    displayName: 'E2E Asil',
    email: `${UID}@example.test`,
    role: 'muezzin',
    aktif: true,
    photoURL: '',
    fcmToken: null,
    aylikVakitSayisi: 0
  });

  await db.collection('muezzins').doc(YEDEK_UID).set({
    displayName: 'E2E Yedek',
    email: `${YEDEK_UID}@example.test`,
    role: 'muezzin',
    aktif: true,
    photoURL: '',
    fcmToken: null,
    aylikVakitSayisi: 0
  });

  const todayStr = turkeyTodayStr();
  const haftaId = `W${todayStr}`;

  await db.collection('bildirimler').doc(`${haftaId}_${todayStr}_yatsi_asil`).set({
    haftaId,
    tarih: todayStr,
    vakit: 'yatsi',
    uid: UID,
    tip: 'asil',
    durum: 'bekliyor',
    pendingAck: true,
    retSebebi: null,
    olusturmaTarihi: Timestamp.now(),
    sonGuncelleme: Timestamp.now()
  });

  await db.collection('bildirimler').doc(`${haftaId}_${todayStr}_yatsi_yedek`).set({
    haftaId,
    tarih: todayStr,
    vakit: 'yatsi',
    uid: YEDEK_UID,
    tip: 'yedek',
    durum: 'bekliyor',
    pendingAck: true,
    retSebebi: null,
    olusturmaTarihi: Timestamp.now(),
    sonGuncelleme: Timestamp.now()
  });

  return auth.createCustomToken(UID);
}

seed()
  .then((token) => {
    // Yalnızca token'ı yazdır — Playwright bunu stdout'tan doğrudan okuyor.
    process.stdout.write(token);
    process.exit(0);
  })
  .catch((err) => {
    console.error('E2E seed başarısız:', err);
    process.exit(1);
  });
