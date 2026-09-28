import admin from 'firebase-admin';
import { config } from '../config.js';

function loadCredential() {
  const raw = config.firebaseServiceAccount.trim();
  if (!raw) return admin.credential.applicationDefault(); // ใช้ GOOGLE_APPLICATION_CREDENTIALS ถ้ามี
  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  return admin.credential.cert(JSON.parse(json));
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: loadCredential() });
}

export const firebaseAuth = admin.auth();
