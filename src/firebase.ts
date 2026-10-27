import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function formatFirebaseAuthError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  if (
    code === 'auth/popup-blocked' ||
    rawMessage.includes('auth/popup-blocked')
  ) {
    return 'Your browser blocked the Google sign-in popup window. Create or sign in with your Email & Password right here (no popup needed), or allow popups for this site.';
  }
  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    rawMessage.includes('popup-closed-by-user')
  ) {
    return 'Google sign-in popup was closed before finishing. You can try again or use Email & Password below.';
  }
  if (
    code === 'auth/unauthorized-domain' ||
    rawMessage.includes('unauthorized-domain')
  ) {
    return 'Google popup sign-in is restricted on this preview domain. Please use Email & Password right below to create your account or sign in immediately.';
  }
  if (
    code === 'auth/email-already-in-use' ||
    rawMessage.includes('EMAIL_EXISTS') ||
    rawMessage.includes('email-already-in-use')
  ) {
    return 'An account with this email already exists on Pickra. Switch to the "Sign In" tab to log in with your password or Google.';
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    rawMessage.includes('INVALID_LOGIN_CREDENTIALS')
  ) {
    return 'Incorrect email or password. Double-check your credentials, use "Forgot password?", or switch to "Create Account" if you are new.';
  }
  if (code === 'auth/invalid-email' || rawMessage.includes('INVALID_EMAIL')) {
    return 'Please enter a valid email address (for example, name@domain.com).';
  }
  if (code === 'auth/weak-password' || rawMessage.includes('WEAK_PASSWORD')) {
    return 'Please choose a stronger password with at least 6 characters.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts from this browser. Wait a moment and try again, or reset your password.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network connection interrupted while reaching Firebase Authentication. Check your connection and try again.';
  }
  return rawMessage || 'Unable to complete authentication. Please try again.';
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
  SKU_REGEX: /^[A-Z0-9-]+$/,
  PROMO_CODE_REGEX: /^[A-Z0-9_-]+$/,
  ORDER_NUMBER_REGEX: /^PKR-[A-Z0-9-]+$/,
  HTTPS_URL_REGEX: /^https:\/\/.+/,
  DISPLAY_NAME_MAX: 80,
  STORE_NAME_MAX: 80,
  BIO_MAX: 300,
  PAYOUT_ACCOUNT_MAX: 160,
  PAYOUT_ACCOUNT_ITEM_MAX: 240,
  PAYOUT_ACCOUNTS_MAX_COUNT: 6,
  OFFER_TITLE_MIN: 2,
  OFFER_TITLE_MAX: 140,
  OFFER_CATEGORY_MIN: 2,
  OFFER_CATEGORY_MAX: 60,
  PRICE_LABEL_MAX: 40,
  COMMISSION_NOTE_MAX: 80,
  URL_MIN: 8,
  URL_MAX: 500,
  IMAGE_KEY_MAX: 175000,
  VIDEO_URL_MAX: 250000,
  DIGITAL_FILE_URL_MAX: 560000,
  DIGITAL_FILE_NAME_MAX: 140,
  DIGITAL_FILE_TYPE_MAX: 60,
  SUMMARY_MIN: 10,
  SUMMARY_MAX: 2500,
  PRODUCT_SUMMARY_MAX: 1500,
  PRODUCT_SUBTITLE_MIN: 4,
  PRODUCT_SUBTITLE_MAX: 220,
  PRODUCT_BADGE_MAX: 40,
  PRODUCT_DELIVERY_NOTE_MIN: 2,
  PRODUCT_DELIVERY_NOTE_MAX: 200,
  HIGHLIGHTS_MAX_COUNT: 4,
  HIGHLIGHT_ITEM_MAX: 140,
  POST_TITLE_MIN: 4,
  POST_TITLE_MAX: 160,
  POST_SUBTITLE_MIN: 8,
  POST_SUBTITLE_MAX: 280,
  POST_CONTENT_MIN: 20,
  POST_CONTENT_MAX: 340000,
  POST_ATTACHED_OFFERS_MAX: 8,
  DISCLOSURE_MIN: 10,
  DISCLOSURE_MAX: 400,
  CAMPAIGN_TITLE_MIN: 3,
  CAMPAIGN_TITLE_MAX: 120,
  CAMPAIGN_DESC_MIN: 8,
  CAMPAIGN_DESC_MAX: 280,
  PROMO_CODE_MIN: 3,
  PROMO_CODE_MAX: 24,
  ORDER_ADDRESS_MAX: 300,
  ORDER_ITEMS_SUMMARY_MAX: 600,
  ORDER_FULFILLMENT_NOTE_MAX: 300,
  ORDER_PAYOUT_DETAILS_MAX: 180,
  ORDER_PAYOUT_NOTE_MAX: 200,
  SITE_TAGLINE_MIN: 4,
  SITE_TAGLINE_MAX: 140,
  ANNOUNCEMENT_TEXT_MAX: 180,
  ANNOUNCEMENT_CTA_MAX: 40,
  EVENT_TITLE_MAX: 160,
  EVENT_PLATFORM_MAX: 40,
} as const;

