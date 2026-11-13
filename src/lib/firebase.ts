import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

let authInstance: Auth | null = null;
const googleProvider = new GoogleAuthProvider();

try {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  authInstance = getAuth(app);
} catch (err) {
  console.warn('Firebase Auth client initialization warning:', err);
}

export const auth = authInstance;
export const googleAuthProvider = googleProvider;
