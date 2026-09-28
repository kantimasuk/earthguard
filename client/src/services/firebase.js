import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** false = ยังไม่ได้ใส่ค่าใน .env → หน้าเว็บยังเปิดได้ แต่ login ไม่ได้ */
export const firebaseConfigured = Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId);

export const firebaseApp = firebaseConfigured ? initializeApp(cfg) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
if (auth) auth.languageCode = 'th';

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
