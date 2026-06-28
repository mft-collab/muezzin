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
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  Timestamp,
  updateDoc
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

    await setDoc(doc(db, 'duyurular/publicNotice'), {
      baslik: 'Duyuru',
      icerik: 'Metin',
      tarih: Timestamp.now()
    });
  });
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
