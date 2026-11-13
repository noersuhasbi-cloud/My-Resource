import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  doc,
  getDocFromServer,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function createFirestoreClient(): Firestore {
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  if (typeof window !== 'undefined') {
    const isStaticFirebaseHosting =
      window.location.hostname.endsWith('.web.app') ||
      window.location.hostname.endsWith('.firebaseapp.com');

    const settings = isStaticFirebaseHosting
      ? {
          experimentalForceLongPolling: true,
          experimentalLongPollingOptions: { timeoutSeconds: 15 },
        }
      : {
          host: window.location.host,
          ssl: window.location.protocol === 'https:',
          experimentalForceLongPolling: true,
          experimentalLongPollingOptions: { timeoutSeconds: 15 },
        };

    try {
      return initializeFirestore(app, settings, databaseId);
    } catch {
      return getFirestore(app, databaseId);
    }
  }
  return getFirestore(app, databaseId);
}

export const db = createFirestoreClient();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

async function testConnection(retryCount = 0) {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      if (retryCount < 1 && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
        setTimeout(() => {
          void testConnection(retryCount + 1);
        }, 1200);
        return;
      }
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
