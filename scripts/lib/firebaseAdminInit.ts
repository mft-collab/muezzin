import admin from 'firebase-admin';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json' assert { type: 'json' };

const app = !admin.apps.length 
  ? admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    })
  : admin.apps[0]!;

// Named database usage in Admin SDK: getFirestore(databaseId)
export const db = getFirestore(firebaseConfig.firestoreDatabaseId);
export { Timestamp, FieldValue };
