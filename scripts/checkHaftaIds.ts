import { db } from './lib/firebaseAdminInit.ts';

async function checkData() {
  const snapshot = await db.collection('haftaPlanlari').get();
  console.log("Hafta Planları IDs:");
  snapshot.forEach(doc => {
    console.log(`- ${doc.id}`);
  });
}

checkData();
