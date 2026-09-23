import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Safely load local firebase config if present without breaking Vite build when absent
const localConfigModules = import.meta.glob<{ default?: Record<string, any> } | Record<string, any>>(
  '../../firebase-applet-config.json',
  { eager: true }
);
const localConfigRaw = Object.values(localConfigModules)[0] as Record<string, any> | undefined;
const localFirebaseConfig = (localConfigRaw?.default || localConfigRaw) || null;

// Support using environment variables to keep credentials safe and configurable for public repositories
const envFirebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

const hasEnvConfig = !!(envFirebaseConfig.projectId && envFirebaseConfig.apiKey);
const hasLocalConfig = !!(localFirebaseConfig && (localFirebaseConfig as any).projectId && (localFirebaseConfig as any).apiKey);

// Set to true only when valid credentials are provided via environment variables or local applet config
export const isFirebaseConfigured = hasLocalConfig || hasEnvConfig;

const activeFirebaseConfig = hasLocalConfig
  ? (localFirebaseConfig as any)
  : hasEnvConfig
  ? envFirebaseConfig
  : {
      apiKey: 'demo-api-key',
      authDomain: 'demo-project.firebaseapp.com',
      projectId: 'demo-project',
      storageBucket: 'demo-project.appspot.com',
      messagingSenderId: '000000000000',
      appId: '1:000000000000:web:0000000000000000000000'
    };

export const app = getApps().length === 0 ? initializeApp(activeFirebaseConfig) : getApp();
export const db = getFirestore(app, activeFirebaseConfig.firestoreDatabaseId || undefined);
export const auth = getAuth(app);

// Attempt anonymous sign-in only when Firebase is configured with real credentials
if (isFirebaseConfigured && typeof window !== 'undefined') {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      signInAnonymously(auth).catch((err) => {
        console.debug('Firebase anonymous auth notice:', err?.message || err);
      });
    }
  });
}

// Initialize Firebase Analytics safely when configured
export let analytics: ReturnType<typeof getAnalytics> | null = null;
if (isFirebaseConfigured && typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {
    // Gracefully handle environments where analytics is blocked or unsupported
  });
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
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  if (!isFirebaseConfigured) return;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Notice (Fallback Active): ', JSON.stringify(errInfo));
}
