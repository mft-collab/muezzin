import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

async function checkProjectAdmin() {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  console.log(`Trying to initialize Admin SDK for project: ${firebaseConfig.projectId}`);

  // In AIS, if we provide the projectId, it might use the ambient credentials if authorized.
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId
      // No credential means use application default
    });
  }

  const db = admin.firestore();
  
  try {
    // Try to list collections
    const collections = await db.listCollections();
    console.log('Successfully listed collections:', collections.map(c => c.id));
    return true;
  } catch (error) {
    console.error('Failed to list collections with Admin SDK:', error);
    return false;
  }
}

checkProjectAdmin();
