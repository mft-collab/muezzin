import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestContext,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';

const projectId = 'demo-muezzin-rules';

type TestCase = {
  name: string;
  run: (env: RulesTestEnvironment) => Promise<void>;
};

const testUser = (env: RulesTestEnvironment, uid: string, role?: string): RulesTestContext => {
  // email_verified: true — gercek kullanicilar yalnizca Google ile giris
  // yaptigi icin token'da her zaman dogrulanmis gelir; isSignedIn() bunu
  // zorunlu kildigi icin (bkz. mimari denetim K1) test fixture'i da ayni
  // varsayimi tasimali.
  return env.authenticatedContext(uid, {
    email: `${uid}@example.test`,
    email_verified: true,
    role
  });
};

/**
 * src/services/mazeretServisi.ts'in gercek davranisini taklit eder:
 * bildirimler'deki reddi VE mazeret_detaylari'ndaki retSebebi'yi AYNI
 * batch icinde atomik yazar (bkz. firestore.rules isSelfBildirimUpdate
 * yorumu, mimari denetim — altinci tur). `dbInstance` cagiran testin
 * kendi kimlikli Firestore handle'i olmali (testUser(...).firestore()).
 */
function mazeretRetBatch(
  dbInstance: ReturnType<RulesTestContext['firestore']>,
  bildirimId: string,
  uid: string,
  retSebebi: string,
  ekAlanlar: Record<string, unknown>
) {
  const batch = writeBatch(dbInstance);
  batch.update(doc(dbInstance, 'bildirimler', bildirimId), {
    durum: 'reddedildi',
    pendingAck: false,
    sonGuncelleme: Timestamp.now(),
    ...ekAlanlar
  });
  batch.set(doc(dbInstance, 'mazeret_detaylari', bildirimId), {
    uid,
    retSebebi,
    olusturmaTarihi: Timestamp.now()
  });
  return batch.commit();
}

async function seedBaseData(env: RulesTestEnvironment) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, 'muezzins/admin'), {
      displayName: 'Admin',
      email: 'admin@example.test',
      role: 'admin',
      aktif: true,
      photoURL: '',
      fcmToken: null,
      aylikVakitSayisi: 0
    });

    await setDoc(doc(db, 'muezzins/muezzin1'), {
      displayName: 'Muezzin One',
      email: 'muezzin1@example.test',
      role: 'muezzin',
      aktif: true,
      photoURL: '',
      fcmToken: null,
      aylikVakitSayisi: 0
    });

    await setDoc(doc(db, 'muezzins/muezzin2'), {
      displayName: 'Muezzin Two',
      email: 'muezzin2@example.test',
      role: 'muezzin',
      aktif: true,
      photoURL: '',
      fcmToken: null,
      aylikVakitSayisi: 0
    });

    await setDoc(doc(db, 'bildirimler/ownPendingAsil'), {
      haftaId: 'W2026-05-18',
      tarih: '2026-05-22',
      vakit: 'ogle',
      uid: 'muezzin1',
      tip: 'asil',
      durum: 'bekliyor',
      pendingAck: true,
      retSebebi: null,
      olusturmaTarihi: Timestamp.now(),
      sonGuncelleme: Timestamp.now()
    });

    await setDoc(doc(db, 'bildirimler/otherPendingAsil'), {
      haftaId: 'W2026-05-18',
      tarih: '2026-05-22',
      vakit: 'ikindi',
      uid: 'muezzin2',
      tip: 'asil',
      durum: 'bekliyor',
      pendingAck: true,
      retSebebi: null,
      olusturmaTarihi: Timestamp.now(),
      sonGuncelleme: Timestamp.now()
    });

    await setDoc(doc(db, 'bildirimler/ownPendingYedek'), {
      haftaId: 'W2026-05-18',
      tarih: '2026-05-22',
      vakit: 'aksam',
      uid: 'muezzin1',
      tip: 'yedek',
      durum: 'bekliyor',
      pendingAck: true,
      retSebebi: null,
      olusturmaTarihi: Timestamp.now(),
      sonGuncelleme: Timestamp.now()
    });

    // Deterministik ID'li asil/yedek çifti (mazeret devri testleri için) —
    // bkz. scripts/haftalikPlanOlustur.ts ve firestore.rules `isBackupPromotionFromMazeret`.
    await setDoc(doc(db, 'bildirimler/W2026-06-01_2026-06-03_yatsi_asil'), {
      haftaId: 'W2026-06-01',
      tarih: '2026-06-03',
      vakit: 'yatsi',
      uid: 'muezzin1',
      tip: 'asil',
      durum: 'bekliyor',
      pendingAck: true,
      retSebebi: null,
      olusturmaTarihi: Timestamp.now(),
      sonGuncelleme: Timestamp.now()
    });

    await setDoc(doc(db, 'bildirimler/W2026-06-01_2026-06-03_yatsi_yedek'), {
      haftaId: 'W2026-06-01',
      tarih: '2026-06-03',
      vakit: 'yatsi',
      uid: 'muezzin2',
      tip: 'yedek',
      durum: 'bekliyor',
      pendingAck: true,
      retSebebi: null,
      olusturmaTarihi: Timestamp.now(),
      sonGuncelleme: Timestamp.now()
    });

    // Cuma gunune denk gelen bir gorev (cumaMi:true) — mazeret/gorev devri
    // kisitlamasi testleri icin (bkz. firestore.rules `isSelfBildirimUpdate`).
    await setDoc(doc(db, 'bildirimler/fridayPendingAsil'), {
      haftaId: 'W2026-05-18',
      tarih: '2026-05-22',
      vakit: 'ogle',
      uid: 'muezzin1',
      tip: 'asil',
      durum: 'bekliyor',
      pendingAck: true,
      retSebebi: null,
      cumaMi: true,
      olusturmaTarihi: Timestamp.now(),
      sonGuncelleme: Timestamp.now()
    });

    // Aynı Cuma günü için bir yedek görev — yedek'in kendi mazeretinin de
    // Cuma'da kapalı kaldığını doğrulamak için.
    await setDoc(doc(db, 'bildirimler/fridayPendingYedek'), {
      haftaId: 'W2026-05-18',
      tarih: '2026-05-22',
      vakit: 'ikindi',
      uid: 'muezzin1',
      tip: 'yedek',
      durum: 'bekliyor',
      pendingAck: true,
      retSebebi: null,
      cumaMi: true,
      olusturmaTarihi: Timestamp.now(),
      sonGuncelleme: Timestamp.now()
    });

    await setDoc(doc(db, 'duyurular/publicNotice'), {
      baslik: 'Duyuru',
      icerik: 'Metin',
      tarih: Timestamp.now()
    });
  });
}

function validVakitGunleri() {
  return Object.fromEntries(
    Array.from({ length: 30 }, (_, index) => {
      const day = String(index + 1).padStart(2, '0');
      return [`2026-05-${day}`, {
        sabah: '04:10',
        gunes: '05:42',
        ogle: '12:45',
        ikindi: '16:30',
        aksam: '19:51',
        yatsi: '21:18'
      }];
    })
  );
}

