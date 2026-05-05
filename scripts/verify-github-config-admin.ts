import { db } from './lib/firebaseAdminInit';

async function checkConfig() {
  console.log("Firestore kontrolü başlatılıyor...");
  try {
    const snapshot = await db.collection('vakitler').get();
    if (!snapshot.empty) {
      console.log(`SUCCESS: ${snapshot.size} documents found in vakitler collection.`);
    } else {
      console.log('Vakitler collection is empty or not found.');
    }

    const alerts = await db.collection('adminUyarilari').get();
    if (!alerts.empty) {
      console.log(`Alerts found: ${alerts.size}`);
      alerts.forEach(doc => console.log(`- Alert: ${doc.data().mesaj}`));
    }
  } catch (error) {
    console.error('Error during check:', error);
  }
}

checkConfig();
