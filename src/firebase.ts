import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import defaultConfig from '../firebase-applet-config.json';

// Support custom Firebase project (e.g. production/localhost) via environment variables,
// with automatic fallback to default applet configuration.
const customApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const isCustomConfig = Boolean(customApiKey && customApiKey !== defaultConfig.apiKey);

export const activeFirebaseConfig = {
  apiKey: customApiKey || defaultConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaultConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || defaultConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaultConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || defaultConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || defaultConfig.measurementId || '',
};

const app = getApps().length > 0 ? getApp() : initializeApp(activeFirebaseConfig);

// An empty value or `(default)` selects Firestore's standard database; other IDs are used verbatim.
const rawDbId = import.meta.env.VITE_FIREBASE_DATABASE_ID;
const customDbId = !rawDbId || rawDbId === '(default)' ? undefined : rawDbId;
export const db = isCustomConfig
  ? (customDbId ? getFirestore(app, customDbId) : getFirestore(app))
  : getFirestore(app, defaultConfig.firestoreDatabaseId);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    if (error?.code === 'auth/unauthorized-domain') {
      console.warn(
        '[Firebase Auth] Domain belum diizinkan di Firebase Console. Tambahkan domain aplikasi ke Authorized Domains di Authentication Settings.',
        error.message
      );
    } else if (
      error?.code !== 'auth/popup-closed-by-user' &&
      error?.code !== 'auth/cancelled-popup-request'
    ) {
      console.warn('[Firebase Auth] Sign-in notice:', error?.message || error);
    }
    throw error;
  }
}

export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('[FIREBASE_SIGN_OUT_FAILED]', {
      code: typeof error?.code === 'string' ? error.code : 'auth/unknown',
    });
    throw error;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  code?: string;
  operationType: OperationType;
  path: string | null;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const firestoreError = error as { code?: string; message?: string };
  const safeMessage = String(firestoreError?.message || 'Unknown Firestore error')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .slice(0, 240);
  const safePath = path
    ?.replace(/(users\/)[^/]+/g, '$1[USER]')
    .replace(/(member_directory\/)[^/]+/g, '$1[MEMBER]') || null;
  const errInfo: FirestoreErrorInfo = {
    error: safeMessage,
    code: firestoreError?.code,
    operationType,
    path: safePath,
  };
  console.error('[FIRESTORE_ERROR]', errInfo);
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    console.error('[FIREBASE_CONNECTION_FAILED]', {
      code: typeof code === 'string' ? code : 'firestore/unknown',
    });
    throw error;
  }
}
