import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
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

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

// Blueprint-synchronized validation & sanitization constants
export const VALIDATION_LIMITS = {
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  SLUG_REGEX: /^[a-z0-9-]+$/,
  HTTPS_URL_REGEX: /^https:\/\/.+/,
  DISPLAY_NAME_MAX: 80,
  BIO_MAX: 300,
  OFFER_TITLE_MIN: 2,
  OFFER_TITLE_MAX: 140,
  OFFER_CATEGORY_MIN: 2,
  OFFER_CATEGORY_MAX: 60,
  PRICE_LABEL_MAX: 40,
  COMMISSION_NOTE_MAX: 80,
  URL_MIN: 8,
  URL_MAX: 500,
  SUMMARY_MIN: 10,
  SUMMARY_MAX: 400,
  HIGHLIGHTS_MAX_COUNT: 4,
  HIGHLIGHT_ITEM_MAX: 140,
  POST_TITLE_MIN: 4,
  POST_TITLE_MAX: 160,
  POST_SUBTITLE_MIN: 8,
  POST_SUBTITLE_MAX: 280,
  POST_CONTENT_MIN: 20,
  POST_CONTENT_MAX: 25000,
  POST_ATTACHED_OFFERS_MAX: 8,
  DISCLOSURE_MIN: 10,
  DISCLOSURE_MAX: 400,
} as const;

export function toSafeSlug(input: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
  return cleaned.length >= 2 ? cleaned : `dispatch-${Date.now()}`;
}

export function generateSafeDocId(prefix: string): string {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${randomSuffix}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
}