export interface UploadedDigitalAsset {
  dataUrl: string;
  fileName: string;
  fileTypeLabel: string;
}

const DIGITAL_EXT_LABELS: Record<string, string> = {
  pdf: 'PDF Document',
  zip: 'ZIP Archive',
  xlsx: 'Excel Workbook',
  xls: 'Excel Spreadsheet',
  csv: 'CSV Dataset',
  epub: 'eBook (EPUB)',
  mobi: 'eBook (MOBI)',
  html: 'HTML Interactive Tool',
  htm: 'HTML File',
  json: 'Digital Tool (JSON)',
  js: 'JavaScript Tool',
  ts: 'TypeScript Tool',
  py: 'Python Script',
  txt: 'Text Guide',
  md: 'Markdown Guide',
  xml: 'XML Template',
  svg: 'Vector Asset (SVG)',
  docx: 'Word Document',
  pptx: 'Presentation Deck',
};

/**
 * Reads digital deliverable files (PDF, ZIP, Excel, CSV, EPUB eBooks, HTML files, Digital Tools)
 * into a safe data URL within Firestore's 1 MiB document ceiling, or guides large files to HTTPS cloud links.
 */
export async function readDigitalProductFileToDataUrl(
  file: File
): Promise<UploadedDigitalAsset> {
  const cleanName = file.name.trim().slice(0, VALIDATION_LIMITS.DIGITAL_FILE_NAME_MAX) || 'digital-product';
  const ext = (cleanName.split('.').pop() || '').toLowerCase();
  const fileTypeLabel = DIGITAL_EXT_LABELS[ext] || (ext ? `${ext.toUpperCase()} Digital File` : 'Digital Download');

  if (!ext || !Object.prototype.hasOwnProperty.call(DIGITAL_EXT_LABELS, ext)) {
    throw new Error(
      'Supported digital files: PDF, ZIP, Excel (.xlsx/.xls/.csv), eBooks (.epub/.mobi), HTML (.html/.htm), Word/PPTX, and Digital Tools (.json/.js/.py/.txt/.md/.svg).'
    );
  }

  // ~385 KB binary encodes to ~515 KB base64 data URL (safely inside Firestore 1 MiB document limit alongside cover image)
  if (file.size > 385 * 1024) {
    throw new Error(
      `Direct file upload supports compact deliverables up to 385 KB (${Math.round(
        file.size / 1024
      )} KB selected). For larger ZIPs, videos, or eBooks, paste a Google Drive, Dropbox, OneDrive, or direct HTTPS download link in the Digital Link box.`
    );
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected digital product file.'));
    reader.readAsDataURL(file);
  });

  if (!dataUrl.startsWith('data:') || dataUrl.length > VALIDATION_LIMITS.DIGITAL_FILE_URL_MAX) {
    throw new Error(
      'Encoded digital file exceeds inline storage limit. Please paste a Google Drive, Dropbox, or HTTPS download link instead.'
    );
  }

  return {
    dataUrl,
    fileName: cleanName,
    fileTypeLabel: fileTypeLabel.slice(0, VALIDATION_LIMITS.DIGITAL_FILE_TYPE_MAX),
  };
}

/**
 * Reads a compact preview video clip (.mp4, .webm, .mov, .ogg) into a data:video/* URL,
 * or instructs the user to paste a YouTube, Vimeo, Loom, or HTTPS MP4 URL for full-length videos.
 */
