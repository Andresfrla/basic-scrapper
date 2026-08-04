import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let app;
let db;

function loadCredential() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Faltan variables de entorno de Firebase: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
    );
  }

  return cert({ projectId, clientEmail, privateKey });
}

export function getFirebaseApp() {
  if (!app) {
    const existing = getApps();
    app = existing.length ? existing[0] : initializeApp({ credential: loadCredential() });
  }
  return app;
}

export function getDb() {
  if (!db) {
    const databaseId = process.env.FIRESTORE_DATABASE_ID || "scrapper-catch";
    db = getFirestore(getFirebaseApp(), databaseId);
  }
  return db;
}
