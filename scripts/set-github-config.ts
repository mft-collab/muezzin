import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { PAT, OWNER, REPO } from './lib/githubConfig.ts';

async function setConfig() {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  const githubConfig = {
    pat: PAT,
    owner: OWNER,
    repo: REPO
  };

  try {
    await setDoc(doc(db, 'config', 'github'), githubConfig);
    console.log('GitHub configuration successfully updated in Firestore.');
  } catch (error) {
    console.error('Error updating GitHub configuration:', error);
    process.exit(1);
  }
}

setConfig();
