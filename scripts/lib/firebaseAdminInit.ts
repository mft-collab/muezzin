import { cert, applicationDefault, initializeApp, getApps, type Credential } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json' assert { type: 'json' };
import fs from 'fs';
import path from 'path';

let credential: Credential | undefined;
const credentialsPath = path.resolve(process.cwd(), 'credentials.json');
const envKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

if (envKey) {
  try {
    const rawKey = envKey.startsWith('{') ? envKey : Buffer.from(envKey, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(rawKey);
    console.log(`Firebase Admin: Using service account for project: ${serviceAccount.project_id} (Client Email: ${serviceAccount.client_email})`);
    credential = cert(serviceAccount);
  } catch (error) {
    console.error('Error parsing FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS_JSON:', error);
    console.log('Environment variable length:', envKey?.length || 0);
  }
}

if (!credential && fs.existsSync(credentialsPath)) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    credential = cert(serviceAccount);
    console.log('Using service account from credentials.json');
  } catch (error) {
    console.error('Error loading credentials.json:', error);
  }
}

if (!credential) {
  credential = applicationDefault();
  console.log('Using application default credentials');
}

const existingApps = getApps();
const app = existingApps.length
  ? existingApps[0]!
  : initializeApp({
      credential,
      projectId: firebaseConfig.projectId,
    });

// Named database usage in Admin SDK: getFirestore(databaseId)
// If the ID is "(default)", we use the default database by passing no arguments.
const dbId = (firebaseConfig.firestoreDatabaseId === "(default)" || !firebaseConfig.firestoreDatabaseId)
  ? undefined
  : firebaseConfig.firestoreDatabaseId;

export const db = dbId
  ? (getFirestore as any)(app, dbId)
  : getFirestore(app);
export const auth = getAuth(app);
export { Timestamp, FieldValue };
