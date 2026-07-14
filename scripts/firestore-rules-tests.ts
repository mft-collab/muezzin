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
  where
} from 'firebase/firestore';

const projectId = 'demo-muezzin-rules';

type TestCase = {
  name: string;
  run: (env: RulesTestEnvironment) => Promise<void>;
};

const testUser = (env: RulesTestEnvironment, uid: string, role?: string): RulesTestContext => {
  return env.authenticatedContext(uid, {
    email: `${uid}@example.test`,
    role
  });
};

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
        aylikVakitSayisi: 0
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
      await assertSucceeds(updateDoc(doc(db, 'bildirimler/ownPendingAsil'), {
        durum: 'reddedildi',
        pendingAck: false,
        retSebebi: 'Hastalik',
        devirSonucu: 'alarm_bekliyor',
        sonGuncelleme: Timestamp.now()
      }));
    }
  },
  {
    name: 'yedek gorev mazeret reddine ceviremez',
    run: async (env) => {
      const db = testUser(env, 'muezzin1').firestore();
      await assertFails(updateDoc(doc(db, 'bildirimler/ownPendingYedek'), {
        durum: 'reddedildi',
        pendingAck: false,
        retSebebi: 'Uygun degilim',
        sonGuncelleme: Timestamp.now()
      }));
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
      const base = {
        baslangic: '2026-05-22',
        bitis: '2026-05-23',
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
    name: 'admin duyuru yazabilir ve silebilir',
    run: async (env) => {
      const db = testUser(env, 'admin').firestore();
      const ref = doc(db, 'duyurular/adminNotice');

      await assertSucceeds(setDoc(ref, {
        baslik: 'Admin',
        icerik: 'Metin',
        tarih: Timestamp.now()
      }));
      await assertSucceeds(deleteDoc(ref));
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
          retSebebi: 'Hastalik',
          pendingAck: false,
          devirSonucu: 'yedek_atandi',
          sonGuncelleme: Timestamp.now()
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
      await assertSucceeds(updateDoc(doc(db, 'bildirimler/ownPendingAsil'), {
        durum: 'reddedildi',
        retSebebi: 'Hastalik',
        pendingAck: false,
        devirSonucu: 'alarm_bekliyor',
        sonGuncelleme: Timestamp.now()
      }));
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
          retSebebi: 'Sahte',
          pendingAck: false,
          devirSonucu: 'yedek_atandi',
          sonGuncelleme: Timestamp.now()
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
      await assertFails(updateDoc(doc(db, 'bildirimler/ownPendingAsil'), {
        durum: 'reddedildi',
        retSebebi: 'Hastalik',
        pendingAck: false,
        devirSonucu: 'gecersiz_deger',
        sonGuncelleme: Timestamp.now()
      }));
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
      await assertSucceeds(setDoc(doc(db, 'duyurular/bootstrapNotice'), {
        baslik: 'Test',
        mesaj: 'Bootstrap admin testi'
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
      await assertFails(setDoc(doc(db, 'duyurular/unauthorizedNotice'), {
        baslik: 'Test',
        mesaj: 'Yetkisiz deneme'
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