const tests: TestCase[] = [
  {
    name: 'anonim kullanici duyuru okuyamaz',
    run: async (env) => {
      const db = env.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, 'duyurular/publicNotice')));
    }
  },
  {
    name: 'giris yapan kullanici duyuru okuyabilir',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertSucceeds(getDoc(doc(db, 'duyurular/publicNotice')));
    }
  },
  {
    name: 'dogrulanmamis e-posta ile hicbir seye erisilemez (K1 regresyonu)',
    run: async (env) => {
      const db = env.authenticatedContext('sahtekullanici', {
        email: 'sahtekullanici@example.test',
        email_verified: false
      }).firestore();
      await assertFails(getDoc(doc(db, 'duyurular/publicNotice')));
    }
  },
  {
    name: 'muezzin kendi profil tercihlerini guncelleyebilir ama rolunu degistiremez',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();

      await assertSucceeds(updateDoc(doc(db, 'muezzins/muezzin1'), {
        notificationSettings: {
          nobetHatirlatici: true,
          duyurular: false,
          mazeretDurumu: true
        }
      }));

      await assertFails(updateDoc(doc(db, 'muezzins/muezzin1'), {
        role: 'admin'
      }));
    }
  },
  {
    name: 'muezzin kendi fcm token haritasini guncelleyebilir',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();

      await assertSucceeds(updateDoc(doc(db, 'muezzins/muezzin1'), {
        fcmToken: 'token-1',
        fcmTokens: {
          'token-1': Timestamp.now()
        }
      }));
    }
  },
  {
    name: 'muezzin profil semasina yabanci alan ekleyemez',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();

      await assertFails(updateDoc(doc(db, 'muezzins/muezzin1'), {
        privateNote: 'Kurallarda tanimli olmayan alan'
      }));
    }
  },
  {
    name: 'muezzin fcm token haritasini sinirsiz buyutemez',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      const tooManyTokens = Object.fromEntries(
        Array.from({ length: 21 }, (_, index) => [`token-${index}`, Timestamp.now()])
      );

      await assertFails(updateDoc(doc(db, 'muezzins/muezzin1'), {
        fcmTokens: tooManyTokens
      }));
    }
  },
  {
    name: 'admin gecerli davet olusturabilir',
    run: async (env) => {
      const db = testUser(env, 'admin').firestore();

      await assertSucceeds(setDoc(doc(db, 'invites/valid@example.test'), {
        email: 'valid@example.test',
        displayName: 'Valid User',
        role: 'muezzin',
        haftalikIzinGunu: 5,
        olusturmaTarihi: Timestamp.now()
      }));
    }
  },
  {
    name: 'admin email ile belge id uyusmayan davet olusturamaz',
    run: async (env) => {
      const db = testUser(env, 'admin').firestore();

      await assertFails(setDoc(doc(db, 'invites/wrong@example.test'), {
        email: 'valid@example.test',
        displayName: 'Wrong User',
        role: 'muezzin',
        olusturmaTarihi: Timestamp.now()
      }));
    }
  },
  {
    name: 'admin gecersiz haftalik izin gunu ile davet olusturamaz',
    run: async (env) => {
      const db = testUser(env, 'admin').firestore();

      await assertFails(setDoc(doc(db, 'invites/invalid-leave@example.test'), {
        email: 'invalid-leave@example.test',
        displayName: 'Invalid Leave',
        role: 'muezzin',
        haftalikIzinGunu: 8,
        olusturmaTarihi: Timestamp.now()
      }));
    }
  },
  {
    name: 'davetsiz kullanici kendi muezzin profilini olusturamaz',
    run: async (env) => {
      const db = testUser(env, 'newuser').firestore();
      await assertFails(setDoc(doc(db, 'muezzins/newuser'), {
        displayName: 'New User',
        email: 'newuser@example.test',
        role: 'muezzin',
        aktif: true,
        photoURL: '',
        fcmToken: null,
        aylikVakitSayisi: 0
      }));
    }
  },
  {
    name: 'davetli kullanici kendi muezzin profilini olusturabilir',
    run: async (env) => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'invites/invited@example.test'), {
          email: 'invited@example.test',
          displayName: 'Invited User',
          role: 'muezzin',
          olusturmaTarihi: Timestamp.now()
        });
      });

      const db = testUser(env, 'invited').firestore();
      await assertSucceeds(setDoc(doc(db, 'muezzins/invited'), {
        displayName: 'Invited User',
        email: 'invited@example.test',
        role: 'muezzin',
        aktif: true,
        photoURL: '',
        fcmToken: null,
        aylikVakitSayisi: 0,
        // useAuthStore.ts her zaman bunu ayarlar (admin haric) — bkz.
        // mimari denetim Y4 / isInvitedSelfMuezzinCreate.
        onayBekliyor: true
      }));
    }
  },
  {
    name: 'davetli kullanici onayBekliyor:false ile kendi profilini olusturamaz (Y4 regresyonu)',
    run: async (env) => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'invites/invited2@example.test'), {
          email: 'invited2@example.test',
          displayName: 'Invited User 2',
          role: 'muezzin',
          olusturmaTarihi: Timestamp.now()
        });
      });

      const db = testUser(env, 'invited2').firestore();
      // onayBekliyor:false (ya da hic gonderilmemesi) ile kendi profilini
      // olusturmaya calisan bir kullanici, admin onayini atlayip dogrudan
      // nobete atanabilir hale gelmemeli.
      await assertFails(setDoc(doc(db, 'muezzins/invited2'), {
        displayName: 'Invited User 2',
        email: 'invited2@example.test',
        role: 'muezzin',
        aktif: true,
        photoURL: '',
        fcmToken: null,
        aylikVakitSayisi: 0,
        onayBekliyor: false
      }));
    }
  },
  {
    name: 'muezzin bildirim olusturamaz admin olusturabilir',
    run: async (env) => {
      const muezzinDb = testUser(env, 'muezzin1').firestore();
      const adminDb = testUser(env, 'admin').firestore();
      const payload = {
        haftaId: 'W2026-05-18',
        tarih: '2026-05-22',
        vakit: 'yatsi',
        uid: 'muezzin1',
        tip: 'asil',
        durum: 'bekliyor',
        pendingAck: true,
        retSebebi: null,
        olusturmaTarihi: Timestamp.now(),
        sonGuncelleme: Timestamp.now()
      };

      await assertFails(setDoc(doc(muezzinDb, 'bildirimler/maliciousCreate'), payload));
      await assertSucceeds(setDoc(doc(adminDb, 'bildirimler/adminCreate'), payload));
    }
  },
  {
    name: 'admin kendisine nobet bildirimi olusturamaz',
    run: async (env) => {
      const db = testUser(env, 'admin').firestore();

      await assertFails(setDoc(doc(db, 'bildirimler/adminDutyCreate'), {
        haftaId: 'W2026-05-18',
        tarih: '2026-05-22',
        vakit: 'yatsi',
        uid: 'admin',
        tip: 'asil',
        durum: 'bekliyor',
        pendingAck: true,
        retSebebi: null,
        olusturmaTarihi: Timestamp.now(),
        sonGuncelleme: Timestamp.now()
      }));
    }
  },
  {
    name: 'admin mevcut nobeti admin kullanicisina devredemez',
    run: async (env) => {
      const db = testUser(env, 'admin').firestore();

      await assertFails(updateDoc(doc(db, 'bildirimler/ownPendingAsil'), {
        uid: 'admin',
        sonGuncelleme: Timestamp.now()
      }));
    }
  },
  {
    name: 'admin kendi adina eski nobet bildirimini onaylayamaz',
    run: async (env) => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'bildirimler/legacyAdminDuty'), {
          haftaId: 'W2026-05-18',
          tarih: '2026-05-22',
          vakit: 'sabah',
          uid: 'admin',
          tip: 'asil',
          durum: 'bekliyor',
          pendingAck: true,
          retSebebi: null,
          olusturmaTarihi: Timestamp.now(),
          sonGuncelleme: Timestamp.now()
        });
      });

      const db = testUser(env, 'admin').firestore();
      await assertFails(updateDoc(doc(db, 'bildirimler/legacyAdminDuty'), {
        durum: 'onaylandi',
        pendingAck: false,
        sonGuncelleme: Timestamp.now()
      }));
    }
  },
  {
    name: 'muezzin kendi bekleyen gorevini onaylayabilir',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertSucceeds(updateDoc(doc(db, 'bildirimler/ownPendingAsil'), {
        durum: 'onaylandi',
        pendingAck: false,
        sonGuncelleme: Timestamp.now()
      }));
    }
  },
  {
    name: 'muezzin baskasinin gorevini onaylayamaz',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertFails(updateDoc(doc(db, 'bildirimler/otherPendingAsil'), {
        durum: 'onaylandi',
        pendingAck: false,
        sonGuncelleme: Timestamp.now()
      }));
    }
  },
  {
    name: 'muezzin kendi asil gorevine mazeret yazabilir',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      // retSebebi artik bildirimler'e degil, ayni batch'teki
      // mazeret_detaylari'na yaziliyor (bkz. mazeretRetBatch, mimari
      // denetim — altinci tur).
      await assertSucceeds(mazeretRetBatch(db, 'ownPendingAsil', 'muezzin1', 'Hastalik', { devirSonucu: 'alarm_bekliyor' }));
    }
  },
  {
    // `ownPendingAsil` kasitli olarak cumaMi alani OLMADAN olusturuldu (bkz.
    // yukaridaki setup) — bu, alan eklenmeden once yazilmis GERCEK belgeleri
    // temsil eder. `existing().cumaMi != true` (guard'siz) rules engine'de
    // eksik anahtara erisim hatasi firlatiyor ve bu, mazeret/vekalet
    // gecislerini ALAN EKSIK olan HER belgede kalici olarak reddediyordu —
    // "eksikse Cuma degil say" (fail-open) niyetinin tam tersi. Bu test bir
    // ustteki testle ayni senaryoyu kapsiyor ama niyeti acikca isimlendiriyor
    // ki regresyon sessizce geri gelmesin (bkz. firestore.rules
    // `cumaMiIsaretli`).
    name: 'cumaMi alani hic olmayan (backfill oncesi) bir bildirimde mazeret reddi calisir',
    run: async (env) => {
      // otherPendingAsil, ownPendingAsil'den bagimsiz ikinci bir cumaMi'siz
      // belge — sahibi muezzin2.
      const db = testUser(env, 'muezzin2').firestore();
      await assertSucceeds(mazeretRetBatch(db, 'otherPendingAsil', 'muezzin2', 'Hastalik', { devirSonucu: 'alarm_bekliyor' }));
    }
  },
  {
    name: 'muezzin cuma gorevine mazeret bildiremez',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      // Eslesen mazeret_detaylari yazimi DAHIL edildi ki test yalnizca
      // Cuma kisitlamasini izole etsin (baska bir nedenle degil).
      await assertFails(mazeretRetBatch(db, 'fridayPendingAsil', 'muezzin1', 'Hastalik', { devirSonucu: 'alarm_bekliyor' }));
    }
  },
  {
    name: 'muezzin cuma gorevini yine de okudum olarak onaylayabilir',
    run: async (env) => {
      // Cuma kisitlamasi yalnizca mazeret (reddedildi) geciscine uygulanir —
      // gorevi ustlenme (okudum/onaylandi) onayi hala serbesttir.
      const db = testUser(env, 'muezzin1').firestore();
      await assertSucceeds(updateDoc(doc(db, 'bildirimler/fridayPendingAsil'), {
        durum: 'onaylandi',
        pendingAck: false,
        sonGuncelleme: Timestamp.now()
      }));
    }
  },
  {
    name: 'yedek gorev mazeret reddine ceviremez',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      // devirSonucu eksik (asil dalindaki gibi eski/eksik bir istemci yuku
      // taklit ediyor) — bkz. asagidaki "devirSonucu ile" testi, dogru
      // sekilde bicimlendirilmis bir yedek mazereti bunun aksine basarili olur.
      await assertFails(mazeretRetBatch(db, 'ownPendingYedek', 'muezzin1', 'Uygun degilim', {}));
    }
  },
  {
    name: 'yedek gorevli kendi mazeretini (devirSonucu ile) bildirebilir',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertSucceeds(mazeretRetBatch(db, 'ownPendingYedek', 'muezzin1', 'Uygun degilim', { devirSonucu: 'alarm_bekliyor' }));
    }
  },
  {
    name: 'yedek gorevli Cuma gorevi icin mazeret bildiremez',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertFails(mazeretRetBatch(db, 'fridayPendingYedek', 'muezzin1', 'Uygun degilim', { devirSonucu: 'alarm_bekliyor' }));
    }
  },
  {
    name: 'muezzin bildirim kimlik alanlarini degistiremez',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertFails(updateDoc(doc(db, 'bildirimler/ownPendingAsil'), {
        uid: 'muezzin2',
        durum: 'onaylandi',
        pendingAck: false,
        sonGuncelleme: Timestamp.now()
      }));
    }
  },
  {
    name: 'izin talebinde kullanici sadece kendisi adina kayit acabilir',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      // 2026-05-18 Pazartesi, 2026-05-19 Sali — Cuma icermeyen bir aralik.
      const base = {
        baslangic: '2026-05-18',
        bitis: '2026-05-19',
        tip: 'mazeret',
        durum: 'onay_bekliyor',
        sebep: 'Aile',
        olusturmaTarihi: Timestamp.now()
      };

      await assertSucceeds(setDoc(doc(db, 'izinler/ownLeave'), {
        ...base,
        uid: 'muezzin1'
      }));
      await assertFails(setDoc(doc(db, 'izinler/otherLeave'), {
        ...base,
        uid: 'muezzin2'
      }));
    }
  },
  {
    name: 'izin talebi Cuma iceren bir araligi sunucu tarafinda reddeder',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      const base = {
        uid: 'muezzin1',
        tip: 'mazeret',
        durum: 'onay_bekliyor',
        sebep: 'Aile',
        olusturmaTarihi: Timestamp.now()
      };

      // 2026-05-22 tek basina bir Cuma.
      await assertFails(setDoc(doc(db, 'izinler/tekGunCuma'), {
        ...base,
        baslangic: '2026-05-22',
        bitis: '2026-05-22'
      }));
      // 2026-05-18 (Pzt) - 2026-05-24 (Paz) araligi 2026-05-22 Cuma'yi kapsiyor.
      await assertFails(setDoc(doc(db, 'izinler/araligaCumaGiriyor'), {
        ...base,
        baslangic: '2026-05-18',
        bitis: '2026-05-24'
      }));
      // 7+ gunluk her aralik istatistiksel olarak bir Cuma icerir.
      await assertFails(setDoc(doc(db, 'izinler/haftalikArayaCumaGirer'), {
        ...base,
        baslangic: '2026-05-19',
        bitis: '2026-05-26'
      }));
      // Cuma icermeyen kisa bir araligin gecmesi gerekir (regresyon kontrolu).
      await assertSucceeds(setDoc(doc(db, 'izinler/cumasizAralik'), {
        ...base,
        baslangic: '2026-05-18',
        bitis: '2026-05-21'
      }));
      // Ters cevrilmis aralik (bitis < baslangic) reddedilmeli.
      await assertFails(setDoc(doc(db, 'izinler/tersAralik'), {
        ...base,
        baslangic: '2026-05-25',
        bitis: '2026-05-20'
      }));
    }
  },
  {
    // Altinci denetim turu, form dogrulama bulgulari: isValidIzin'in `sebep`
    // alani hasOnly'de listeleniyordu ama hic tip/uzunluk dogrulamasi
    // yapmiyordu — dosyadaki HER diger serbest metin alaniyla (baslik,
    // icerik, retSebebi, yazar) tutarsizdi.
    name: 'izin sebebi 1000 karakteri asarsa veya string degilse reddedilir',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      const base = {
        uid: 'muezzin1',
        baslangic: '2026-05-18',
        bitis: '2026-05-19',
        tip: 'mazeret',
        durum: 'onay_bekliyor',
        olusturmaTarihi: Timestamp.now()
      };

      await assertFails(setDoc(doc(db, 'izinler/sebepCokUzun'), {
        ...base,
        sebep: 'a'.repeat(1001)
      }));
      await assertFails(setDoc(doc(db, 'izinler/sebepStringDegil'), {
        ...base,
        sebep: 12345
      }));
      // Tam sinirda (1000 karakter) ve sebep hic olmadan da gecmeli
      // (regresyon kontrolu).
      await assertSucceeds(setDoc(doc(db, 'izinler/sebepTamSinirda'), {
        ...base,
        sebep: 'a'.repeat(1000)
      }));
      await assertSucceeds(setDoc(doc(db, 'izinler/sebepsiz'), base));
    }
  },
  {
    // Ucuncu denetim turu bulgusu: veriOnarimServisi.ts'in "Veri Sagligi"
    // onarim akisi ters-tarihli bir izin kaydini admin olarak duzeltmek icin
    // SADECE baslangic/bitis yaziyor (durum/redSebebi'ye dokunmuyor) — bu
    // onceden izinler update kuralinin admin disjunct'inin (hasOnly yalnizca
    // durum/redSebebi) disinda kaliyordu, her zaman PERMISSION_DENIED
    // aliyordu.
    name: 'admin ters-tarihli bir izin kaydini baslangic/bitis yazarak onarabilir (veriOnarimServisi regresyonu)',
    run: async (env) => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        // 2026-05-18 (Pzt) - 2026-05-19 (Sal), Cuma icermeyen bir aralik —
        // ama ters kaydedilmis: baslangic=19, bitis=18.
        await setDoc(doc(db, 'izinler/tersTarihliKayit'), {
          uid: 'muezzin1',
          baslangic: '2026-05-19',
          bitis: '2026-05-18',
          tip: 'mazeret',
          durum: 'onaylandi',
          sebep: 'Aile',
          olusturmaTarihi: Timestamp.now()
        });
      });

      const db = testUser(env, 'admin').firestore();
      const ref = doc(db, 'izinler/tersTarihliKayit');

      // veriOnarimServisi.ts'in gercek onarim yazimi: iki tarihi yer
      // degistirir, baska hicbir alana dokunmaz.
      await assertSucceeds(updateDoc(ref, { baslangic: '2026-05-18', bitis: '2026-05-19' }));
    }
  },
  {
    // Onarim yolu sonsuz esneklige acilmamali — duzeltilmis aralik da
    // isValidIzinTarihAraligi'nin sekil/is-kurallarina (ters aralik, Cuma
    // icerme) tabi olmali.
    name: 'admin izin onarimi gecersiz bir tarih araligina yazilamaz',
    run: async (env) => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'izinler/gecersizOnarimDenemesi'), {
          uid: 'muezzin1',
          baslangic: '2026-05-19',
          bitis: '2026-05-18',
          tip: 'mazeret',
          durum: 'onaylandi',
          sebep: 'Aile',
          olusturmaTarihi: Timestamp.now()
        });
      });

      const db = testUser(env, 'admin').firestore();
      const ref = doc(db, 'izinler/gecersizOnarimDenemesi');

      // Duzeltme sonrasi da hala ters aralik (bitis < baslangic) — reddedilmeli.
      await assertFails(updateDoc(ref, { baslangic: '2026-05-20', bitis: '2026-05-15' }));
    }
  },
  {
    // Admin izin onarim yolu yalnizca durum/redSebebi/baslangic/bitis
    // yazabilmeli — uid gibi kimlik alanlarina sizmamali.
    name: 'admin izin onarimi kimlik alanlarini (uid) degistiremez',
    run: async (env) => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'izinler/kimlikDenemesi'), {
          uid: 'muezzin1',
          baslangic: '2026-05-18',
          bitis: '2026-05-19',
          tip: 'mazeret',
          durum: 'onaylandi',
          sebep: 'Aile',
          olusturmaTarihi: Timestamp.now()
        });
      });

      const db = testUser(env, 'admin').firestore();
      const ref = doc(db, 'izinler/kimlikDenemesi');

      await assertFails(updateDoc(ref, { uid: 'muezzin2' }));
    }
  },
  {
    // isValidIzin artik hasOnly ile sinirli — sema disi ekstra bir alan
    // (ornegin sinirsiz uzunlukta rastgele bir alan) create'te reddedilmeli.
    name: 'izin talebi sema disi ekstra alan icermemeli (isValidIzin hasOnly)',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertFails(setDoc(doc(db, 'izinler/ekstraAlanli'), {
        uid: 'muezzin1',
        baslangic: '2026-05-18',
        bitis: '2026-05-19',
        tip: 'mazeret',
        durum: 'onay_bekliyor',
        sebep: 'Aile',
        olusturmaTarihi: Timestamp.now(),
        yetkisizAlan: 'sizma denemesi'
      }));
    }
  },
  {
    name: 'admin duyuru yazabilir ve silebilir',
    run: async (env) => {
      const db = testUser(env, 'admin').firestore();
      const ref = doc(db, 'duyurular/adminNotice');

      // Gercek servis (duyuruServisi.ts duyuruYayinla) her zaman 'tip'
      // gonderiyor — isValidDuyuru eklenmeden once bu alan sema disi
      // kaldigindan bu test fixture'i eksikti (bkz. asagidaki yeni testler).
      await assertSucceeds(setDoc(ref, {
        baslik: 'Admin',
        icerik: 'Metin',
        tip: 'duyuru',
        tarih: Timestamp.now()
      }));
      await assertSucceeds(deleteDoc(ref));
    }
  },
  {
    // Ucuncu denetim turu bulgusu: duyurular hic sema dogrulamasi
    // yapmiyordu (diger tum yazilabilir varliklarin aksine) — yetki acigi
    // degildi (yalnizca admin yazabiliyor) ama tutarsizlikti.
    name: 'admin duyurusuna sema disi ekstra alan ekleyemez (isValidDuyuru hasOnly)',
    run: async (env) => {
      const db = testUser(env, 'admin').firestore();
      await assertFails(setDoc(doc(db, 'duyurular/extraFieldNotice'), {
        baslik: 'Admin',
        icerik: 'Metin',
        tip: 'duyuru',
        tarih: Timestamp.now(),
        yetkisizAlan: 'sizma denemesi'
      }));
    }
  },
  {
    name: 'admin duyurusu gecersiz tip degeriyle olusturulamaz',
    run: async (env) => {
      const db = testUser(env, 'admin').firestore();
      await assertFails(setDoc(doc(db, 'duyurular/invalidTipNotice'), {
        baslik: 'Admin',
        icerik: 'Metin',
        tip: 'gecersiz_kategori',
        tarih: Timestamp.now()
      }));
    }
  },
  {
    name: 'admin muezzin profilini sema icinde guncelleyebilir',
    run: async (env) => {
      const db = testUser(env, 'admin').firestore();

      await assertSucceeds(updateDoc(doc(db, 'muezzins/muezzin1'), {
        aktif: false,
        onayBekliyor: false,
        arsivlendi: true,
        arsivTarihi: Timestamp.now()
      }));
    }
  },
  {
    name: 'admin muezzin profiline sema disi alan ekleyemez',
    run: async (env) => {
      const db = testUser(env, 'admin').firestore();

      await assertFails(updateDoc(doc(db, 'muezzins/muezzin1'), {
        internalDebugNote: 'Sema disi alan'
      }));
    }
  },
  {
    name: 'admin sistem ayarlarini sadece gecerli sema ile yazabilir',
    run: async (env) => {
      const db = testUser(env, 'admin').firestore();

      await assertSucceeds(setDoc(doc(db, 'settings/system'), {
        ilceId: '9148',
        ilceAdi: 'Ceyhan',
        hicriDuzeltme: 0
      }));

      await assertFails(setDoc(doc(db, 'settings/system'), {
        ilceId: '91',
        ilceAdi: '',
        hicriDuzeltme: 7
      }));
    }
  },
  {
    name: 'admin vakit onbellegini sadece gecerli sema ile yazabilir',
    run: async (env) => {
      const db = testUser(env, 'admin').firestore();

      await assertSucceeds(setDoc(doc(db, 'vakitler/9148_2026-05'), {
        ilceId: '9148',
        gunler: validVakitGunleri(),
        kaynakApi: 'diyanet',
        guncellenmeTarihi: Timestamp.now()
      }));

      await assertFails(setDoc(doc(db, 'vakitler/9148_2026-06'), {
        ilceId: '9148',
        gunler: {},
        kaynakApi: 'bilinmeyen',
        guncellenmeTarihi: Timestamp.now()
      }));
    }
  },
  {
    // aylikVakitleriGrupla, API'nin kayan penceresini gerçek takvim ayına göre
    // böldüğünden içinde bulunulan ay için kasıtlı olarak PARTIAL bir grup
    // üretir (ayın ortasında senkronize edilirse o ay yalnızca kalan günleri
    // içerir) — alt sınır bunu artık reddetmemeli (bkz. mantık denetimi).
    name: 'admin vakit onbellegine ayin kismi (partial) gununu de yazabilir',
    run: async (env) => {
      const db = testUser(env, 'admin').firestore();

      await assertSucceeds(setDoc(doc(db, 'vakitler/9148_2026-07'), {
        ilceId: '9148',
        gunler: {
          '2026-07-28': { sabah: '04:10', gunes: '05:42', ogle: '12:45', ikindi: '16:30', aksam: '19:51', yatsi: '21:18' },
          '2026-07-29': { sabah: '04:10', gunes: '05:42', ogle: '12:45', ikindi: '16:30', aksam: '19:51', yatsi: '21:18' },
          '2026-07-30': { sabah: '04:10', gunes: '05:42', ogle: '12:45', ikindi: '16:30', aksam: '19:51', yatsi: '21:18' }
        },
        kaynakApi: 'diyanet',
        guncellenmeTarihi: Timestamp.now()
      }));
    }
  },
  {
    name: 'giris yapan kullanici kendi denetim kaydini olusturabilir',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();

      await assertSucceeds(setDoc(doc(db, 'audit_logs/userAudit'), {
        actionType: 'Vekalet Kabul',
        targetName: '2026-05-22 ogle',
        details: 'Kullanici kendisine gelen vekalet talebini kabul etti.',
        userId: 'muezzin1',
        userDisplayName: 'Muezzin One',
        timestamp: Timestamp.now()
      }));
    }
  },
  {
    name: 'kullanici baskasi adina denetim kaydi olusturamaz',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();

      await assertFails(setDoc(doc(db, 'audit_logs/forgedAudit'), {
        actionType: 'Sahte Kayit',
        targetName: 'Admin',
        details: 'Baska kullanici adina audit yazma denemesi.',
        userId: 'admin',
        userDisplayName: 'Admin',
        timestamp: Timestamp.now()
      }));
    }
  },
  {
    name: 'denetim kayitlari sonradan degistirilemez ve sadece admin listeleyebilir',
    run: async (env) => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'audit_logs/existingAudit'), {
          actionType: 'Personel Daveti',
          targetName: 'valid@example.test',
          details: 'Davet olusturuldu.',
          userId: 'admin',
          userDisplayName: 'Admin',
          timestamp: Timestamp.now()
        });
      });

      const adminDb = testUser(env, 'admin').firestore();
      const muezzinDb = testUser(env, 'muezzin1').firestore();

      await assertSucceeds(getDocs(query(collection(adminDb, 'audit_logs'), orderBy('timestamp', 'desc'), limit(30))));
      await assertFails(getDocs(query(collection(muezzinDb, 'audit_logs'), orderBy('timestamp', 'desc'), limit(30))));
      await assertFails(updateDoc(doc(adminDb, 'audit_logs/existingAudit'), {
        details: 'Degistirildi.'
      }));
      await assertFails(deleteDoc(doc(adminDb, 'audit_logs/existingAudit')));
    }
  },
  {
    name: 'muezzin kendi bekleyen gorevi icin vekalet talebi acabilir',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertSucceeds(setDoc(doc(db, 'vekalet_talepleri/W2026-05-18_2026-05-22_ogle_asil_muezzin2'), {
        bildirimId: 'ownPendingAsil',
        haftaId: 'W2026-05-18',
        gonderenUid: 'muezzin1',
        gonderenIsim: 'Muezzin One',
        aliciUid: 'muezzin2',
        aliciIsim: 'Muezzin Two',
        tarih: '2026-05-22',
        vakit: 'ogle',
        saat: '12:45',
        tip: 'asil',
        durum: 'beklemede',
        olusturmaTarihi: Timestamp.now()
      }));
    }
  },
  {
    name: 'muezzin Cuma gorevi icin vekalet talebi acamaz',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertFails(setDoc(doc(db, 'vekalet_talepleri/W2026-05-18_2026-05-22_ogle_asil_muezzin2'), {
        bildirimId: 'fridayPendingAsil',
        haftaId: 'W2026-05-18',
        gonderenUid: 'muezzin1',
        gonderenIsim: 'Muezzin One',
        aliciUid: 'muezzin2',
        aliciIsim: 'Muezzin Two',
        tarih: '2026-05-22',
        vakit: 'ogle',
        saat: '12:45',
        tip: 'asil',
        durum: 'beklemede',
        olusturmaTarihi: Timestamp.now()
      }));
    }
  },
  {
    name: 'muezzin baskasinin gorevi icin vekalet talebi acamaz',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertFails(setDoc(doc(db, 'vekalet_talepleri/W2026-05-18_2026-05-22_ikindi_asil_muezzin1'), {
        bildirimId: 'otherPendingAsil',
        haftaId: 'W2026-05-18',
        gonderenUid: 'muezzin1',
        gonderenIsim: 'Muezzin One',
        aliciUid: 'muezzin1',
        aliciIsim: 'Muezzin One',
        tarih: '2026-05-22',
        vakit: 'ikindi',
        saat: '16:30',
        tip: 'asil',
        durum: 'beklemede',
        olusturmaTarihi: Timestamp.now()
      }));
    }
  },
  {
    name: 'vekalet alicisi talebi kabul edip bildirimi devralabilir',
    run: async (env) => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'vekalet_talepleri/W2026-05-18_2026-05-22_ogle_asil_muezzin2'), {
          bildirimId: 'ownPendingAsil',
          haftaId: 'W2026-05-18',
          gonderenUid: 'muezzin1',
          gonderenIsim: 'Muezzin One',
          aliciUid: 'muezzin2',
          aliciIsim: 'Muezzin Two',
          tarih: '2026-05-22',
          vakit: 'ogle',
          saat: '12:45',
          tip: 'asil',
          durum: 'beklemede',
          olusturmaTarihi: Timestamp.now()
        });
      });

      const db = testUser(env, 'muezzin2').firestore();
      await assertSucceeds(runTransaction(db, async (transaction) => {
        transaction.update(doc(db, 'vekalet_talepleri/W2026-05-18_2026-05-22_ogle_asil_muezzin2'), {
          durum: 'kabul_edildi',
          sonGuncelleme: Timestamp.now()
        });
        transaction.update(doc(db, 'bildirimler/ownPendingAsil'), {
          uid: 'muezzin2',
          vekaletDevredildi: true,
          sonGuncelleme: Timestamp.now()
        });
      }));
    }
  },
  {
    name: 'vekaletDevredildi isareti olmadan bildirim devralinamaz (K5 regresyonu)',
    run: async (env) => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'vekalet_talepleri/W2026-05-18_2026-05-22_ogle_asil_muezzin2'), {
          bildirimId: 'ownPendingAsil',
          haftaId: 'W2026-05-18',
          gonderenUid: 'muezzin1',
          gonderenIsim: 'Muezzin One',
          aliciUid: 'muezzin2',
          aliciIsim: 'Muezzin Two',
          tarih: '2026-05-22',
          vakit: 'ogle',
          saat: '12:45',
          tip: 'asil',
          durum: 'beklemede',
          olusturmaTarihi: Timestamp.now()
        });
      });

      const db = testUser(env, 'muezzin2').firestore();
      await assertFails(runTransaction(db, async (transaction) => {
        transaction.update(doc(db, 'vekalet_talepleri/W2026-05-18_2026-05-22_ogle_asil_muezzin2'), {
          durum: 'kabul_edildi',
          sonGuncelleme: Timestamp.now()
        });
        // vekaletDevredildi eksik — planServisi.ts'in bu slotu korumasi icin
        // gerekli isaret yok, kural bu geciste bunu zorunlu kilmali (bkz.
        // mimari denetim K5).
        transaction.update(doc(db, 'bildirimler/ownPendingAsil'), {
          uid: 'muezzin2',
          sonGuncelleme: Timestamp.now()
        });
      }));
    }
  },
  {
    name: 'arşivlenmiş alıcı, bekleyen vekalet teklifini kabul edemez (O9 regresyonu)',
    run: async (env) => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'muezzins/muezzin2'), {
          displayName: 'Muezzin Two',
          email: 'muezzin2@example.test',
          role: 'muezzin',
          aktif: false, // talep beklerken admin tarafından arşivlendi
          photoURL: '',
          fcmToken: null,
          aylikVakitSayisi: 0
        });
        await setDoc(doc(db, 'vekalet_talepleri/W2026-05-18_2026-05-22_ogle_asil_muezzin2'), {
          bildirimId: 'ownPendingAsil',
          haftaId: 'W2026-05-18',
          gonderenUid: 'muezzin1',
          gonderenIsim: 'Muezzin One',
          aliciUid: 'muezzin2',
          aliciIsim: 'Muezzin Two',
          tarih: '2026-05-22',
          vakit: 'ogle',
          saat: '12:45',
          tip: 'asil',
          durum: 'beklemede',
          olusturmaTarihi: Timestamp.now()
        });
      });

      const db = testUser(env, 'muezzin2').firestore();
      await assertFails(runTransaction(db, async (transaction) => {
        transaction.update(doc(db, 'vekalet_talepleri/W2026-05-18_2026-05-22_ogle_asil_muezzin2'), {
          durum: 'kabul_edildi',
          sonGuncelleme: Timestamp.now()
        });
        transaction.update(doc(db, 'bildirimler/ownPendingAsil'), {
          uid: 'muezzin2',
          vekaletDevredildi: true,
          sonGuncelleme: Timestamp.now()
        });
      }));
    }
  },
  {
    name: 'vekalet alicisi kendi bekleyen tekliflerini listeleyebilir',
    run: async (env) => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'vekalet_talepleri/W2026-05-18_2026-05-22_ogle_asil_muezzin2'), {
          bildirimId: 'ownPendingAsil',
          haftaId: 'W2026-05-18',
          gonderenUid: 'muezzin1',
          gonderenIsim: 'Muezzin One',
          aliciUid: 'muezzin2',
          aliciIsim: 'Muezzin Two',
          tarih: '2026-05-22',
          vakit: 'ogle',
          saat: '12:45',
          tip: 'asil',
          durum: 'beklemede',
          olusturmaTarihi: Timestamp.now()
        });
      });

      const db = testUser(env, 'muezzin2').firestore();
      await assertSucceeds(getDocs(query(
        collection(db, 'vekalet_talepleri'),
        where('aliciUid', '==', 'muezzin2'),
        where('durum', '==', 'beklemede')
      )));
    }
  },
  {
    name: 'muezzin tum vekalet taleplerini listeleyemez',
    run: async (env) => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'vekalet_talepleri/W2026-05-18_2026-05-22_ogle_asil_muezzin2'), {
          bildirimId: 'ownPendingAsil',
          haftaId: 'W2026-05-18',
          gonderenUid: 'muezzin1',
          gonderenIsim: 'Muezzin One',
          aliciUid: 'muezzin2',
          aliciIsim: 'Muezzin Two',
          tarih: '2026-05-22',
          vakit: 'ogle',
          saat: '12:45',
          tip: 'asil',
          durum: 'beklemede',
          olusturmaTarihi: Timestamp.now()
        });
      });

      const db = testUser(env, 'muezzin1').firestore();
      await assertFails(getDocs(collection(db, 'vekalet_talepleri')));
    }
  },
  {
    name: 'vekalet alicisi kabul etmeden bildirimi devralamaz',
    run: async (env) => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'vekalet_talepleri/W2026-05-18_2026-05-22_ogle_asil_muezzin2'), {
          bildirimId: 'ownPendingAsil',
          haftaId: 'W2026-05-18',
          gonderenUid: 'muezzin1',
          gonderenIsim: 'Muezzin One',
          aliciUid: 'muezzin2',
          aliciIsim: 'Muezzin Two',
          tarih: '2026-05-22',
          vakit: 'ogle',
          saat: '12:45',
          tip: 'asil',
          durum: 'beklemede',
          olusturmaTarihi: Timestamp.now()
        });
      });

      const db = testUser(env, 'muezzin2').firestore();
      await assertFails(updateDoc(doc(db, 'bildirimler/ownPendingAsil'), {
        uid: 'muezzin2',
        sonGuncelleme: Timestamp.now()
      }));
    }
  },
  {
    name: 'K1: okudum transaction\'i (yalnizca bildirim guncellemesi) basarili olur',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      const ref = doc(db, 'bildirimler/ownPendingAsil');
      await assertSucceeds(runTransaction(db, async (transaction) => {
        await transaction.get(ref);
        transaction.update(ref, { durum: 'onaylandi', pendingAck: false, sonGuncelleme: Timestamp.now() });
      }));
    }
  },
  {
    name: 'K1 regresyon guardi: okudum transaction\'ina muezzins puan yazimi eklenirse tum transaction reddedilir',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      const bildirimRef = doc(db, 'bildirimler/ownPendingAsil');
      const muezzinRef = doc(db, 'muezzins/muezzin1');
      await assertFails(runTransaction(db, async (transaction) => {
        await transaction.get(bildirimRef);
        transaction.update(bildirimRef, { durum: 'onaylandi', pendingAck: false, sonGuncelleme: Timestamp.now() });
        transaction.update(muezzinRef, { aylikVakitSayisi: 1 });
      }));
    }
  },
  {
    name: 'K2: mazeret bildirimi uygun yedegi ayni transaction icinde asil rolune terfi ettirir',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      const asilRef = doc(db, 'bildirimler/W2026-06-01_2026-06-03_yatsi_asil');
      const yedekRef = doc(db, 'bildirimler/W2026-06-01_2026-06-03_yatsi_yedek');

      await assertSucceeds(runTransaction(db, async (transaction) => {
        await transaction.get(asilRef);
        await transaction.get(yedekRef);
        transaction.update(asilRef, {
          durum: 'reddedildi',
          pendingAck: false,
          devirSonucu: 'yedek_atandi',
          sonGuncelleme: Timestamp.now()
        });
        // retSebebi artik bildirimler'e degil, ayni transaction'daki
        // mazeret_detaylari'na yaziliyor (bkz. mazeretRetBatch yorumu).
        transaction.set(doc(db, 'mazeret_detaylari/W2026-06-01_2026-06-03_yatsi_asil'), {
          uid: 'muezzin1',
          retSebebi: 'Hastalik',
          olusturmaTarihi: Timestamp.now()
        });
        transaction.update(yedekRef, {
          tip: 'asil',
          durum: 'bekliyor',
          pendingAck: true,
          asilMazeretUid: 'muezzin1',
          sonGuncelleme: Timestamp.now()
        });
      }));
    }
  },
  {
    name: 'K2: yedegi olmayan/uygun olmayan mazeret sadece alarm_bekliyor ile reddedilebilir',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertSucceeds(mazeretRetBatch(db, 'ownPendingAsil', 'muezzin1', 'Hastalik', { devirSonucu: 'alarm_bekliyor' }));
    }
  },
  {
    name: 'K2 guvenlik: asil belge ayni transaction icinde reddedilmeden yedek terfi edilemez',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      const yedekRef = doc(db, 'bildirimler/W2026-06-01_2026-06-03_yatsi_yedek');
      await assertFails(runTransaction(db, async (transaction) => {
        await transaction.get(yedekRef);
        transaction.update(yedekRef, {
          tip: 'asil',
          durum: 'bekliyor',
          pendingAck: true,
          asilMazeretUid: 'muezzin1',
          sonGuncelleme: Timestamp.now()
        });
      }));
    }
  },
  {
    name: 'K2 guvenlik: baskasinin gorevi icin mazeret/terfi transaction\'i baslatilamaz',
    run: async (env) => {
      const db = testUser(env, 'muezzin2').firestore();
      const asilRef = doc(db, 'bildirimler/W2026-06-01_2026-06-03_yatsi_asil');
      const yedekRef = doc(db, 'bildirimler/W2026-06-01_2026-06-03_yatsi_yedek');
      await assertFails(runTransaction(db, async (transaction) => {
        await transaction.get(asilRef);
        await transaction.get(yedekRef);
        transaction.update(asilRef, {
          durum: 'reddedildi',
          pendingAck: false,
          devirSonucu: 'yedek_atandi',
          sonGuncelleme: Timestamp.now()
        });
        transaction.set(doc(db, 'mazeret_detaylari/W2026-06-01_2026-06-03_yatsi_asil'), {
          uid: 'muezzin2',
          retSebebi: 'Sahte',
          olusturmaTarihi: Timestamp.now()
        });
        transaction.update(yedekRef, {
          tip: 'asil',
          durum: 'bekliyor',
          pendingAck: true,
          asilMazeretUid: 'muezzin2',
          sonGuncelleme: Timestamp.now()
        });
      }));
    }
  },
  {
    // Ucuncu denetim turu bulgusu: 'yedek_atandi' TEK basina (yedegin
    // gercekten terfi ettigine dair eslesen bir yazim olmadan) kabul
    // ediliyordu. Yedek belge dokunulmamis (hala tip:'yedek') halde birakilip
    // yalniz asil belge guncellenirse artik reddedilmeli. Eslesen
    // mazeret_detaylari yazimi DAHIL edildi ki test yalnizca yedek terfisi
    // eksikligini izole etsin.
    name: 'K2 guvenlik: devirSonucu=yedek_atandi, yedek GERCEKTEN terfi etmeden tek basina yazilamaz',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertFails(mazeretRetBatch(db, 'W2026-06-01_2026-06-03_yatsi_asil', 'muezzin1', 'Sahte terfi denemesi', { devirSonucu: 'yedek_atandi' }));
    }
  },
  {
    // Yedek belge de AYNI transaction'da gercekten 'asil'e terfi ederse
    // (mazeretServisi.ts'in gercek davranisi) kabul edilmeye devam etmeli —
    // yukaridaki testin bir regresyona yol acmadigini dogrular (bu senaryo
    // zaten 'K2: mazeret bildirimi uygun yedegi ayni transaction icinde asil
    // rolune terfi ettirir' testinde de kapsanıyor, burada devirSonucu
    // korelasyon kontrolunun POZITIF yolu ayrica adlandirilarak dogrulanir).
    name: 'K2 guvenlik: devirSonucu=yedek_atandi, yedek ayni committe gercekten terfi ederse kabul edilir',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      const asilRef = doc(db, 'bildirimler/W2026-06-01_2026-06-03_yatsi_asil');
      const yedekRef = doc(db, 'bildirimler/W2026-06-01_2026-06-03_yatsi_yedek');
      await assertSucceeds(runTransaction(db, async (transaction) => {
        await transaction.get(asilRef);
        await transaction.get(yedekRef);
        transaction.update(asilRef, {
          durum: 'reddedildi',
          pendingAck: false,
          devirSonucu: 'yedek_atandi',
          sonGuncelleme: Timestamp.now()
        });
        transaction.set(doc(db, 'mazeret_detaylari/W2026-06-01_2026-06-03_yatsi_asil'), {
          uid: 'muezzin1',
          retSebebi: 'Hastalik',
          olusturmaTarihi: Timestamp.now()
        });
        transaction.update(yedekRef, {
          tip: 'asil',
          durum: 'bekliyor',
          pendingAck: true,
          asilMazeretUid: 'muezzin1',
          sonGuncelleme: Timestamp.now()
        });
      }));
    }
  },
  {
    name: 'K6: gecerli semali error_log olusturulabilir',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertSucceeds(setDoc(doc(db, 'error_logs/validLog'), {
        errorMessage: 'Test hatasi',
        errorStack: 'Error: Test hatasi\n  at test.ts:1:1',
        componentStack: '',
        userId: 'muezzin1',
        device: { os: 'Test', browser: 'Test', screenSize: '1x1', pwaMode: false, language: 'tr' },
        breadcrumbs: [],
        stateSnapshot: { authUid: 'muezzin1' },
        timestamp: Timestamp.now()
      }));
    }
  },
  {
    name: 'K6: asiri buyuk error_log reddedilir',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertFails(setDoc(doc(db, 'error_logs/tooBig'), {
        errorMessage: 'x'.repeat(3000),
        errorStack: '',
        componentStack: '',
        userId: 'muezzin1',
        device: {},
        breadcrumbs: [],
        stateSnapshot: {},
        timestamp: Timestamp.now()
      }));
    }
  },
  {
    name: 'K6: baskasi adina error_log olusturulamaz',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertFails(setDoc(doc(db, 'error_logs/forged'), {
        errorMessage: 'Test',
        errorStack: '',
        componentStack: '',
        userId: 'muezzin2',
        device: {},
        breadcrumbs: [],
        stateSnapshot: {},
        timestamp: Timestamp.now()
      }));
    }
  },
  {
    name: 'K6: gecerli semali telemetry_log olusturulabilir',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertSucceeds(setDoc(doc(db, 'telemetry_logs/validEvent'), {
        eventType: 'page_view',
        eventName: '/profil',
        userId: 'muezzin1',
        metadata: { device: { os: 'Test' } },
        timestamp: Timestamp.now()
      }));
    }
  },
  {
    name: 'K6: gecersiz eventType ile telemetry_log olusturulamaz',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertFails(setDoc(doc(db, 'telemetry_logs/invalidType'), {
        eventType: 'gecersiz_tip',
        eventName: '/profil',
        userId: 'muezzin1',
        metadata: {},
        timestamp: Timestamp.now()
      }));
    }
  },
  {
    name: 'K2: devirSonucu sema disi bir deger olamaz',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      // Eslesen mazeret_detaylari yazimi DAHIL edildi ki test yalnizca
      // gecersiz devirSonucu degerini izole etsin.
      await assertFails(mazeretRetBatch(db, 'ownPendingAsil', 'muezzin1', 'Hastalik', { devirSonucu: 'gecersiz_deger' }));
    }
  },
  {
    // Altinci denetim turu bulgusu (regresyon kaniti): eslesen bir
    // mazeret_detaylari yazimi olmadan salt bildirimler guncellemesi artik
    // basarisiz olmali — retSebebi'nin dogrudan bildirimler'e yazilabildigi
    // ESKI davranisin geri gelmedigini dogrular.
    name: 'mazeret_detaylari eslesen kaydi olmadan asil mazeret reddi basarisiz olur',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertFails(updateDoc(doc(db, 'bildirimler/ownPendingAsil'), {
        durum: 'reddedildi',
        pendingAck: false,
        devirSonucu: 'alarm_bekliyor',
        sonGuncelleme: Timestamp.now()
      }));
    }
  },
  {
    // Altinci denetim turu bulgusu (asil guvenlik acigi regresyon kaniti):
    // retSebebi tasindiktan sonra ayri koleksiyon yalnizca ilgili kisi veya
    // admin tarafindan okunabilmeli — herhangi bir baska giris yapmis
    // kullanici OKUYAMAMALI (onceden bildirimler uzerinden herkese acikti).
    name: 'mazeret_detaylari yalnizca ilgili kisi veya admin tarafindan okunabilir',
    run: async (env) => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'mazeret_detaylari/ozelMazeretKaydi'), {
          uid: 'muezzin1',
          retSebebi: 'Cok ozel bir saglik durumu',
          olusturmaTarihi: Timestamp.now()
        });
      });

      const digerKullanici = testUser(env, 'muezzin2').firestore();
      await assertFails(getDoc(doc(digerKullanici, 'mazeret_detaylari/ozelMazeretKaydi')));

      const sahibi = testUser(env, 'muezzin1').firestore();
      await assertSucceeds(getDoc(doc(sahibi, 'mazeret_detaylari/ozelMazeretKaydi')));

      const adminDb = testUser(env, 'admin').firestore();
      await assertSucceeds(getDoc(doc(adminDb, 'mazeret_detaylari/ozelMazeretKaydi')));
    }
  },
  {
    name: 'mazeret_detaylari yalnizca admin tarafindan listelenebilir',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertFails(getDocs(collection(db, 'mazeret_detaylari')));

      const adminDb = testUser(env, 'admin').firestore();
      await assertSucceeds(getDocs(collection(adminDb, 'mazeret_detaylari')));
    }
  },
  {
    name: 'config/bootstrap listesindeki e-posta ile admin yetkisi kazanilir',
    run: async (env) => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'config/bootstrap'), {
          superAdminEmails: ['superadmin@example.test']
        });
      });

      const db = testUser(env, 'superadmin').firestore();
      // isValidDuyuru eklendikten sonra gecerli sema gonderilmeli — bu
      // testin amaci yetki (bootstrap admin), sema degil.
      await assertSucceeds(setDoc(doc(db, 'duyurular/bootstrapNotice'), {
        baslik: 'Test',
        icerik: 'Bootstrap admin testi',
        tip: 'duyuru',
        tarih: Timestamp.now()
      }));
    }
  },
  {
    name: 'config/bootstrap listesinde olmayan e-posta admin yetkisi kazanamaz',
    run: async (env) => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'config/bootstrap'), {
          superAdminEmails: ['superadmin@example.test']
        });
      });

      const db = testUser(env, 'digerkullanici').firestore();
      // Sema gecerli olsa bile (isValidDuyuru) yetki eksikliginden
      // reddedilmeli — bu testin amaci tam olarak bu.
      await assertFails(setDoc(doc(db, 'duyurular/unauthorizedNotice'), {
        baslik: 'Test',
        icerik: 'Yetkisiz deneme',
        tip: 'duyuru',
        tarih: Timestamp.now()
      }));
    }
  },
  {
    name: 'siradan admin config/bootstrap yazamaz (K2 regresyonu)',
    run: async (env) => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'config/bootstrap'), {
          superAdminEmails: ['gercekSuperAdmin@example.test']
        });
        await setDoc(doc(db, 'muezzins/siradanAdmin'), {
          displayName: 'Siradan Admin',
          aktif: true,
          role: 'admin',
          email: 'siradanadmin@example.test'
        });
      });

      const db = testUser(env, 'siradanAdmin').firestore();
      await assertFails(setDoc(doc(db, 'config/bootstrap'), {
        superAdminEmails: ['siradanadmin@example.test']
      }));
    }
  },
  {
    // Yıllık izin onayı, izinler.durum ve muezzins.yillikIzinKullanilanGun'u
    // AYNI transaction'da atomik günceller (bkz. useAdminIzinlerStore.ts
    // izinGuncelle). Kota dahilindeyse (20 + 5 gün = 25 <= 30) her iki yazım
    // da başarılı olmalı.
    name: 'yillik izin onayi kota dahilindeyse muezzins sayacini da atomik gunceller',
    run: async (env) => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'muezzins/muezzin1'), { yillikIzinKullanilanGun: 20 }, { merge: true });
        await setDoc(doc(db, 'izinler/yillikTalebi1'), {
          uid: 'muezzin1',
          baslangic: '2026-08-10',
          bitis: '2026-08-14', // 5 gün (dahil)
          tip: 'yillik',
          durum: 'onay_bekliyor',
          sebep: 'Test',
          olusturmaTarihi: Timestamp.now()
        });
      });

      const db = testUser(env, 'admin').firestore();
      await assertSucceeds(runTransaction(db, async (transaction) => {
        transaction.update(doc(db, 'izinler/yillikTalebi1'), { durum: 'onaylandi' });
        transaction.update(doc(db, 'muezzins/muezzin1'), { yillikIzinKullanilanGun: 25 });
      }));
    }
  },
  {
    // Kotayı aşan bir onay (28 + 5 gün = 33 > 30) SUNUCU tarafında
    // tamamen reddedilmeli — admin override'ı yok (kullanıcı kararı).
    // isValidMuezzin'deki <=30 sert sınırı muezzins yazımını reddeder,
    // bu da TÜM transaction'ı (izinler.durum dahil) başarısız kılar.
    name: 'yillik izin onayi kotayi asiyorsa sunucu tarafinda tamamen reddedilir',
    run: async (env) => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'muezzins/muezzin2'), { yillikIzinKullanilanGun: 28 }, { merge: true });
        await setDoc(doc(db, 'izinler/yillikTalebi2'), {
          uid: 'muezzin2',
          baslangic: '2026-09-01',
          bitis: '2026-09-05', // 5 gün (dahil)
          tip: 'yillik',
          durum: 'onay_bekliyor',
          sebep: 'Test',
          olusturmaTarihi: Timestamp.now()
        });
      });

      const db = testUser(env, 'admin').firestore();
      await assertFails(runTransaction(db, async (transaction) => {
        transaction.update(doc(db, 'izinler/yillikTalebi2'), { durum: 'onaylandi' });
        transaction.update(doc(db, 'muezzins/muezzin2'), { yillikIzinKullanilanGun: 33 });
      }));
    }
  }
];

async function main() {
  const env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync('firestore.rules', 'utf8')
    }
  });

  try {
    for (const test of tests) {
      await env.clearFirestore();
      await seedBaseData(env);
      await test.run(env);
      console.log(`OK ${test.name}`);
    }

    assert.equal(tests.length > 0, true);
    console.log(`${tests.length} firestore rules test passed`);
  } finally {
    await env.cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
