import admin from 'firebase-admin';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json' assert { type: 'json' };
import fs from 'fs';
import path from 'path';

let credential;
const credentialsPath = path.resolve(process.cwd(), 'credentials.json');
const envKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

if (envKey) {
  try {
    const serviceAccount = JSON.parse(envKey.startsWith('{') ? envKey : Buffer.from(envKey, 'base64').toString('utf8'));
    console.log(`Firebase Admin: Using service account for project: ${serviceAccount.project_id}`);
    credential = admin.credential.cert(serviceAccount);
  } catch (error) {
    console.error('Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:', error);
  }
}

if (!credential && fs.existsSync(credentialsPath)) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    credential = admin.credential.cert(serviceAccount);
    console.log('Using service account from credentials.json');
  } catch (error) {
    console.error('Error loading credentials.json:', error);
  }
}

if (!credential) {
  credential = admin.credential.applicationDefault();
  console.log('Using application default credentials');
}

const app = !admin.apps.length 
  ? admin.initializeApp({
      credential,
      projectId: firebaseConfig.projectId,
    })
  : admin.apps[0]!;

// Named database usage in Admin SDK: getFirestore(databaseId)
// If the ID is "(default)", we use the default database by passing no arguments.
const dbId = (firebaseConfig.firestoreDatabaseId === "(default)" || !firebaseConfig.firestoreDatabaseId) 
  ? undefined 
  : firebaseConfig.firestoreDatabaseId;

export const db = getFirestore(dbId);
export const auth = admin.auth();
export { Timestamp, FieldValue };
