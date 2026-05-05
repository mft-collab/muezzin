import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

async function checkConfig() {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  try {
    const docSnap = await getDoc(doc(db, 'config', 'github'));
    if (docSnap.exists()) {
      console.log('SUCCESS: GitHub configuration is present in Firestore.');
      console.log('Data:', JSON.stringify(docSnap.data(), null, 2));
    } else {
      console.log('FAILURE: GitHub configuration is NOT present in Firestore.');
    }
  } catch (error) {
    console.error('Error fetching GitHub configuration:', error);
  }
}

checkConfig();