export async function readCompactVideoFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('video/')) {
    throw new Error('Please choose a valid video file (MP4, WebM, or MOV) or paste a YouTube / Vimeo / Loom URL.');
  }
  if (file.size > 175 * 1024) {
    throw new Error(
      `Direct video file upload supports short preview loops up to 175 KB (${Math.round(
        file.size / 1024
      )} KB selected). For full-length videos, paste a YouTube, Vimeo, Loom, Google Drive, or HTTPS .mp4 link.`
    );
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected video file.'));
    reader.readAsDataURL(file);
  });
  if (!dataUrl.startsWith('data:video/') || dataUrl.length > VALIDATION_LIMITS.VIDEO_URL_MAX) {
    throw new Error('Video clip is too large for inline storage. Paste a YouTube, Vimeo, Loom, or HTTPS MP4 link instead.');
  }
  return dataUrl;
}

/**
 * Safely downloads an uploaded data:* digital product file or opens an external HTTPS deliverable link
 * without using window.open (compliant with iframe sandbox rules).
 */
export function triggerDigitalAssetDownload(url: string, fileName?: string): void {
  const cleanUrl = (url || '').trim();
  if (!cleanUrl) return;

  const anchor = document.createElement('a');
  anchor.href = cleanUrl;
  if (cleanUrl.startsWith('data:')) {
    anchor.download = (fileName || 'pickra-digital-download').trim();
  } else {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/**
 * Client-side image compression for instant local photo uploads within Firestore document limits.
 */
export async function compressImageFileToDataUrl(
  file: File,
  maxDimension = 960,
  initialQuality = 0.74
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (JPG, PNG, WebP, or GIF).');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Image file is too large (max 15 MB before compression).');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.readAsDataURL(file);
  });

  const img = new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Selected file could not be decoded as an image.'));
    el.src = rawDataUrl;
  });

  const decodedImg = await img;
  let width = decodedImg.naturalWidth || decodedImg.width || 800;
  let height = decodedImg.naturalHeight || decodedImg.height || 600;
  if (width > maxDimension || height > maxDimension) {
    const scale = Math.min(maxDimension / width, maxDimension / height);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser canvas context unavailable for image processing.');
  }

  ctx.fillStyle = '#FAF8F5';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(decodedImg, 0, 0, width, height);

  let quality = initialQuality;
  let output = canvas.toDataURL('image/webp', quality);
  if (!output.startsWith('data:image/webp')) {
    output = canvas.toDataURL('image/jpeg', quality);
  }

  while (output.length > 155000 && quality > 0.35) {
    quality -= 0.12;
    output = canvas.toDataURL('image/jpeg', quality);
  }

  if (output.length > VALIDATION_LIMITS.IMAGE_KEY_MAX) {
    const smallerCanvas = document.createElement('canvas');
    smallerCanvas.width = Math.max(1, Math.round(width * 0.65));
    smallerCanvas.height = Math.max(1, Math.round(height * 0.65));
    const sCtx = smallerCanvas.getContext('2d');
    if (sCtx) {
      sCtx.fillStyle = '#FAF8F5';
      sCtx.fillRect(0, 0, smallerCanvas.width, smallerCanvas.height);
      sCtx.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
      output = smallerCanvas.toDataURL('image/jpeg', 0.58);
    }
  }

  if (output.length > VALIDATION_LIMITS.IMAGE_KEY_MAX) {
    throw new Error('Image is still too complex after compression. Try a smaller photo.');
  }

  return output;
}

export function toSafeSlug(input: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
  return cleaned.length >= 2 ? cleaned : `dispatch-${Date.now()}`;
}

export function toSafeSku(input: string): string {
  const cleaned = input
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned.length >= 2 ? cleaned : `PKR-${Math.floor(100 + Math.random() * 900)}`;
}

export function toSafePromoCode(input: string): string {
  const cleaned = input
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9_-]+/g, '')
    .slice(0, 24);
  return cleaned.length >= 3 ? cleaned : 'PICKRA10';
}

export function formatPriceCents(cents: number): string {
  const safeCents = Number.isFinite(cents) ? Math.max(0, Math.round(cents)) : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(safeCents / 100);
}

export function generateSafeDocId(prefix: string): string {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${randomSuffix}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
}

export function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || '8042';
  return `PKR-${year}-${suffix}`;
}

function escapeCsvCell(value: string | number): string {
  const raw = String(value ?? '');
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function downloadCsvFile(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  const blob = new Blob([csvLines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
