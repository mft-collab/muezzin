import admin from 'firebase-admin';
import firebaseConfig from '../../firebase-applet-config.json' assert { type: 'json' };

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

// Named database usage in Admin SDK: admin.firestore(databaseId)
export const db = admin.firestore(firebaseConfig.firestoreDatabaseId);
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
