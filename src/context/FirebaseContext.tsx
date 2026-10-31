import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  collection as liteCollection,
  doc as liteDoc,
  getDoc as getLiteDoc,
  getDocs as getLiteDocs,
  query as liteQuery,
  where as liteWhere,
} from 'firebase/firestore/lite';
import {
  auth,
  db,
  formatFirebaseAuthError,
  generateOrderNumber,
  generateSafeDocId,
  googleProvider,
  handleFirestoreError,
  liteDb,
  OperationType,
  toSafePromoCode,
  toSafeSku,
  toSafeSlug,
  VALIDATION_LIMITS,
} from '../firebase';
import {
  isAuthorizedOwnerEmail,
  isOwnerAccountConfigured,
  isProtectedAdminEmail,
  sanitizePublicContactEmail,
} from '../utils/ownerAuth';
import {
  AdminRecord,
  AffiliateOffer,
  AnalyticsChannel,
  AnalyticsEvent,
  AnalyticsEventType,
  AnnouncementTargetSection,
  BlogColorTheme,
  BlogPost,
  CampaignChannel,
  CartItem,
  ContactIssueCategory,
  ContactMessage,
  ContactMessageStatus,
  CustomerPaymentMethod,
  DEFAULT_AFFILIATE_CATEGORIES,
  DEFAULT_BLOG_SAVED_LINKS,
  DEFAULT_CAMPAIGN_CHANNELS,
  DEFAULT_DIGITAL_FORMATS,
  DEFAULT_POST_CATEGORIES,
  DEFAULT_SECTION_HEADERS,
  DEFAULT_STORE_CATEGORIES,
  DeliveredDigitalAsset,
  DirectOrder,
  DirectProduct,
  DirectProductKind,
  DropdownListKey,
  formatPayoutSummary,
  MarketingCampaign,
  OrderFulfillmentStatus,
  parsePayoutAccounts,
  PayoutSettlementStatus,
  PRODUCT_AFFILIATE_PLATFORMS,
  ProductApprovalStatus,
  PublishStatus,
  SavedPayoutAccount,
  SectionHeaderCopy,
  SectionHeaderKey,
  SellerAccountStatus,
  SellerPayoutMethod,
  serializePayoutAccount,
  SERVICE_AFFILIATE_PLATFORMS,
  SiteConfig,
  UserPrivateInfo,
  UserProfile,
} from '../types';
import {
  DEFAULT_DISCLOSURE,
  SEED_CAMPAIGNS,
  SEED_DIRECT_PRODUCTS,
  SEED_OFFERS,
  SEED_POSTS,
} from '../data/editorialSeed';

export interface OfferDraftInput {
  id?: string;
  title: string;
  kind: AffiliateOffer['kind'];
  platform: AffiliateOffer['platform'];
  category: string;
  priceLabel: string;
  commissionNote: string;
  affiliateUrl: string;
  imageKey: string;
  videoUrl?: string;
  summary: string;
  highlights: string[];
  status: PublishStatus;
}

export interface PostDraftInput {
  id?: string;
  title: string;
  subtitle: string;
  slug?: string;
  category: BlogPost['category'];
  readTimeMinutes: number;
  coverImageKey: string;
  content: string;
  theme?: BlogColorTheme;
  attachedOfferIds: string[];
  disclosureText: string;
  featured: boolean;
  status: PublishStatus;
  publishedLabel: string;
}

export interface DirectProductDraftInput {
  id?: string;
  title: string;
  subtitle: string;
  kind: DirectProductKind;
  category: string;
  sku: string;
  priceCents: number;
  compareAtCents: number;
  stockCount: number;
  badgeLabel: string;
  imageKey: string;
  videoUrl?: string;
  digitalFileUrl?: string;
  digitalFileName?: string;
  digitalFileType?: string;
  hasDigitalAsset?: boolean;
  summary: string;
  highlights: string[];
  deliveryNote: string;
  featured: boolean;
  status: PublishStatus;
}

export interface CampaignDraftInput {
  id?: string;
  title: string;
  description: string;
  promoCode: string;
  discountPercent: number;
  minOrderCents: number;
  channel: CampaignChannel;
  featuredProductId: string;
  ctaLabel: string;
  expiresLabel: string;
  status: PublishStatus;
}

export interface DirectCheckoutInput {
  buyerName: string;
  buyerEmail: string;
  shippingAddress: string;
  paymentMethod?: CustomerPaymentMethod;
  paymentReference?: string;
}

export interface SellerAccountInput {
  storeName: string;
  bio: string;
  payoutMethod: SellerPayoutMethod;
  payoutAccount: string;
  payoutAccounts?: SavedPayoutAccount[];
}

export type AuthModalMode = 'signup' | 'signin';

export interface GoogleSignInSeed {
  asSeller?: boolean;
  storeName?: string;
  payoutMethod?: SellerPayoutMethod;
  payoutProviderLabel?: string;
  accountHolder?: string;
  payoutAccount?: string;
}

export interface EmailRegistrationInput {
  fullName: string;
  email: string;
  password: string;
  asSeller?: boolean;
  storeName?: string;
  payoutMethod?: SellerPayoutMethod;
  payoutProviderLabel?: string;
  payoutAccount?: string;
}

export interface SiteConfigInput {
  siteTagline: string;
  announcementEnabled: boolean;
  announcementText: string;
  announcementCtaLabel: string;
  announcementTargetSection: AnnouncementTargetSection;
  freeShippingThresholdCents: number;
  flatShippingCents: number;
  defaultDisclosureText: string;
  storeCheckoutEnabled: boolean;
  blogEnabled?: boolean;
  storeEnabled?: boolean;
  productAffiliateEnabled?: boolean;
  serviceAffiliateEnabled?: boolean;
  showStarterSeeds: boolean;
  hiddenSeedIds?: string[];
  aboutMission?: string;
  aboutStory?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactLocation?: string;
  privacyPolicySummary?: string;
}

export interface ContactMessageInput {
  senderName: string;
  senderEmail: string;
  category: ContactIssueCategory;
  orderNumber?: string;
  subject: string;
  message: string;
}

interface PendingTelemetryPayload {
  targetOwnerId: string;
  eventType: AnalyticsEventType;
  channel: AnalyticsChannel;
  targetId: string;
  targetTitle: string;
  platform: string;
  valueCents: number;
}

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  loadingData: boolean;
  loadingPosts: boolean;
  loadingProducts: boolean;
  loadingOffers: boolean;
  publicDataError: string | null;
  retryPublicData: () => void;
  // Website Owner RBAC & Backend Governance
  isBootstrappedCreator: boolean;
  isCreatorAdmin: boolean;
  adminRoleReady: boolean;
  adminRegistry: AdminRecord[];
  allUsers: UserProfile[];
  siteConfig: SiteConfig;
  hasSavedSiteConfig: boolean;
  // Profiles & Creator Seller Account
  profile: UserProfile | null;
  privateInfo: UserPrivateInfo | null;
  isActiveSeller: boolean;
  isSellerSuspended: boolean;
  // Blog & Affiliate Catalog
  publishedPosts: BlogPost[];
  publishedOffers: AffiliateOffer[];
  studioPosts: BlogPost[];
  studioOffers: AffiliateOffer[];
  allAccessibleOffersMap: Record<string, AffiliateOffer>;
  clickCounts: Record<string, number>;
  postViewCounts: Record<string, number>;
  productBagCounts: Record<string, number>;
  analyticsEvents: AnalyticsEvent[];
  hasFirestoreContent: boolean;
  // Multi-Creator Direct Storefront, Marketing Campaigns & Payout Orders
  publishedDirectProducts: DirectProduct[];
  mySellerProducts: DirectProduct[];
  studioDirectProducts: DirectProduct[];
  allAccessibleDirectProductsMap: Record<string, DirectProduct>;
  publishedCampaigns: MarketingCampaign[];
  studioCampaigns: MarketingCampaign[];
  myPurchases: DirectOrder[];
  mySellerOrders: DirectOrder[];
  sellerOrders: DirectOrder[];
  deliveredDigitalCache: Record<string, DeliveredDigitalAsset>;
  // Shopping Bag & Promo Engine
  cartItems: CartItem[];
  cartCount: number;
  cartSubtotalCents: number;
  appliedPromoCode: string;
  appliedCampaign: MarketingCampaign | null;
  cartDiscountCents: number;
  cartShippingCents: number;
  cartTotalCents: number;
  cartRequiresShipping: boolean;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  cartInitialStep: 'bag' | 'checkout';
  setCartInitialStep: (step: 'bag' | 'checkout') => void;
  addToCart: (productId: string, quantity?: number, openDrawer?: boolean) => void;
  buyNowProduct: (productId: string, quantity?: number) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  applyPromoCode: (rawCode: string) => { ok: boolean; message: string };
  clearPromoCode: () => void;
  // Auth & Mutations
  authBusy: boolean;
  authError: string | null;
  clearAuthError: () => void;
  isAuthModalOpen: boolean;
  authModalMode: AuthModalMode;
  authModalSellerPreset: boolean;
  openAuthModal: (mode?: AuthModalMode, sellerPreset?: boolean) => void;
  closeAuthModal: () => void;
  signInWithGoogle: (seed?: GoogleSignInSeed) => Promise<boolean>;
  registerWithEmailPassword: (input: EmailRegistrationInput) => Promise<boolean>;
  signInWithEmailPassword: (email: string, password: string) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendOwnerVerificationEmail: () => Promise<void>;
  refreshAuthUser: () => Promise<void>;
  signOutUser: () => Promise<void>;
  registerOrUpdateSellerAccount: (input: SellerAccountInput) => Promise<void>;
  saveUserPaymentMethods: (
    accounts: SavedPayoutAccount[],
    primaryId?: string
  ) => Promise<void>;
  moderateUserSellerStatus: (
    targetUid: string,
    nextStatus: SellerAccountStatus,
    isSellerFlag?: boolean
  ) => Promise<void>;
  saveOffer: (input: OfferDraftInput) => Promise<string>;
  updateOfferStatus: (offerId: string, status: PublishStatus) => Promise<void>;
  deleteOffer: (offerId: string) => Promise<void>;
  updateOfferImage: (offerId: string, nextImageKey: string) => Promise<void>;
  savePost: (input: PostDraftInput) => Promise<string>;
  updatePostStatus: (postId: string, status: PublishStatus) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  updatePostCoverImage: (
    postId: string,
    nextCoverImageKey: string
  ) => Promise<void>;
  saveDirectProduct: (input: DirectProductDraftInput) => Promise<string>;
  updateDirectProductStatus: (
    productId: string,
    status: PublishStatus,
    stockCount?: number
  ) => Promise<void>;
  moderateDirectProduct: (
    productId: string,
    decision: ProductApprovalStatus,
    moderationNote?: string
  ) => Promise<void>;
  deleteDirectProduct: (productId: string) => Promise<void>;
  updateDirectProductImage: (
    productId: string,
    nextImageKey: string
  ) => Promise<void>;
  fetchProtectedDigitalSecret: (
    productId: string,
    orderId?: string
  ) => Promise<DeliveredDigitalAsset | null>;
  saveCampaign: (input: CampaignDraftInput) => Promise<string>;
  updateCampaignStatus: (campaignId: string, status: PublishStatus) => Promise<void>;
  deleteCampaign: (campaignId: string) => Promise<void>;
  dropdownOptions: Record<DropdownListKey, string[]>;
  addDropdownOption: (listKey: DropdownListKey, newOption: string) => void;
  renameDropdownOption: (
    listKey: DropdownListKey,
    oldOption: string,
    nextOption: string
  ) => void;
  deleteDropdownOption: (
    listKey: DropdownListKey,
    optionToDelete: string
  ) => void;
  sectionHeaders: Record<SectionHeaderKey, SectionHeaderCopy>;
  saveSectionHeader: (key: SectionHeaderKey, copy: SectionHeaderCopy) => void;
  resetSectionHeader: (key: SectionHeaderKey) => void;
  placeDirectOrder: (input: DirectCheckoutInput) => Promise<DirectOrder>;
  updateDirectOrderFulfillment: (
    orderId: string,
    status: OrderFulfillmentStatus,
    fulfillmentNote: string
  ) => Promise<void>;
  updateOrderPayoutDetails: (
    orderId: string,
    sellerPayoutDetails: string
  ) => Promise<void>;
  markSellerOrderPaidOut: (
    orderId: string,
    payoutStatus: PayoutSettlementStatus,
    payoutNote: string
  ) => Promise<void>;
  cancelBuyerOrder: (orderId: string) => Promise<void>;
  removeLocalPurchaseRecord: (orderId: string) => void;
  deleteDirectOrder: (orderId: string) => Promise<void>;
  saveProfileAndAffiliateTags: (input: {
    displayName: string;
    bio: string;
    defaultAmazonTag: string;
    defaultDigistoreId: string;
  }) => Promise<void>;
  saveSiteConfig: (input: SiteConfigInput) => Promise<void>;
  contactMessages: ContactMessage[];
  myContactMessages: ContactMessage[];
  submitContactMessage: (input: ContactMessageInput) => Promise<ContactMessage>;
  updateContactMessageStatus: (
    messageId: string,
    status: ContactMessageStatus,
    adminNote: string
  ) => Promise<void>;
  deleteContactMessage: (messageId: string) => Promise<void>;
  hideSeedItem: (seedId: string) => Promise<void>;
  grantCoAdmin: (targetUid: string) => Promise<void>;
  revokeCoAdmin: (targetUid: string) => Promise<void>;
  importStarterCatalog: () => Promise<void>;
  recordOutboundClick: (offerId: string) => void;
  recordPostView: (post: BlogPost) => void;
  recordProductView: (product: DirectProduct) => void;
  deleteAnalyticsEvent: (eventId: string) => Promise<void>;
}

const CLICK_STORAGE_KEY = 'pickra_outbound_clicks_v1';
const POST_VIEWS_STORAGE_KEY = 'pickra_post_views_v1';
const BAG_ADDS_STORAGE_KEY = 'pickra_bag_adds_v1';
const PENDING_TELEMETRY_KEY = 'pickra_pending_telemetry_v1';
const HIDE_SEEDS_KEY = 'pickra_hide_starter_seeds_v1';
const HIDDEN_SEED_IDS_KEY = 'pickra_hidden_seed_ids_v1';
const CART_STORAGE_KEY = 'pickra_direct_cart_v1';
const PROMO_STORAGE_KEY = 'pickra_active_promo_v1';
const GUEST_ORDERS_STORAGE_KEY = 'pickra_guest_orders_v2';
const DELIVERED_DIGITAL_STORAGE_KEY = 'pickra_delivered_digital_v1';
const SEED_STOCK_OFFSETS_KEY = 'pickra_seed_stock_offsets_v1';
const UI_PREFS_STORAGE_KEY = 'pickra_admin_ui_prefs_v2';
export {
  isAuthorizedOwnerEmail,
  isOwnerAccountConfigured,
  isProtectedAdminEmail,
  sanitizePublicContactEmail,
};

const FORBIDDEN_DIGITAL_EXTENSIONS = [
  '.exe',
  '.msi',
  '.bat',
  '.cmd',
  '.sh',
  '.ps1',
  '.apk',
  '.dmg',
  '.com',
  '.scr',
  '.vbs',
  '.jar',
];

const VALID_CUSTOMER_PAYMENT_METHODS: CustomerPaymentMethod[] = [
  'Card',
  'Telebirr',
  'CBEBirr',
  'PayPal',
  'BankTransfer',
];

interface AdminUiPrefsState {
  dropdownOptions: Record<DropdownListKey, string[]>;
  sectionHeaders: Record<SectionHeaderKey, SectionHeaderCopy>;
}

function buildDefaultDropdownOptions(): Record<DropdownListKey, string[]> {
  const seedStoreCats = Array.from(
    new Set([
      ...SEED_DIRECT_PRODUCTS.map((p) => p.category),
      ...DEFAULT_STORE_CATEGORIES,
    ])
  );
  const seedAffCats = Array.from(
    new Set([
      ...SEED_OFFERS.map((o) => o.category),
      ...DEFAULT_AFFILIATE_CATEGORIES,
    ])
  );
  return {
    storeCategories: seedStoreCats,
    productPlatforms: [...PRODUCT_AFFILIATE_PLATFORMS],
    servicePlatforms: [...SERVICE_AFFILIATE_PLATFORMS],
    blogCategories: [...DEFAULT_POST_CATEGORIES],
    blogSavedLinks: [...DEFAULT_BLOG_SAVED_LINKS],
    affiliateCategories: seedAffCats,
    digitalFormats: [...DEFAULT_DIGITAL_FORMATS],
    campaignChannels: [...DEFAULT_CAMPAIGN_CHANNELS],
  };
}

function rebrandLegacyCopy(raw: string): string {
  return raw
    .replace(/\bPickra\b/g, 'Pickras')
    .replace(/https:\/\/pickra\.studio\b/g, 'https://pickras.studio');
}

function loadInitialAdminUiPrefs(): AdminUiPrefsState {
  const defaults: AdminUiPrefsState = {
    dropdownOptions: buildDefaultDropdownOptions(),
    sectionHeaders: { ...DEFAULT_SECTION_HEADERS },
  };
  try {
    const raw = localStorage.getItem(UI_PREFS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AdminUiPrefsState>;
    const defaultDrops = buildDefaultDropdownOptions();
    const mergedDrops = { ...defaultDrops };
    if (parsed.dropdownOptions && typeof parsed.dropdownOptions === 'object') {
      for (const k of Object.keys(defaultDrops) as DropdownListKey[]) {
        const candidate = parsed.dropdownOptions[k];
        if (Array.isArray(candidate) && candidate.length > 0) {
          mergedDrops[k] = candidate
            .map((s) => rebrandLegacyCopy(String(s).trim()))
            .filter(Boolean);
        }
      }
    }
    const mergedHeaders: Record<SectionHeaderKey, SectionHeaderCopy> = {
      ...DEFAULT_SECTION_HEADERS,
    };
    if (parsed.sectionHeaders && typeof parsed.sectionHeaders === 'object') {
      for (const k of Object.keys(DEFAULT_SECTION_HEADERS) as SectionHeaderKey[]) {
        const c = parsed.sectionHeaders[k];
        if (c && typeof c === 'object' && typeof c.title === 'string') {
          mergedHeaders[k] = {
            kicker:
              typeof c.kicker === 'string'
                ? rebrandLegacyCopy(c.kicker)
                : DEFAULT_SECTION_HEADERS[k].kicker,
            title: rebrandLegacyCopy(c.title),
            subtitle:
              typeof c.subtitle === 'string'
                ? rebrandLegacyCopy(c.subtitle)
                : DEFAULT_SECTION_HEADERS[k].subtitle,
          };
        }
      }
    }
    return {
      dropdownOptions: mergedDrops,
      sectionHeaders: mergedHeaders,
    };
  } catch {
    return defaults;
  }
}

function buildSeedDigitalBundleAsset(product: DirectProduct): DeliveredDigitalAsset {
  const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${product.title} — Pickras Digital Edition</title>
<style>
  body { font-family: Georgia, serif; max-width: 720px; margin: 48px auto; padding: 0 24px; color: #1c1917; background: #faf8f5; line-height: 1.7; }
  .badge { font-family: system-ui, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #9a3412; font-weight: 700; }
  h1 { font-size: 30px; margin: 8px 0 12px; }
  .box { background: #ffffff; border: 1px solid #e7e5e4; border-radius: 12px; padding: 24px; margin-top: 24px; font-family: system-ui, sans-serif; }
  li { margin-bottom: 8px; }
</style>
</head>
<body>
  <div class="badge">Pickras Verified Digital Edition · SKU ${product.sku}</div>
  <h1>${product.title}</h1>
  <p>${product.subtitle}</p>
  <div class="box">
    <h3>Included Deliverables</h3>
    <ul>
      ${product.highlights.map((h) => `<li>${h}</li>`).join('')}
    </ul>
    <p><strong>Overview:</strong> ${product.summary}</p>
    <p><strong>Fulfillment Note:</strong> ${product.deliveryNote}</p>
  </div>
</body>
</html>`;
  const encoded = `data:text/html;charset=utf-8,${encodeURIComponent(htmlDoc)}`;
  return {
    url: encoded,
    fileName: `${product.sku.toLowerCase()}-digital-edition.html`,
    fileType: product.digitalFileType || 'HTML Digital Edition',
  };
}

const DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS = 9500;
const DEFAULT_FLAT_PHYSICAL_SHIPPING_CENTS = 900;

const DEFAULT_SITE_TAGLINE =
  'Independent editorial blog, multi-creator store, and curated product & service affiliate directories.';

export const DEFAULT_ABOUT_MISSION =
  'Pickras is an independent digital publication and creator marketplace built around editorial clarity, transparent commerce, and direct creator empowerment. Rather than blending paid placements into editorial journalism, Pickras separates every experience into four dedicated pillars so readers, buyers, and independent creators always know how each item is produced, fulfilled, and disclosed.';

export const DEFAULT_ABOUT_STORY =
  'On the Pickras Blog, our editorial desk publishes long-form dispatches, field guides, and technical essays in distraction-free color themes. In the Pickras Store, verified independent creators sell original physical goods and vaulted digital downloads—receiving 90% net payouts while buyers enjoy frictionless guest or account checkout. Alongside the Store, our Product Affiliate and Service Affiliate directories curate vetted hardware, software, and specialist talent across Amazon, Digistore24, Fiverr, Upwork, and global partner networks with full FTC transparency.';

export const DEFAULT_CONTACT_EMAIL = '';
export const DEFAULT_CONTACT_PHONE = 'Direct Desk · Mon–Sat, 09:00–18:00 UTC';
export const DEFAULT_CONTACT_LOCATION = 'Global Digital Publication & Commerce Desk';

export const DEFAULT_PRIVACY_POLICY_SUMMARY =
  'Pickras enforces strict role-based data minimization across every module. Account emails, affiliate tracking tags, and seller payout credentials (Telebirr, Bank Transfer, CBE Birr, PayPal, Wise) are isolated inside owner-only private Firestore vaults and never exposed on public profiles. Guest and member Store orders are visible solely to the buyer, the fulfilling seller, and the Pickras administrator, using masked payment references rather than raw card numbers. Digital deliverables are protected in a locked vault until a verified purchase completes.';

const VALID_BLOG_THEMES: BlogColorTheme[] = [
  'classic',
  'midnight',
  'sage',
  'terracotta',
  'slate',
];

const VALID_PAYOUT_METHODS: SellerPayoutMethod[] = [
  'None',
  'Telebirr',
  'CBEBirr',
  'MobileMoney',
  'BankTransfer',
  'Stripe',
  'PayPal',
  'Wise',
  'Custom',
];

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

function timestampToMs(val: unknown): number {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (
    val &&
    typeof val === 'object' &&
    'seconds' in val &&
    typeof (val as { seconds: number }).seconds === 'number'
  ) {
    return (val as { seconds: number }).seconds * 1000;
  }
  return Date.now();
}

function parseUserProfileDoc(
  id: string,
  data: Record<string, unknown>
): UserProfile {
  const rawSellerStatus = String(data.sellerStatus || '');
  const sellerStatus: SellerAccountStatus =
    rawSellerStatus === 'active' ||
    rawSellerStatus === 'pending' ||
    rawSellerStatus === 'suspended' ||
    rawSellerStatus === 'inactive'
      ? rawSellerStatus
      : data.isSeller
      ? 'active'
      : 'inactive';
  return {
    uid: String(data.uid || id),
    displayName: String(data.displayName || 'Member'),
    bio: String(data.bio || ''),
    isSeller: Boolean(data.isSeller),
    sellerStatus,
    storeName: String(data.storeName || ''),
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

function parseOfferDoc(id: string, data: Record<string, unknown>): AffiliateOffer {
  return {
    id,
    authorId: String(data.authorId || ''),
    authorName: String(data.authorName || 'Pickras Editorial'),
    title: String(data.title || ''),
    kind: (data.kind as AffiliateOffer['kind']) || 'physical',
    platform: (data.platform as AffiliateOffer['platform']) || 'Amazon',
    category: String(data.category || 'General'),
    priceLabel: String(data.priceLabel || ''),
    commissionNote: String(data.commissionNote || ''),
    affiliateUrl: String(data.affiliateUrl || ''),
    imageKey: String(data.imageKey || 'workspace'),
    videoUrl: typeof data.videoUrl === 'string' ? data.videoUrl : '',
    summary: String(data.summary || ''),
    highlights: Array.isArray(data.highlights)
      ? data.highlights.map((h) => String(h)).slice(0, 4)
      : [],
    status: (data.status as PublishStatus) || 'draft',
    isSeed: false,
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

function parsePostDoc(id: string, data: Record<string, unknown>): BlogPost {
  const rawTheme = String(data.theme || 'classic') as BlogColorTheme;
  const theme: BlogColorTheme = VALID_BLOG_THEMES.includes(rawTheme)
    ? rawTheme
    : 'classic';

  return {
    id,
    authorId: String(data.authorId || ''),
    authorName: String(data.authorName || 'Pickras Editorial'),
    title: String(data.title || ''),
    subtitle: String(data.subtitle || ''),
    slug: String(data.slug || id),
    category: (data.category as BlogPost['category']) || 'Field Guides',
    readTimeMinutes: Number(data.readTimeMinutes || 5),
    coverImageKey: String(data.coverImageKey || 'workspace'),
    content: String(data.content || ''),
    theme,
    attachedOfferIds: Array.isArray(data.attachedOfferIds)
      ? data.attachedOfferIds.map((item) => String(item)).slice(0, 8)
      : [],
    disclosureText: String(data.disclosureText || DEFAULT_DISCLOSURE),
    featured: Boolean(data.featured),
    status:
      data.status === 'active'
        ? 'published'
        : (data.status as PublishStatus) || 'draft',
    publishedLabel: String(data.publishedLabel || 'Recent Dispatch'),
    isSeed: false,
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

function parseDirectProductDoc(
  id: string,
  data: Record<string, unknown>
): DirectProduct {
  const normalizedStatus: PublishStatus =
    data.status === 'active' || data.status === 'approved'
      ? 'published'
      : (data.status as PublishStatus) || 'draft';
  const rawApproval = String(data.approvalStatus || '');
  const approvalStatus: ProductApprovalStatus =
    rawApproval === 'pending' ||
    rawApproval === 'approved' ||
    rawApproval === 'rejected'
      ? rawApproval
      : normalizedStatus === 'published'
      ? 'approved'
      : 'pending';

  const legacyUrl =
    typeof data.digitalFileUrl === 'string' ? data.digitalFileUrl : '';

  return {
    id,
    sellerId: String(data.sellerId || ''),
    sellerName: String(data.sellerName || 'Pickras Studio'),
    title: String(data.title || ''),
    subtitle: String(data.subtitle || ''),
    kind: (data.kind as DirectProductKind) || 'physical',
    category: String(data.category || 'Studio Editions'),
    sku: String(data.sku || 'PKR-01'),
    priceCents: Number(data.priceCents || 1000),
    compareAtCents: Number(data.compareAtCents || 0),
    stockCount: Number(data.stockCount ?? 10),
    badgeLabel: String(data.badgeLabel || ''),
    imageKey: String(data.imageKey || 'edition'),
    videoUrl: typeof data.videoUrl === 'string' ? data.videoUrl : '',
    digitalFileUrl: legacyUrl,
    digitalFileName:
      typeof data.digitalFileName === 'string' ? data.digitalFileName : '',
    digitalFileType:
      typeof data.digitalFileType === 'string' ? data.digitalFileType : '',
    hasDigitalAsset:
      typeof data.hasDigitalAsset === 'boolean'
        ? data.hasDigitalAsset
        : Boolean(legacyUrl),
    approvalStatus,
    moderationNote:
      typeof data.moderationNote === 'string' ? data.moderationNote : '',
    lastOrderRef:
      typeof data.lastOrderRef === 'string' ? data.lastOrderRef : '',
    summary: String(data.summary || ''),
    highlights: Array.isArray(data.highlights)
      ? data.highlights.map((h) => String(h)).slice(0, 4)
      : [],
    deliveryNote: String(data.deliveryNote || 'Direct creator fulfillment'),
    featured: Boolean(data.featured),
    status: normalizedStatus,
    isSeed: false,
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

function parseCampaignDoc(
  id: string,
  data: Record<string, unknown>
): MarketingCampaign {
  return {
    id,
    authorId: String(data.authorId || ''),
    title: String(data.title || ''),
    description: String(data.description || ''),
    promoCode: String(data.promoCode || ''),
    discountPercent: Number(data.discountPercent || 10),
    minOrderCents: Number(data.minOrderCents || 0),
    channel: (data.channel as CampaignChannel) || 'Storefront Banner',
    featuredProductId: String(data.featuredProductId || ''),
    ctaLabel: String(data.ctaLabel || 'Apply Offer'),
    expiresLabel: String(data.expiresLabel || 'Limited Time'),
    status: (data.status as PublishStatus) || 'draft',
    isSeed: false,
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

function parseDirectOrderDoc(
  id: string,
  data: Record<string, unknown>
): DirectOrder {
  const totalCents = Number(data.totalCents || 0);
  const sellerId = String(data.sellerId || '');
  const fallbackFee =
    sellerId && sellerId !== 'editorial_desk' ? Math.round(totalCents * 0.1) : 0;
  const platformFeeCents =
    typeof data.platformFeeCents === 'number'
      ? data.platformFeeCents
      : fallbackFee;
  const sellerPayoutCents =
    typeof data.sellerPayoutCents === 'number'
      ? data.sellerPayoutCents
      : Math.max(0, totalCents - platformFeeCents);
  const rawPayoutStatus = String(data.payoutStatus || '');
  const payoutStatus: PayoutSettlementStatus =
    rawPayoutStatus === 'paid_out' ||
    rawPayoutStatus === 'pending' ||
    rawPayoutStatus === 'not_applicable'
      ? rawPayoutStatus
      : sellerId === 'editorial_desk'
      ? 'not_applicable'
      : 'pending';

  const rawPayMethod = String(data.paymentMethod || '') as CustomerPaymentMethod;
  const paymentMethod = VALID_CUSTOMER_PAYMENT_METHODS.includes(rawPayMethod)
    ? rawPayMethod
    : undefined;

  return {
    id,
    buyerId: String(data.buyerId || ''),
    sellerId,
    sellerName: String(
      data.sellerName ||
        (sellerId === 'editorial_desk' ? 'Pickras House Studio' : 'Creator Seller')
    ),
    orderNumber: String(data.orderNumber || id),
    buyerName: String(data.buyerName || ''),
    buyerEmail: String(data.buyerEmail || ''),
    shippingAddress: String(data.shippingAddress || ''),
    paymentMethod,
    paymentReference:
      typeof data.paymentReference === 'string' ? data.paymentReference : '',
    productIds: Array.isArray(data.productIds)
      ? data.productIds.map((item) => String(item)).slice(0, 8)
      : [],
    itemsSummary: String(data.itemsSummary || ''),
    itemCount: Number(data.itemCount || 1),
    fulfillmentType:
      (data.fulfillmentType as DirectOrder['fulfillmentType']) || 'physical',
    promoCode: String(data.promoCode || ''),
    subtotalCents: Number(data.subtotalCents || 0),
    discountCents: Number(data.discountCents || 0),
    shippingCents: Number(data.shippingCents || 0),
    totalCents,
    platformFeeCents,
    sellerPayoutCents,
    payoutStatus,
    sellerPayoutDetails: String(data.sellerPayoutDetails || ''),
    payoutNote: String(data.payoutNote || ''),
    fulfillmentNote: String(data.fulfillmentNote || ''),
    status: (data.status as OrderFulfillmentStatus) || 'paid',
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

function parseSiteConfigDoc(
  data: Record<string, unknown>,
  fallbackShowSeeds: boolean
): SiteConfig {
  const validTargets: AnnouncementTargetSection[] = [
    'store',
    'journal',
    'blog',
    'products',
    'services',
  ];
  const rawTarget = String(data.announcementTargetSection || 'store');
  const announcementTargetSection = validTargets.includes(
    rawTarget as AnnouncementTargetSection
  )
    ? (rawTarget as AnnouncementTargetSection)
    : 'store';

  const hiddenSeedIds = Array.isArray(data.hiddenSeedIds)
    ? data.hiddenSeedIds.map((s) => String(s)).slice(0, 50)
    : [];

  return {
    siteTagline: String(data.siteTagline || DEFAULT_SITE_TAGLINE),
    announcementEnabled: Boolean(data.announcementEnabled),
    announcementText: String(data.announcementText || ''),
    announcementCtaLabel: String(data.announcementCtaLabel || 'Shop Direct'),
    announcementTargetSection,
    freeShippingThresholdCents: Number(
      data.freeShippingThresholdCents ?? DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS
    ),
    flatShippingCents: Number(
      data.flatShippingCents ?? DEFAULT_FLAT_PHYSICAL_SHIPPING_CENTS
    ),
    defaultDisclosureText: String(
      data.defaultDisclosureText || DEFAULT_DISCLOSURE
    ),
    storeCheckoutEnabled:
      typeof data.storeCheckoutEnabled === 'boolean'
        ? data.storeCheckoutEnabled
        : true,
    blogEnabled:
      typeof data.blogEnabled === 'boolean' ? data.blogEnabled : true,
    storeEnabled:
      typeof data.storeEnabled === 'boolean' ? data.storeEnabled : true,
    productAffiliateEnabled:
      typeof data.productAffiliateEnabled === 'boolean'
        ? data.productAffiliateEnabled
        : true,
    serviceAffiliateEnabled:
      typeof data.serviceAffiliateEnabled === 'boolean'
        ? data.serviceAffiliateEnabled
        : true,
    showStarterSeeds:
      typeof data.showStarterSeeds === 'boolean'
        ? data.showStarterSeeds
        : fallbackShowSeeds,
    hiddenSeedIds,
    aboutMission:
      typeof data.aboutMission === 'string' && data.aboutMission.trim()
        ? data.aboutMission
        : DEFAULT_ABOUT_MISSION,
    aboutStory:
      typeof data.aboutStory === 'string' && data.aboutStory.trim()
        ? data.aboutStory
        : DEFAULT_ABOUT_STORY,
    contactEmail:
      typeof data.contactEmail === 'string' && data.contactEmail.trim()
        ? sanitizePublicContactEmail(data.contactEmail)
        : DEFAULT_CONTACT_EMAIL,
    contactPhone:
      typeof data.contactPhone === 'string'
        ? data.contactPhone
        : DEFAULT_CONTACT_PHONE,
    contactLocation:
      typeof data.contactLocation === 'string'
        ? data.contactLocation
        : DEFAULT_CONTACT_LOCATION,
    privacyPolicySummary:
      typeof data.privacyPolicySummary === 'string' &&
      data.privacyPolicySummary.trim()
        ? data.privacyPolicySummary
        : DEFAULT_PRIVACY_POLICY_SUMMARY,
    updatedBy: String(data.updatedBy || ''),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

const VALID_CONTACT_CATEGORIES: ContactIssueCategory[] = [
  'general',
  'order_support',
  'seller_payout',
  'affiliate_partnership',
  'privacy_issue',
];

const VALID_CONTACT_STATUSES: ContactMessageStatus[] = [
  'unread',
  'in_review',
  'resolved',
];

function parseContactMessageDoc(
  id: string,
  data: Record<string, unknown>
): ContactMessage {
  const rawCat = String(data.category || 'general') as ContactIssueCategory;
  const category: ContactIssueCategory = VALID_CONTACT_CATEGORIES.includes(rawCat)
    ? rawCat
    : 'general';
  const rawStatus = String(data.status || 'unread') as ContactMessageStatus;
  const status: ContactMessageStatus = VALID_CONTACT_STATUSES.includes(rawStatus)
    ? rawStatus
    : 'unread';

  return {
    id,
    senderId: String(data.senderId || ''),
    senderName: String(data.senderName || 'Visitor'),
    senderEmail: String(data.senderEmail || ''),
    category,
    orderNumber: typeof data.orderNumber === 'string' ? data.orderNumber : '',
    subject: String(data.subject || ''),
    message: String(data.message || ''),
    status,
    adminNote: typeof data.adminNote === 'string' ? data.adminNote : '',
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

function parseAnalyticsEventDoc(
  id: string,
  data: Record<string, unknown>
): AnalyticsEvent {
  return {
    id,
    actorId: String(data.actorId || ''),
    actorScope: data.actorScope === 'creator' ? 'creator' : 'customer',
    targetOwnerId: String(data.targetOwnerId || 'editorial_desk'),
    eventType: (data.eventType as AnalyticsEventType) || 'post_view',
    channel: (data.channel as AnalyticsChannel) || 'blog',
    targetId: String(data.targetId || ''),
    targetTitle: String(data.targetTitle || 'Item'),
    platform: String(data.platform || 'Pickras'),
    valueCents: Number(data.valueCents || 0),
    createdAtMs: timestampToMs(data.createdAt),
  };
}

function parseAdminDoc(id: string, data: Record<string, unknown>): AdminRecord {
  return {
    uid: String(data.uid || id),
    grantedBy: String(data.grantedBy || ''),
    createdAtMs: timestampToMs(data.createdAt),
  };
}

function sanitizeSafeId(raw: string, fallback = 'editorial_desk'): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  return cleaned.length >= 1 ? cleaned : fallback;
}

function isNonAnonymousUser(u: User | null): u is User {
  return Boolean(u && !u.isAnonymous);
}

interface PendingRegistrationSeed {
  fullName: string;
  asSeller: boolean;
  storeName: string;
  payoutMethod: SellerPayoutMethod;
  payoutProviderLabel: string;
  payoutAccount: string;
}

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('signup');
  const [authModalSellerPreset, setAuthModalSellerPreset] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [publicDataError, setPublicDataError] = useState<string | null>(null);
  const [publicRetryTick, setPublicRetryTick] = useState(0);
  const loadingData = loadingPosts || loadingProducts || loadingOffers;

  const [isCoAdmin, setIsCoAdmin] = useState(false);
  const [adminRoleReady, setAdminRoleReady] = useState(false);
  const [adminRegistry, setAdminRegistry] = useState<AdminRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  const bootstrapInFlightRef = useRef<Map<string, Promise<string>>>(new Map());
  const pendingRegSeedRef = useRef<PendingRegistrationSeed | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo | null>(null);

  const [firestoreSiteConfig, setFirestoreSiteConfig] =
    useState<SiteConfig | null>(null);

  const [publicFirestoreOffers, setPublicFirestoreOffers] = useState<AffiliateOffer[]>([]);
  const [publicFirestorePosts, setPublicFirestorePosts] = useState<BlogPost[]>([]);
  const [publicFirestoreProducts, setPublicFirestoreProducts] = useState<DirectProduct[]>([]);
  const [publicFirestoreCampaigns, setPublicFirestoreCampaigns] = useState<MarketingCampaign[]>([]);

  const [authorFirestoreOffers, setAuthorFirestoreOffers] = useState<AffiliateOffer[]>([]);
  const [authorFirestorePosts, setAuthorFirestorePosts] = useState<BlogPost[]>([]);
  const [ownSellerProducts, setOwnSellerProducts] = useState<DirectProduct[]>([]);
  const [adminAllProducts, setAdminAllProducts] = useState<DirectProduct[]>([]);
  const [authorFirestoreCampaigns, setAuthorFirestoreCampaigns] = useState<MarketingCampaign[]>([]);

  const [firestorePurchases, setFirestorePurchases] = useState<DirectOrder[]>([]);
  const [guestPurchases, setGuestPurchases] = useState<DirectOrder[]>(() => {
    try {
      const raw = localStorage.getItem(GUEST_ORDERS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as DirectOrder[]).slice(0, 30) : [];
    } catch {
      return [];
    }
  });
  const [deliveredDigitalCache, setDeliveredDigitalCache] = useState<
    Record<string, DeliveredDigitalAsset>
  >(() => {
    try {
      const raw = localStorage.getItem(DELIVERED_DIGITAL_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, DeliveredDigitalAsset>) : {};
    } catch {
      return {};
    }
  });
  const [seedStockOffsets, setSeedStockOffsets] = useState<Record<string, number>>(
    () => {
      try {
        const raw = localStorage.getItem(SEED_STOCK_OFFSETS_KEY);
        return raw ? (JSON.parse(raw) as Record<string, number>) : {};
      } catch {
        return {};
      }
    }
  );
  const [mySellerOrders, setMySellerOrders] = useState<DirectOrder[]>([]);
  const [adminAllOrders, setAdminAllOrders] = useState<DirectOrder[]>([]);
  const [firestoreAnalyticsEvents, setFirestoreAnalyticsEvents] = useState<
    AnalyticsEvent[]
  >([]);
  const [ownContactMessages, setOwnContactMessages] = useState<
    ContactMessage[]
  >([]);
  const [adminContactMessages, setAdminContactMessages] = useState<
    ContactMessage[]
  >([]);
  const [guestContactMessages, setGuestContactMessages] = useState<
    ContactMessage[]
  >([]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartInitialStep, setCartInitialStep] = useState<'bag' | 'checkout'>(
    'bag'
  );

  const sessionSeenViewsRef = useRef<Set<string>>(new Set());

  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (item) =>
            item &&
            typeof item.productId === 'string' &&
            typeof item.quantity === 'number' &&
            item.quantity > 0
        )
        .slice(0, 8);
    } catch {
      return [];
    }
  });

  const [appliedPromoCode, setAppliedPromoCode] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlPromo = params.get('promo');
      if (urlPromo) {
        return urlPromo.trim().toUpperCase().slice(0, 24);
      }
      return (localStorage.getItem(PROMO_STORAGE_KEY) || '').trim().toUpperCase();
    } catch {
      return '';
    }
  });

  const [hideSeeds, setHideSeeds] = useState<boolean>(() => {
    try {
      return localStorage.getItem(HIDE_SEEDS_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [localHiddenSeedIds, setLocalHiddenSeedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_SEED_IDS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String).slice(0, 50) : [];
    } catch {
      return [];
    }
  });

  const [localClickCounts, setLocalClickCounts] = useState<Record<string, number>>(
    () => {
      try {
        const raw = localStorage.getItem(CLICK_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }
  );

  const [localPostViews, setLocalPostViews] = useState<Record<string, number>>(
    () => {
      try {
        const raw = localStorage.getItem(POST_VIEWS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }
  );

  const [localBagAdds, setLocalBagAdds] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(BAG_ADDS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [adminUiPrefs, setAdminUiPrefs] = useState<AdminUiPrefsState>(() =>
    loadInitialAdminUiPrefs()
  );

  function updateAdminUiPrefs(
    updater: (prev: AdminUiPrefsState) => AdminUiPrefsState
  ) {
    setAdminUiPrefs((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(UI_PREFS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  }

  const isBootstrappedCreator = Boolean(
    user && user.emailVerified && isAuthorizedOwnerEmail(user.email)
  );

  const isCreatorAdmin = Boolean(
    isNonAnonymousUser(user) && (isBootstrappedCreator || isCoAdmin)
  );

  const isSellerSuspended = Boolean(profile?.sellerStatus === 'suspended');

  const isActiveSeller = useMemo(() => {
    if (!isNonAnonymousUser(user)) return false;
    if (isCreatorAdmin) return true;
    if (isSellerSuspended) return false;
    const hasStore =
      profile?.isSeller === true &&
      (profile.sellerStatus === 'active' || !profile.sellerStatus) &&
      (profile.storeName || '').trim().length >= 2;
    const hasPayout =
      Boolean(privateInfo?.payoutMethod && privateInfo.payoutMethod !== 'None') &&
      (privateInfo?.payoutAccount || '').trim().length >= 3;
    return Boolean(hasStore && hasPayout);
  }, [user, isCreatorAdmin, isSellerSuspended, profile, privateInfo]);

  const siteConfig: SiteConfig = useMemo(() => {
    const mergedHidden = Array.from(
      new Set([
        ...(firestoreSiteConfig?.hiddenSeedIds || []),
        ...(isCreatorAdmin ? localHiddenSeedIds : []),
      ])
    ).slice(0, 50);

    if (firestoreSiteConfig) {
      return {
        ...firestoreSiteConfig,
        hiddenSeedIds: mergedHidden,
      };
    }
    return {
      siteTagline: DEFAULT_SITE_TAGLINE,
      announcementEnabled: false,
      announcementText:
        'Free tracked courier shipping on Pickras Store physical orders over $95 · Use code PICKRAS15',
      announcementCtaLabel: 'Shop Direct',
      announcementTargetSection: 'store',
      freeShippingThresholdCents: DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS,
      flatShippingCents: DEFAULT_FLAT_PHYSICAL_SHIPPING_CENTS,
      defaultDisclosureText: DEFAULT_DISCLOSURE,
      storeCheckoutEnabled: true,
      blogEnabled: true,
      storeEnabled: true,
      productAffiliateEnabled: true,
      serviceAffiliateEnabled: true,
      showStarterSeeds: false,
      hiddenSeedIds: mergedHidden,
      aboutMission: DEFAULT_ABOUT_MISSION,
      aboutStory: DEFAULT_ABOUT_STORY,
      contactEmail: DEFAULT_CONTACT_EMAIL,
      contactPhone: DEFAULT_CONTACT_PHONE,
      contactLocation: DEFAULT_CONTACT_LOCATION,
      privacyPolicySummary: DEFAULT_PRIVACY_POLICY_SUMMARY,
      updatedBy: '',
      updatedAtMs: 0,
    };
  }, [firestoreSiteConfig, localHiddenSeedIds, isCreatorAdmin]);

  const hiddenSeedSet = useMemo(
    () => new Set(siteConfig.hiddenSeedIds || []),
    [siteConfig.hiddenSeedIds]
  );

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch {
      // ignore storage quota errors
    }
  }, [cartItems]);

  useEffect(() => {
    try {
      if (appliedPromoCode) {
        localStorage.setItem(PROMO_STORAGE_KEY, appliedPromoCode);
      } else {
        localStorage.removeItem(PROMO_STORAGE_KEY);
      }
    } catch {
      // ignore storage quota errors
    }
  }, [appliedPromoCode]);

  // Track Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Verify Co-Admin Role Membership on /admins/{uid}
  useEffect(() => {
    if (!authReady) return;
    if (!isNonAnonymousUser(user)) {
      setIsCoAdmin(false);
      setAdminRoleReady(true);
      return;
    }
    if (user.emailVerified && isAuthorizedOwnerEmail(user.email)) {
      setIsCoAdmin(false);
      setAdminRoleReady(true);
      return;
    }

    let cancelled = false;
    setAdminRoleReady(false);

    const ownAdminRef = doc(db, 'admins', user.uid);
    const unsubOwnAdmin = onSnapshot(
      ownAdminRef,
      (snap) => {
        if (!cancelled) {
          setIsCoAdmin(snap.exists());
          setAdminRoleReady(true);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `admins/${user.uid}`);
      }
    );

    return () => {
      cancelled = true;
      unsubOwnAdmin();
    };
  }, [authReady, user]);

  async function ensureUserBootstrapped(currentUser: User): Promise<string> {
    const existingPromise = bootstrapInFlightRef.current.get(currentUser.uid);
    if (existingPromise) {
      return existingPromise;
    }

    const runBootstrap = async (): Promise<string> => {
      const userPath = `users/${currentUser.uid}`;
      const privatePath = `users/${currentUser.uid}/private/info`;
      const regSeed = pendingRegSeedRef.current;
      pendingRegSeedRef.current = null;

      let resolvedName = 'Member';
      const hasValidSeedPayout = Boolean(
        regSeed?.payoutAccount &&
          regSeed.payoutAccount.trim().length >= 3 &&
          regSeed.payoutMethod &&
          regSeed.payoutMethod !== 'None'
      );

      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);

        const defaultName = (
          regSeed?.fullName ||
          currentUser.displayName ||
          currentUser.email?.split('@')[0] ||
          'Member'
        )
          .trim()
          .slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX);

        if (!userSnap.exists()) {
          const initialIsSeller = Boolean(regSeed?.asSeller && hasValidSeedPayout);
          const initialSellerStatus: SellerAccountStatus = initialIsSeller
            ? 'active'
            : regSeed?.asSeller
            ? 'pending'
            : 'inactive';
          const initialStoreName = regSeed?.asSeller
            ? (regSeed.storeName || defaultName)
                .trim()
                .slice(0, VALIDATION_LIMITS.STORE_NAME_MAX)
            : '';

          await setDoc(userRef, {
            uid: currentUser.uid,
            displayName: defaultName,
            bio: initialIsSeller
              ? 'Independent creator selling on Pickras Store.'
              : 'Pickras editorial & creator store member.',
            isSeller: initialIsSeller,
            sellerStatus: initialSellerStatus,
            storeName: initialStoreName,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          setProfile({
            uid: currentUser.uid,
            displayName: defaultName,
            bio: initialIsSeller
              ? 'Independent creator selling on Pickras Store.'
              : 'Pickras editorial & creator store member.',
            isSeller: initialIsSeller,
            sellerStatus: initialSellerStatus,
            storeName: initialStoreName,
          });
          resolvedName = initialStoreName || defaultName;
        } else {
          const d = userSnap.data();
          const existingSuspended = d.sellerStatus === 'suspended';
          const shouldPromoteSeller = Boolean(
            regSeed?.asSeller && hasValidSeedPayout && !d.isSeller && !existingSuspended
          );
          const nextStoreName = shouldPromoteSeller
            ? (regSeed?.storeName || String(d.storeName || d.displayName || defaultName))
                .trim()
                .slice(0, VALIDATION_LIMITS.STORE_NAME_MAX)
            : String(d.storeName || '');
          const nextSellerStatus: SellerAccountStatus = existingSuspended
            ? 'suspended'
            : shouldPromoteSeller
            ? 'active'
            : d.sellerStatus === 'active' ||
              d.sellerStatus === 'pending' ||
              d.sellerStatus === 'inactive'
            ? d.sellerStatus
            : d.isSeller
            ? 'active'
            : 'inactive';

          if (shouldPromoteSeller && nextStoreName.length >= 2) {
            await updateDoc(userRef, {
              isSeller: true,
              sellerStatus: 'active',
              storeName: nextStoreName,
              updatedAt: serverTimestamp(),
            });
          }
          const nextProfile: UserProfile = {
            uid: currentUser.uid,
            displayName: String(d.displayName || defaultName),
            bio: String(d.bio || ''),
            isSeller: Boolean((d.isSeller || shouldPromoteSeller) && !existingSuspended),
            sellerStatus: nextSellerStatus,
            storeName: nextStoreName,
          };
          setProfile(nextProfile);
          resolvedName = String(
            nextStoreName || d.displayName || defaultName
          ).slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err || '');
        if (msg.includes('client is offline') || msg.includes('unavailable')) {
          return (
            currentUser.displayName ||
            currentUser.email?.split('@')[0] ||
            'Member'
          )
            .trim()
            .slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX);
        }
        handleFirestoreError(err, OperationType.WRITE, userPath);
      }

      try {
        const privRef = doc(db, 'users', currentUser.uid, 'private', 'info');
        const privSnap = await getDoc(privRef);
        const safeEmail = (currentUser.email || 'member@example.com').slice(
          0,
          254
        );
        const defaultHolder = (
          regSeed?.fullName ||
          currentUser.displayName ||
          ''
        )
          .trim()
          .slice(0, 60);

        if (!privSnap.exists()) {
          const initMethod: SellerPayoutMethod =
            hasValidSeedPayout &&
            regSeed?.payoutMethod &&
            VALID_PAYOUT_METHODS.includes(regSeed.payoutMethod)
              ? regSeed.payoutMethod
              : 'None';
          const initAccount = hasValidSeedPayout
            ? (regSeed?.payoutAccount || '')
                .trim()
                .slice(0, VALIDATION_LIMITS.PAYOUT_ACCOUNT_MAX)
            : '';
          const initAccountsList: string[] =
            initAccount && initMethod !== 'None'
              ? [
                  serializePayoutAccount({
                    id: 'pay_primary',
                    method: initMethod,
                    providerLabel: regSeed?.payoutProviderLabel || initMethod,
                    accountHolder: defaultHolder,
                    accountNumber: initAccount,
                  }),
                ]
              : [];

          await setDoc(privRef, {
            uid: currentUser.uid,
            email: safeEmail,
            defaultAmazonTag: '',
            defaultDigistoreId: '',
            payoutMethod: initMethod,
            payoutAccount: initAccount,
            payoutAccounts: initAccountsList,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setPrivateInfo({
            uid: currentUser.uid,
            email: safeEmail,
            defaultAmazonTag: '',
            defaultDigistoreId: '',
            payoutMethod: initMethod,
            payoutAccount: initAccount,
            payoutAccounts: initAccountsList,
          });
        } else {
          const pd = privSnap.data();
          const rawMethod = String(
            pd.payoutMethod || 'None'
          ) as SellerPayoutMethod;
          const existingAccounts = Array.isArray(pd.payoutAccounts)
            ? pd.payoutAccounts.map(String).slice(0, 6)
            : [];
          let finalMethod: SellerPayoutMethod = VALID_PAYOUT_METHODS.includes(
            rawMethod
          )
            ? rawMethod
            : 'None';
          let finalAccount = String(pd.payoutAccount || '');
          let finalAccounts = existingAccounts;

          if (
            hasValidSeedPayout &&
            !finalAccount &&
            regSeed?.payoutMethod &&
            VALID_PAYOUT_METHODS.includes(regSeed.payoutMethod)
          ) {
            finalMethod = regSeed.payoutMethod;
            finalAccount = (regSeed.payoutAccount || '')
              .trim()
              .slice(0, VALIDATION_LIMITS.PAYOUT_ACCOUNT_MAX);
            finalAccounts = [
              serializePayoutAccount({
                id: 'pay_primary',
                method: finalMethod,
                providerLabel: regSeed.payoutProviderLabel || finalMethod,
                accountHolder: defaultHolder,
                accountNumber: finalAccount,
              }),
            ];
            await updateDoc(privRef, {
              payoutMethod: finalMethod,
              payoutAccount: finalAccount,
              payoutAccounts: finalAccounts,
              updatedAt: serverTimestamp(),
            });
          }

          setPrivateInfo({
            uid: currentUser.uid,
            email: String(pd.email || safeEmail),
            defaultAmazonTag: String(pd.defaultAmazonTag || ''),
            defaultDigistoreId: String(pd.defaultDigistoreId || ''),
            payoutMethod: finalMethod,
            payoutAccount: finalAccount,
            payoutAccounts: finalAccounts,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err || '');
        if (!msg.includes('client is offline') && !msg.includes('unavailable')) {
          handleFirestoreError(err, OperationType.WRITE, privatePath);
        }
      }

      try {
        const rawQueued = sessionStorage.getItem(PENDING_TELEMETRY_KEY);
        if (rawQueued) {
          sessionStorage.removeItem(PENDING_TELEMETRY_KEY);
          const parsedQueue = JSON.parse(rawQueued);
          if (Array.isArray(parsedQueue)) {
            const actorScope: 'customer' | 'creator' =
              currentUser.emailVerified &&
              isAuthorizedOwnerEmail(currentUser.email)
                ? 'creator'
                : 'customer';
            for (const item of parsedQueue.slice(0, 15)) {
              if (!item || typeof item !== 'object') continue;
              const eventId = generateSafeDocId('evt');
              await setDoc(doc(db, 'analyticsEvents', eventId), {
                actorId: currentUser.uid,
                actorScope,
                targetOwnerId: sanitizeSafeId(
                  String(item.targetOwnerId || 'editorial_desk')
                ),
                eventType: item.eventType || 'post_view',
                channel: item.channel || 'blog',
                targetId: sanitizeSafeId(String(item.targetId || 'item')),
                targetTitle: String(item.targetTitle || 'Pickras Item').slice(
                  0,
                  VALIDATION_LIMITS.EVENT_TITLE_MAX
                ),
                platform: String(item.platform || 'Pickras').slice(
                  0,
                  VALIDATION_LIMITS.EVENT_PLATFORM_MAX
                ),
                valueCents: Math.max(
                  0,
                  Math.min(50000000, Math.round(Number(item.valueCents) || 0))
                ),
                createdAt: serverTimestamp(),
              });
            }
          }
        }
      } catch {
        // ignore session queue parsing issues
      }

      return resolvedName;
    };

    const promise = runBootstrap().finally(() => {
      bootstrapInFlightRef.current.delete(currentUser.uid);
    });
    bootstrapInFlightRef.current.set(currentUser.uid, promise);
    return promise;
  }

  // Subscribe to own User Profile & Split Private Info in real time
  useEffect(() => {
    if (!authReady || !isNonAnonymousUser(user)) {
      setProfile(null);
      setPrivateInfo(null);
      return;
    }

    let cancelled = false;
    let unsubOwnProfile = () => {};

    void ensureUserBootstrapped(user)
      .then(() => {
        if (cancelled) return;
        unsubOwnProfile = onSnapshot(
          doc(db, 'users', user.uid),
          (snap) => {
            if (snap.exists() && !cancelled) {
              setProfile(
                parseUserProfileDoc(snap.id, snap.data() as Record<string, unknown>)
              );
            }
          },
          (err) => {
            handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
          }
        );
      })
      .catch((err) => {
        console.warn('User bootstrap warning:', err);
      });

    return () => {
      cancelled = true;
      unsubOwnProfile();
    };
  }, [authReady, user]);

  function retryPublicData() {
    setPublicDataError(null);
    setLoadingPosts(true);
    setLoadingProducts(true);
    setLoadingOffers(true);
    setPublicRetryTick((prev) => prev + 1);
  }

  // Public listeners: SiteConfig singleton, Published Offers, Posts, Direct Products, & Campaigns
  // Runs immediately on mount for all public visitors without waiting on Firebase Auth initialization.
  useEffect(() => {
    let cancelled = false;
    setPublicDataError(null);

    const siteConfigRef = doc(db, 'siteConfig', 'main');
    const publishedOffersQuery = query(
      collection(db, 'offers'),
      where('status', '==', 'published')
    );
    const publishedPostsQuery = query(
      collection(db, 'posts'),
      where('status', 'in', ['published', 'active'])
    );
    const publishedProductsQuery = query(
      collection(db, 'directProducts'),
      where('status', 'in', ['published', 'active', 'approved'])
    );
    const publishedCampaignsQuery = query(
      collection(db, 'campaigns'),
      where('status', '==', 'published')
    );

    const liteSiteConfigRef = liteDoc(liteDb, 'siteConfig', 'main');
    const liteOffersQuery = liteQuery(
      liteCollection(liteDb, 'offers'),
      liteWhere('status', '==', 'published')
    );
    const litePostsQuery = liteQuery(
      liteCollection(liteDb, 'posts'),
      liteWhere('status', 'in', ['published', 'active'])
    );
    const liteProductsQuery = liteQuery(
      liteCollection(liteDb, 'directProducts'),
      liteWhere('status', 'in', ['published', 'active', 'approved'])
    );
    const liteCampaignsQuery = liteQuery(
      liteCollection(liteDb, 'campaigns'),
      liteWhere('status', '==', 'published')
    );

    let siteConfigResolved = false;
    let offersResolved = false;
    let postsResolved = false;
    let productsResolved = false;
    let campaignsResolved = false;

    const formatPublicListenerError = (label: string, err: unknown) => {
      console.warn(`Public Firestore read notice (${label}):`, err);
      return `Unable to load ${label} from the Pickras database right now. Please check your connection and retry.`;
    };

    const fetchSiteConfigViaRest = () =>
      getLiteDoc(liteSiteConfigRef).then((snap) => {
        if (cancelled) return;
        siteConfigResolved = true;
        if (snap.exists()) {
          setFirestoreSiteConfig(
            parseSiteConfigDoc(snap.data() as Record<string, unknown>, false)
          );
        } else {
          setFirestoreSiteConfig(null);
        }
      });

    const fetchOffersViaRest = () =>
      getLiteDocs(liteOffersQuery).then((snap) => {
        if (cancelled) return;
        offersResolved = true;
        const items = snap.docs.map((d) =>
          parseOfferDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setPublicFirestoreOffers(items);
        setLoadingOffers(false);
      });

    const fetchPostsViaRest = () =>
      getLiteDocs(litePostsQuery).then((snap) => {
        if (cancelled) return;
        postsResolved = true;
        const items = snap.docs.map((d) =>
          parsePostDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setPublicFirestorePosts(items);
        setLoadingPosts(false);
      });

    const fetchProductsViaRest = () =>
      getLiteDocs(liteProductsQuery).then((snap) => {
        if (cancelled) return;
        productsResolved = true;
        const items = snap.docs.map((d) =>
          parseDirectProductDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setPublicFirestoreProducts(items);
        setLoadingProducts(false);
      });

    const fetchCampaignsViaRest = () =>
      getLiteDocs(liteCampaignsQuery).then((snap) => {
        if (cancelled) return;
        campaignsResolved = true;
        const items = snap.docs.map((d) =>
          parseCampaignDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setPublicFirestoreCampaigns(items);
      });

    // Fast stateless HTTPS REST backup if WebChannel long-polling takes >2.5s on a restricted network
    const restFallbackTimer = window.setTimeout(() => {
      if (cancelled) return;
      if (!siteConfigResolved) {
        void fetchSiteConfigViaRest().catch(() => {});
      }
      if (!offersResolved) {
        void fetchOffersViaRest().catch(() => {});
      }
      if (!postsResolved) {
        void fetchPostsViaRest().catch(() => {});
      }
      if (!productsResolved) {
        void fetchProductsViaRest().catch(() => {});
      }
      if (!campaignsResolved) {
        void fetchCampaignsViaRest().catch(() => {});
      }
    }, 2500);

    const unsubSiteConfig = onSnapshot(
      siteConfigRef,
      (snap) => {
        if (cancelled) return;
        siteConfigResolved = true;
        if (snap.exists()) {
          setFirestoreSiteConfig(
            parseSiteConfigDoc(snap.data() as Record<string, unknown>, false)
          );
        } else {
          setFirestoreSiteConfig(null);
        }
      },
      () => {
        void fetchSiteConfigViaRest().catch(() => {
          // keep default site configuration if unreachable
        });
      }
    );

    const unsubOffers = onSnapshot(
      publishedOffersQuery,
      (snap) => {
        if (cancelled) return;
        offersResolved = true;
        const items = snap.docs.map((d) =>
          parseOfferDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setPublicFirestoreOffers(items);
        setLoadingOffers(false);
      },
      (err) => {
        void fetchOffersViaRest().catch((fallbackErr) => {
          if (cancelled) return;
          setPublicDataError(
            formatPublicListenerError('partner offers', fallbackErr || err)
          );
          setLoadingOffers(false);
        });
      }
    );

    const unsubPosts = onSnapshot(
      publishedPostsQuery,
      (snap) => {
        if (cancelled) return;
        postsResolved = true;
        const items = snap.docs.map((d) =>
          parsePostDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setPublicFirestorePosts(items);
        setLoadingPosts(false);
      },
      (err) => {
        void fetchPostsViaRest().catch((fallbackErr) => {
          if (cancelled) return;
          setPublicDataError(
            formatPublicListenerError('blog articles', fallbackErr || err)
          );
          setLoadingPosts(false);
        });
      }
    );

    const unsubProducts = onSnapshot(
      publishedProductsQuery,
      (snap) => {
        if (cancelled) return;
        productsResolved = true;
        const items = snap.docs.map((d) =>
          parseDirectProductDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setPublicFirestoreProducts(items);
        setLoadingProducts(false);
      },
      (err) => {
        void fetchProductsViaRest().catch((fallbackErr) => {
          if (cancelled) return;
          setPublicDataError(
            formatPublicListenerError('store products', fallbackErr || err)
          );
          setLoadingProducts(false);
        });
      }
    );

    const unsubCampaigns = onSnapshot(
      publishedCampaignsQuery,
      (snap) => {
        if (cancelled) return;
        campaignsResolved = true;
        const items = snap.docs.map((d) =>
          parseCampaignDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setPublicFirestoreCampaigns(items);
      },
      () => {
        void fetchCampaignsViaRest().catch(() => {
          // campaigns are optional promotional banners
        });
      }
    );

    return () => {
      cancelled = true;
      window.clearTimeout(restFallbackTimer);
      unsubSiteConfig();
      unsubOffers();
      unsubPosts();
      unsubProducts();
      unsubCampaigns();
    };
  }, [publicRetryTick]);

  // Authenticated Customer Purchases + Creator Seller Hub + Website Owner Backend Listeners
  useEffect(() => {
    if (!authReady || !isNonAnonymousUser(user)) {
      setAuthorFirestoreOffers([]);
      setAuthorFirestorePosts([]);
      setOwnSellerProducts([]);
      setAdminAllProducts([]);
      setAuthorFirestoreCampaigns([]);
      setFirestorePurchases([]);
      setMySellerOrders([]);
      setAdminAllOrders([]);
      setFirestoreAnalyticsEvents([]);
      setAdminRegistry([]);
      setAllUsers([]);
      setOwnContactMessages([]);
      setAdminContactMessages([]);
      return;
    }

    const buyerOrdersQuery = query(
      collection(db, 'directOrders'),
      where('buyerId', '==', user.uid)
    );
    const unsubBuyerOrders = onSnapshot(
      buyerOrdersQuery,
      (snap) => {
        const items = snap.docs.map((d) =>
          parseDirectOrderDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setFirestorePurchases(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'directOrders');
      }
    );

    const ownProductsQuery = query(
      collection(db, 'directProducts'),
      where('sellerId', '==', user.uid)
    );
    const unsubOwnProducts = onSnapshot(
      ownProductsQuery,
      (snap) => {
        const items = snap.docs.map((d) =>
          parseDirectProductDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setOwnSellerProducts(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'directProducts');
      }
    );

    const ownIncomingOrdersQuery = query(
      collection(db, 'directOrders'),
      where('sellerId', '==', user.uid)
    );
    const unsubOwnSellerOrders = onSnapshot(
      ownIncomingOrdersQuery,
      (snap) => {
        const items = snap.docs.map((d) =>
          parseDirectOrderDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setMySellerOrders(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'directOrders');
      }
    );

    const ownMessagesQuery = query(
      collection(db, 'contactMessages'),
      where('senderId', '==', user.uid)
    );
    const unsubOwnMessages = onSnapshot(
      ownMessagesQuery,
      (snap) => {
        const items = snap.docs.map((d) =>
          parseContactMessageDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setOwnContactMessages(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'contactMessages');
      }
    );

    if (!isCreatorAdmin) {
      setAuthorFirestoreOffers([]);
      setAuthorFirestorePosts([]);
      setAdminAllProducts([]);
      setAuthorFirestoreCampaigns([]);
      setAdminAllOrders([]);
      setFirestoreAnalyticsEvents([]);
      setAdminRegistry([]);
      setAllUsers([]);
      setAdminContactMessages([]);
      return () => {
        unsubBuyerOrders();
        unsubOwnProducts();
        unsubOwnSellerOrders();
        unsubOwnMessages();
      };
    }

    const offersQuery = isBootstrappedCreator
      ? collection(db, 'offers')
      : query(collection(db, 'offers'), where('authorId', '==', user.uid));

    const postsQuery = isBootstrappedCreator
      ? collection(db, 'posts')
      : query(collection(db, 'posts'), where('authorId', '==', user.uid));

    const campaignsQuery = isBootstrappedCreator
      ? collection(db, 'campaigns')
      : query(collection(db, 'campaigns'), where('authorId', '==', user.uid));

    const analyticsQuery = isBootstrappedCreator
      ? collection(db, 'analyticsEvents')
      : query(
          collection(db, 'analyticsEvents'),
          where('targetOwnerId', '==', user.uid)
        );

    const adminsQuery = isBootstrappedCreator
      ? collection(db, 'admins')
      : query(collection(db, 'admins'), where('grantedBy', '==', user.uid));

    const unsubOffers = onSnapshot(
      offersQuery,
      (snap) => {
        const items = snap.docs.map((d) =>
          parseOfferDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setAuthorFirestoreOffers(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'offers');
      }
    );

    const unsubPosts = onSnapshot(
      postsQuery,
      (snap) => {
        const items = snap.docs.map((d) =>
          parsePostDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setAuthorFirestorePosts(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'posts');
      }
    );

    const unsubCampaigns = onSnapshot(
      campaignsQuery,
      (snap) => {
        const items = snap.docs.map((d) =>
          parseCampaignDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setAuthorFirestoreCampaigns(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'campaigns');
      }
    );

    const unsubAnalytics = onSnapshot(
      analyticsQuery,
      (snap) => {
        const items = snap.docs.map((d) =>
          parseAnalyticsEventDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setFirestoreAnalyticsEvents(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'analyticsEvents');
      }
    );

    const unsubAdmins = onSnapshot(
      adminsQuery,
      (snap) => {
        const items = snap.docs.map((d) =>
          parseAdminDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setAdminRegistry(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'admins');
      }
    );

    let unsubAdminProducts = () => {};
    let unsubAdminOrders = () => {};
    let unsubAdminUsers = () => {};
    let unsubAdminMessages = () => {};

    if (isBootstrappedCreator) {
      unsubAdminProducts = onSnapshot(
        collection(db, 'directProducts'),
        (snap) => {
          const items = snap.docs.map((d) =>
            parseDirectProductDoc(d.id, d.data() as Record<string, unknown>)
          );
          items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
          setAdminAllProducts(items);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'directProducts');
        }
      );

      unsubAdminOrders = onSnapshot(
        collection(db, 'directOrders'),
        (snap) => {
          const items = snap.docs.map((d) =>
            parseDirectOrderDoc(d.id, d.data() as Record<string, unknown>)
          );
          items.sort((a, b) => b.createdAtMs - a.createdAtMs);
          setAdminAllOrders(items);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'directOrders');
        }
      );

      unsubAdminUsers = onSnapshot(
        collection(db, 'users'),
        (snap) => {
          const items = snap.docs.map((d) =>
            parseUserProfileDoc(d.id, d.data() as Record<string, unknown>)
          );
          items.sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
          setAllUsers(items);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'users');
        }
      );

      unsubAdminMessages = onSnapshot(
        collection(db, 'contactMessages'),
        (snap) => {
          const items = snap.docs.map((d) =>
            parseContactMessageDoc(d.id, d.data() as Record<string, unknown>)
          );
          items.sort((a, b) => b.createdAtMs - a.createdAtMs);
          setAdminContactMessages(items);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'contactMessages');
        }
      );
    }

    return () => {
      unsubBuyerOrders();
      unsubOwnProducts();
      unsubOwnSellerOrders();
      unsubOwnMessages();
      unsubOffers();
      unsubPosts();
      unsubCampaigns();
      unsubAnalytics();
      unsubAdmins();
      unsubAdminProducts();
      unsubAdminOrders();
      unsubAdminUsers();
      unsubAdminMessages();
    };
  }, [authReady, user, isCreatorAdmin, isBootstrappedCreator]);

  const hasFirestoreContent =
    publicFirestoreOffers.length > 0 ||
    publicFirestorePosts.length > 0 ||
    publicFirestoreProducts.length > 0 ||
    publicFirestoreCampaigns.length > 0 ||
    authorFirestoreOffers.length > 0 ||
    authorFirestorePosts.length > 0 ||
    ownSellerProducts.length > 0 ||
    adminAllProducts.length > 0 ||
    authorFirestoreCampaigns.length > 0;

  const includeSeeds = siteConfig.showStarterSeeds;

  const publishedOffers = useMemo(() => {
    const map = new Map<string, AffiliateOffer>();
    for (const offer of publicFirestoreOffers) {
      if (!hiddenSeedSet.has(offer.id)) {
        map.set(offer.id, offer);
      }
    }
    if (includeSeeds) {
      for (const seed of SEED_OFFERS) {
        if (!map.has(seed.id) && !hiddenSeedSet.has(seed.id)) {
          map.set(seed.id, seed);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [publicFirestoreOffers, includeSeeds, hiddenSeedSet]);

  const publishedPosts = useMemo(() => {
    const map = new Map<string, BlogPost>();
    for (const post of publicFirestorePosts) {
      if (!hiddenSeedSet.has(post.id)) {
        map.set(post.id, post);
      }
    }
    if (includeSeeds) {
      for (const seed of SEED_POSTS) {
        if (!map.has(seed.id) && !hiddenSeedSet.has(seed.id)) {
          map.set(seed.id, seed);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return b.updatedAtMs - a.updatedAtMs;
    });
  }, [publicFirestorePosts, includeSeeds, hiddenSeedSet]);

  const publishedDirectProducts = useMemo(() => {
    const map = new Map<string, DirectProduct>();
    for (const prod of publicFirestoreProducts) {
      if (
        !hiddenSeedSet.has(prod.id) &&
        (!prod.approvalStatus || prod.approvalStatus === 'approved')
      ) {
        map.set(prod.id, prod);
      }
    }
    if (includeSeeds) {
      for (const seed of SEED_DIRECT_PRODUCTS) {
        if (!map.has(seed.id) && !hiddenSeedSet.has(seed.id)) {
          const offset = seedStockOffsets[seed.id] || 0;
          map.set(seed.id, {
            ...seed,
            approvalStatus: 'approved',
            hasDigitalAsset: seed.kind === 'digital',
            stockCount:
              seed.kind === 'physical'
                ? Math.max(0, seed.stockCount - offset)
                : seed.stockCount,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return b.updatedAtMs - a.updatedAtMs;
    });
  }, [publicFirestoreProducts, includeSeeds, hiddenSeedSet, seedStockOffsets]);

  const publishedCampaigns = useMemo(() => {
    const map = new Map<string, MarketingCampaign>();
    for (const camp of publicFirestoreCampaigns) {
      if (!hiddenSeedSet.has(camp.id)) {
        map.set(camp.id, camp);
      }
    }
    if (includeSeeds) {
      for (const seed of SEED_CAMPAIGNS) {
        if (!map.has(seed.id) && !hiddenSeedSet.has(seed.id)) {
          map.set(seed.id, seed);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [publicFirestoreCampaigns, includeSeeds, hiddenSeedSet]);

  const studioOffers = useMemo(() => {
    const map = new Map<string, AffiliateOffer>();
    for (const offer of authorFirestoreOffers) {
      if (!hiddenSeedSet.has(offer.id)) {
        map.set(offer.id, offer);
      }
    }
    for (const offer of publicFirestoreOffers) {
      if (!map.has(offer.id) && !hiddenSeedSet.has(offer.id)) {
        map.set(offer.id, offer);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [authorFirestoreOffers, publicFirestoreOffers, hiddenSeedSet]);

  const studioPosts = useMemo(() => {
    const map = new Map<string, BlogPost>();
    for (const post of authorFirestorePosts) {
      if (!hiddenSeedSet.has(post.id)) {
        map.set(post.id, post);
      }
    }
    for (const post of publicFirestorePosts) {
      if (!map.has(post.id) && !hiddenSeedSet.has(post.id)) {
        map.set(post.id, post);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [authorFirestorePosts, publicFirestorePosts, hiddenSeedSet]);

  const studioDirectProducts = useMemo(() => {
    const map = new Map<string, DirectProduct>();
    for (const prod of adminAllProducts) {
      if (!hiddenSeedSet.has(prod.id)) {
        map.set(prod.id, prod);
      }
    }
    for (const prod of ownSellerProducts) {
      if (!hiddenSeedSet.has(prod.id)) {
        map.set(prod.id, prod);
      }
    }
    for (const prod of publicFirestoreProducts) {
      if (!map.has(prod.id) && !hiddenSeedSet.has(prod.id)) {
        map.set(prod.id, prod);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [adminAllProducts, ownSellerProducts, publicFirestoreProducts, hiddenSeedSet]);

  const effectiveMySellerProducts = useMemo(() => {
    if (!isNonAnonymousUser(user)) return [];
    return ownSellerProducts
      .filter((prod) => !hiddenSeedSet.has(prod.id) && prod.sellerId === user.uid)
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [ownSellerProducts, hiddenSeedSet, user]);

  const myPurchases = useMemo(() => {
    const map = new Map<string, DirectOrder>();
    for (const ord of firestorePurchases) {
      map.set(ord.id, ord);
    }
    for (const guestOrd of guestPurchases) {
      if (!map.has(guestOrd.id)) {
        map.set(guestOrd.id, guestOrd);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [firestorePurchases, guestPurchases]);

  const sellerOrders = useMemo(() => {
    const map = new Map<string, DirectOrder>();
    for (const ord of adminAllOrders) {
      map.set(ord.id, ord);
    }
    for (const ord of mySellerOrders) {
      map.set(ord.id, ord);
    }
    return Array.from(map.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [adminAllOrders, mySellerOrders]);

  const studioCampaigns = useMemo(() => {
    const map = new Map<string, MarketingCampaign>();
    for (const camp of authorFirestoreCampaigns) {
      if (!hiddenSeedSet.has(camp.id)) {
        map.set(camp.id, camp);
      }
    }
    for (const camp of publicFirestoreCampaigns) {
      if (!map.has(camp.id) && !hiddenSeedSet.has(camp.id)) {
        map.set(camp.id, camp);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [authorFirestoreCampaigns, publicFirestoreCampaigns, hiddenSeedSet]);

  const allAccessibleOffersMap = useMemo(() => {
    const record: Record<string, AffiliateOffer> = {};
    for (const seed of SEED_OFFERS) {
      if (!hiddenSeedSet.has(seed.id)) {
        record[seed.id] = seed;
      }
    }
    for (const pub of publicFirestoreOffers) {
      if (!hiddenSeedSet.has(pub.id)) {
        record[pub.id] = pub;
      }
    }
    for (const own of authorFirestoreOffers) {
      if (!hiddenSeedSet.has(own.id)) {
        record[own.id] = own;
      }
    }
    return record;
  }, [publicFirestoreOffers, authorFirestoreOffers, hiddenSeedSet]);

  const allAccessiblePostsMap = useMemo(() => {
    const record: Record<string, BlogPost> = {};
    for (const seed of SEED_POSTS) {
      if (!hiddenSeedSet.has(seed.id)) {
        record[seed.id] = seed;
      }
    }
    for (const pub of publicFirestorePosts) {
      if (!hiddenSeedSet.has(pub.id)) {
        record[pub.id] = pub;
      }
    }
    for (const own of authorFirestorePosts) {
      if (!hiddenSeedSet.has(own.id)) {
        record[own.id] = own;
      }
    }
    return record;
  }, [publicFirestorePosts, authorFirestorePosts, hiddenSeedSet]);

  const allAccessibleDirectProductsMap = useMemo(() => {
    const record: Record<string, DirectProduct> = {};
    for (const seed of SEED_DIRECT_PRODUCTS) {
      if (!hiddenSeedSet.has(seed.id)) {
        const offset = seedStockOffsets[seed.id] || 0;
        record[seed.id] = {
          ...seed,
          approvalStatus: 'approved',
          hasDigitalAsset: seed.kind === 'digital',
          stockCount:
            seed.kind === 'physical'
              ? Math.max(0, seed.stockCount - offset)
              : seed.stockCount,
        };
      }
    }
    for (const pub of publicFirestoreProducts) {
      if (!hiddenSeedSet.has(pub.id)) {
        record[pub.id] = pub;
      }
    }
    for (const own of ownSellerProducts) {
      if (!hiddenSeedSet.has(own.id)) {
        record[own.id] = own;
      }
    }
    for (const adm of adminAllProducts) {
      if (!hiddenSeedSet.has(adm.id)) {
        record[adm.id] = adm;
      }
    }
    return record;
  }, [
    publicFirestoreProducts,
    ownSellerProducts,
    adminAllProducts,
    hiddenSeedSet,
    seedStockOffsets,
  ]);

  const clickCounts = useMemo(() => {
    const fsCounts: Record<string, number> = {};
    for (const evt of firestoreAnalyticsEvents) {
      if (evt.eventType === 'affiliate_click') {
        fsCounts[evt.targetId] = (fsCounts[evt.targetId] || 0) + 1;
      }
    }
    const merged: Record<string, number> = { ...localClickCounts };
    for (const [id, count] of Object.entries(fsCounts)) {
      merged[id] = Math.max(merged[id] || 0, count);
    }
    return merged;
  }, [firestoreAnalyticsEvents, localClickCounts]);

  const postViewCounts = useMemo(() => {
    const fsCounts: Record<string, number> = {};
    for (const evt of firestoreAnalyticsEvents) {
      if (evt.eventType === 'post_view') {
        fsCounts[evt.targetId] = (fsCounts[evt.targetId] || 0) + 1;
      }
    }
    const merged: Record<string, number> = { ...localPostViews };
    for (const [id, count] of Object.entries(fsCounts)) {
      merged[id] = Math.max(merged[id] || 0, count);
    }
    return merged;
  }, [firestoreAnalyticsEvents, localPostViews]);

  const productBagCounts = useMemo(() => {
    const fsCounts: Record<string, number> = {};
    for (const evt of firestoreAnalyticsEvents) {
      if (evt.eventType === 'bag_add') {
        fsCounts[evt.targetId] = (fsCounts[evt.targetId] || 0) + 1;
      }
    }
    const merged: Record<string, number> = { ...localBagAdds };
    for (const [id, count] of Object.entries(fsCounts)) {
      merged[id] = Math.max(merged[id] || 0, count);
    }
    return merged;
  }, [firestoreAnalyticsEvents, localBagAdds]);

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const cartSubtotalCents = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const prod = allAccessibleDirectProductsMap[item.productId];
      if (!prod) return sum;
      return sum + prod.priceCents * item.quantity;
    }, 0);
  }, [cartItems, allAccessibleDirectProductsMap]);

  const cartRequiresShipping = useMemo(() => {
    return cartItems.some((item) => {
      const prod = allAccessibleDirectProductsMap[item.productId];
      return prod?.kind === 'physical';
    });
  }, [cartItems, allAccessibleDirectProductsMap]);

  const appliedCampaign = useMemo(() => {
    if (!appliedPromoCode) return null;
    const match = publishedCampaigns.find(
      (c) => c.promoCode.toUpperCase() === appliedPromoCode.toUpperCase()
    );
    return match || null;
  }, [appliedPromoCode, publishedCampaigns]);

  const cartDiscountCents = useMemo(() => {
    if (!appliedCampaign || cartSubtotalCents <= 0) return 0;
    if (cartSubtotalCents < appliedCampaign.minOrderCents) return 0;
    return Math.round((cartSubtotalCents * appliedCampaign.discountPercent) / 100);
  }, [appliedCampaign, cartSubtotalCents]);

  const cartShippingCents = useMemo(() => {
    if (!cartRequiresShipping || cartSubtotalCents <= 0) return 0;
    const afterDiscount = Math.max(0, cartSubtotalCents - cartDiscountCents);
    return afterDiscount >= siteConfig.freeShippingThresholdCents
      ? 0
      : siteConfig.flatShippingCents;
  }, [
    cartRequiresShipping,
    cartSubtotalCents,
    cartDiscountCents,
    siteConfig.freeShippingThresholdCents,
    siteConfig.flatShippingCents,
  ]);

  const cartTotalCents = useMemo(() => {
    return Math.max(0, cartSubtotalCents - cartDiscountCents + cartShippingCents);
  }, [cartSubtotalCents, cartDiscountCents, cartShippingCents]);

  async function ensureParentUserProfileExists(currentUser: User): Promise<string> {
    const bootstrappedName = await ensureUserBootstrapped(currentUser);
    return (
      profile?.storeName ||
      profile?.displayName ||
      bootstrappedName ||
      currentUser.displayName ||
      currentUser.email?.split('@')[0] ||
      'Creator'
    )
      .trim()
      .slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX);
  }

  async function persistTelemetryEvent(payload: PendingTelemetryPayload) {
    const cleanTargetId = sanitizeSafeId(payload.targetId, 'item');
    const cleanOwnerId = sanitizeSafeId(payload.targetOwnerId, 'editorial_desk');
    const cleanTitle = (payload.targetTitle.trim() || 'Pickras Item').slice(
      0,
      VALIDATION_LIMITS.EVENT_TITLE_MAX
    );
    const cleanPlatform = (payload.platform.trim() || 'Pickras').slice(
      0,
      VALIDATION_LIMITS.EVENT_PLATFORM_MAX
    );
    const cleanValueCents = Math.max(
      0,
      Math.min(50000000, Math.round(Number(payload.valueCents) || 0))
    );

    if (!isNonAnonymousUser(user)) {
      try {
        const raw = sessionStorage.getItem(PENDING_TELEMETRY_KEY);
        const existingQueue: PendingTelemetryPayload[] = raw
          ? JSON.parse(raw)
          : [];
        const nextQueue = [
          ...existingQueue.slice(-19),
          {
            targetOwnerId: cleanOwnerId,
            eventType: payload.eventType,
            channel: payload.channel,
            targetId: cleanTargetId,
            targetTitle: cleanTitle,
            platform: cleanPlatform,
            valueCents: cleanValueCents,
          },
        ];
        sessionStorage.setItem(PENDING_TELEMETRY_KEY, JSON.stringify(nextQueue));
      } catch {
        // ignore storage errors
      }
      return;
    }

    const eventId = generateSafeDocId('evt');
    const path = `analyticsEvents/${eventId}`;
    const actorScope: 'customer' | 'creator' = isCreatorAdmin
      ? 'creator'
      : 'customer';

    try {
      await ensureParentUserProfileExists(user);
      await setDoc(doc(db, 'analyticsEvents', eventId), {
        actorId: user.uid,
        actorScope,
        targetOwnerId: cleanOwnerId,
        eventType: payload.eventType,
        channel: payload.channel,
        targetId: cleanTargetId,
        targetTitle: cleanTitle,
        platform: cleanPlatform,
        valueCents: cleanValueCents,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }

  function addToCart(productId: string, quantity = 1, openDrawer = true) {
    const product = allAccessibleDirectProductsMap[productId];
    if (!product || product.stockCount <= 0 || product.status !== 'published') return;

    setCartItems((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        const nextQty = Math.min(
          product.stockCount,
          Math.min(20, existing.quantity + quantity)
        );
        return prev.map((i) =>
          i.productId === productId ? { ...i, quantity: nextQty } : i
        );
      }
      if (prev.length >= 8) {
        return prev;
      }
      return [
        ...prev,
        {
          productId,
          quantity: Math.min(product.stockCount, Math.max(1, quantity)),
        },
      ];
    });

    setLocalBagAdds((prev) => {
      const next = { ...prev, [productId]: (prev[productId] || 0) + 1 };
      try {
        localStorage.setItem(BAG_ADDS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });

    void persistTelemetryEvent({
      targetOwnerId: product.sellerId || 'editorial_desk',
      eventType: 'bag_add',
      channel: 'store',
      targetId: product.id,
      targetTitle: product.title,
      platform: 'Pickras Store',
      valueCents: product.priceCents * Math.max(1, quantity),
    });

    if (openDrawer) {
      setIsCartOpen(true);
    }
  }

  function buyNowProduct(productId: string, quantity = 1) {
    const product = allAccessibleDirectProductsMap[productId];
    if (!product || product.stockCount <= 0 || product.status !== 'published') return;
    setCartInitialStep('checkout');
    addToCart(productId, quantity, true);
  }

  function updateCartQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    const product = allAccessibleDirectProductsMap[productId];
    const maxAllowed = product ? Math.min(20, Math.max(1, product.stockCount)) : 20;
    setCartItems((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, quantity: Math.min(maxAllowed, quantity) }
          : i
      )
    );
  }

  function removeFromCart(productId: string) {
    setCartItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function clearCart() {
    setCartItems([]);
  }

  function applyPromoCode(rawCode: string): { ok: boolean; message: string } {
    const cleaned = rawCode.trim().toUpperCase();
    if (!cleaned) {
      setAppliedPromoCode('');
      return { ok: false, message: 'Enter a promo code to apply.' };
    }
    const found = publishedCampaigns.find(
      (c) => c.promoCode.toUpperCase() === cleaned
    );
    if (!found) {
      return {
        ok: false,
        message: `Promo code "${cleaned}" was not found or has expired.`,
      };
    }
    setAppliedPromoCode(found.promoCode);

    const dedupeKey = `promo_${found.id}`;
    if (!sessionSeenViewsRef.current.has(dedupeKey)) {
      sessionSeenViewsRef.current.add(dedupeKey);
      void persistTelemetryEvent({
        targetOwnerId: found.authorId || 'editorial_desk',
        eventType: 'promo_apply',
        channel: 'campaigns',
        targetId: found.id,
        targetTitle: `${found.promoCode} (${found.discountPercent}% off)`,
        platform: found.channel,
        valueCents: found.minOrderCents,
      });
    }

    if (cartSubtotalCents > 0 && cartSubtotalCents < found.minOrderCents) {
      return {
        ok: true,
        message: `Code ${found.promoCode} saved! Add $${(
          (found.minOrderCents - cartSubtotalCents) /
          100
        ).toFixed(2)} more to unlock ${found.discountPercent}% off.`,
      };
    }
    return {
      ok: true,
      message: `Applied ${found.promoCode} for ${found.discountPercent}% off your order.`,
    };
  }

  function clearPromoCode() {
    setAppliedPromoCode('');
  }

  function clearAuthError() {
    setAuthError(null);
  }

  function openAuthModal(mode: AuthModalMode = 'signup', sellerPreset = false) {
    setAuthError(null);
    setAuthModalMode(mode);
    setAuthModalSellerPreset(sellerPreset);
    setIsAuthModalOpen(true);
  }

  function closeAuthModal() {
    setIsAuthModalOpen(false);
    setAuthError(null);
  }

  async function signInWithGoogle(seed?: GoogleSignInSeed): Promise<boolean> {
    setAuthBusy(true);
    setAuthError(null);
    if (seed && (seed.asSeller || (seed.payoutAccount && seed.payoutAccount.trim()))) {
      pendingRegSeedRef.current = {
        fullName: seed.accountHolder || '',
        asSeller: Boolean(seed.asSeller),
        storeName: (seed.storeName || '').trim().slice(0, VALIDATION_LIMITS.STORE_NAME_MAX),
        payoutMethod: seed.payoutMethod || 'Telebirr',
        payoutProviderLabel: (seed.payoutProviderLabel || seed.payoutMethod || 'Telebirr').trim(),
        payoutAccount: (seed.payoutAccount || '')
          .trim()
          .slice(0, VALIDATION_LIMITS.PAYOUT_ACCOUNT_MAX),
      };
    } else {
      pendingRegSeedRef.current = null;
    }
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await ensureUserBootstrapped(cred.user);
      setIsAuthModalOpen(false);
      return true;
    } catch (err) {
      pendingRegSeedRef.current = null;
      const friendly = formatFirebaseAuthError(err);
      setAuthError(friendly);
      setIsAuthModalOpen(true);
      return false;
    } finally {
      setAuthBusy(false);
    }
  }

  async function registerWithEmailPassword(
    input: EmailRegistrationInput
  ): Promise<boolean> {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const cleanName = input.fullName
        .trim()
        .slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX);
      if (cleanName.length < 2) {
        throw new Error('Please enter your name (at least 2 characters).');
      }
      const cleanEmail = input.email.trim().slice(0, 254);
      if (!cleanEmail.includes('@') || cleanEmail.length < 5) {
        throw new Error('Please enter a valid email address.');
      }
      if (input.password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }
      if (input.asSeller) {
        const cleanStore = (input.storeName || cleanName).trim();
        if (cleanStore.length < 2) {
          throw new Error('Enter a seller store name (at least 2 characters).');
        }
        if (!input.payoutAccount || input.payoutAccount.trim().length < 3) {
          throw new Error(
            'Enter a payout account (Telebirr, Bank Account, PayPal, etc.) to activate a seller account.'
          );
        }
      }

      pendingRegSeedRef.current = {
        fullName: cleanName,
        asSeller: Boolean(input.asSeller),
        storeName: (input.storeName || cleanName)
          .trim()
          .slice(0, VALIDATION_LIMITS.STORE_NAME_MAX),
        payoutMethod: input.payoutMethod || 'Telebirr',
        payoutProviderLabel: (
          input.payoutProviderLabel ||
          input.payoutMethod ||
          'Telebirr'
        ).trim(),
        payoutAccount: (input.payoutAccount || '')
          .trim()
          .slice(0, VALIDATION_LIMITS.PAYOUT_ACCOUNT_MAX),
      };

      const cred = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        input.password
      );
      try {
        await updateProfile(cred.user, { displayName: cleanName });
      } catch {
        // non-fatal profile sync
      }
      await ensureUserBootstrapped(cred.user);

      if (isAuthorizedOwnerEmail(cleanEmail) && !cred.user.emailVerified) {
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // ignore rate limits
        }
      }

      setIsAuthModalOpen(false);
      return true;
    } catch (err) {
      pendingRegSeedRef.current = null;
      setAuthError(formatFirebaseAuthError(err));
      return false;
    } finally {
      setAuthBusy(false);
    }
  }

  async function signInWithEmailPassword(
    email: string,
    password: string
  ): Promise<boolean> {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const cleanEmail = email.trim().slice(0, 254);
      if (!cleanEmail.includes('@')) {
        throw new Error('Please enter a valid email address.');
      }
      if (!password) {
        throw new Error('Please enter your password.');
      }
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      await ensureUserBootstrapped(cred.user);
      setIsAuthModalOpen(false);
      return true;
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err));
      return false;
    } finally {
      setAuthBusy(false);
    }
  }

  async function sendPasswordReset(email: string): Promise<void> {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const cleanEmail = email.trim();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new Error(
          'Enter your account email address first to receive a password reset link.'
        );
      }
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch (err) {
      const msg = formatFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setAuthBusy(false);
    }
  }

  async function resendOwnerVerificationEmail(): Promise<void> {
    if (!auth.currentUser) {
      throw new Error('Sign in first to request an email verification link.');
    }
    await sendEmailVerification(auth.currentUser);
  }

  async function refreshAuthUser(): Promise<void> {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    const refreshed = auth.currentUser;
    setUser(refreshed ? ({ ...refreshed } as User) : null);
  }

  async function signOutUser() {
    setAuthError(null);
    await signOut(auth);
  }

  function assertCreatorAccess() {
    if (!isNonAnonymousUser(user)) {
      throw new Error('Website Owner sign-in required.');
    }
    if (!isCreatorAdmin) {
      if (isAuthorizedOwnerEmail(user.email) && !user.emailVerified) {
        throw new Error(
          'Please verify your owner email address (or sign in with Google) to unlock Admin Dashboard permissions.'
        );
      }
      throw new Error(
        'Permission denied: only the authorized Pickras Website Owner can manage blog posts, affiliate listings, campaigns, or global settings.'
      );
    }
  }

  function assertSignedInAccount() {
    if (!isNonAnonymousUser(user)) {
      throw new Error('Sign in or create an account first.');
    }
  }

  function assertActiveSellerAccess() {
    if (!isNonAnonymousUser(user)) {
      throw new Error(
        'Register and sign in to a Seller Account before adding or managing Store products.'
      );
    }
    if (isCreatorAdmin) return;
    if (isSellerSuspended) {
      throw new Error(
        'Your seller account has been suspended by the website administrator.'
      );
    }
    if (!isActiveSeller) {
      throw new Error(
        'Activate your Seller Account with a storefront name and verified payout method before managing Store products.'
      );
    }
  }

  async function hideSeedItem(seedId: string): Promise<void> {
    assertCreatorAccess();
    if (!seedId.startsWith('seed_')) return;
    const nextHidden = Array.from(
      new Set([...(siteConfig.hiddenSeedIds || []), seedId])
    ).slice(0, 50);

    setLocalHiddenSeedIds(nextHidden);
    try {
      localStorage.setItem(HIDDEN_SEED_IDS_KEY, JSON.stringify(nextHidden));
    } catch {
      // ignore storage quota errors
    }

    await saveSiteConfig({
      siteTagline: siteConfig.siteTagline,
      announcementEnabled: siteConfig.announcementEnabled,
      announcementText: siteConfig.announcementText,
      announcementCtaLabel: siteConfig.announcementCtaLabel,
      announcementTargetSection: siteConfig.announcementTargetSection,
      freeShippingThresholdCents: siteConfig.freeShippingThresholdCents,
      flatShippingCents: siteConfig.flatShippingCents,
      defaultDisclosureText: siteConfig.defaultDisclosureText,
      storeCheckoutEnabled: siteConfig.storeCheckoutEnabled,
      blogEnabled: siteConfig.blogEnabled,
      storeEnabled: siteConfig.storeEnabled,
      productAffiliateEnabled: siteConfig.productAffiliateEnabled,
      serviceAffiliateEnabled: siteConfig.serviceAffiliateEnabled,
      showStarterSeeds: siteConfig.showStarterSeeds,
      hiddenSeedIds: nextHidden,
    });
  }

  async function registerOrUpdateSellerAccount(
    input: SellerAccountInput
  ): Promise<void> {
    assertSignedInAccount();
    if (!user) throw new Error('Sign-in required.');
    if (isSellerSuspended && !isCreatorAdmin) {
      throw new Error(
        'Your seller account is currently suspended and cannot be reactivated without administrator review.'
      );
    }

    const cleanStoreName = input.storeName
      .trim()
      .slice(0, VALIDATION_LIMITS.STORE_NAME_MAX);
    if (cleanStoreName.length < 2) {
      throw new Error('Store / Studio name must be at least 2 characters.');
    }

    const cleanBio = input.bio.trim().slice(0, VALIDATION_LIMITS.BIO_MAX);
    const cleanMethod: SellerPayoutMethod = VALID_PAYOUT_METHODS.includes(
      input.payoutMethod
    )
      ? input.payoutMethod
      : 'Telebirr';
    const cleanPayoutAccount = input.payoutAccount
      .trim()
      .slice(0, VALIDATION_LIMITS.PAYOUT_ACCOUNT_MAX);

    if (cleanMethod === 'None' || cleanPayoutAccount.length < 3) {
      throw new Error(
        'Add a valid payout method and account number (Telebirr, Bank, Stripe, PayPal, etc.) to activate your Seller Account.'
      );
    }

    const safeEmail = (user.email || 'creator@example.com').slice(0, 254);

    await ensureParentUserProfileExists(user);

    const displayName = (
      profile?.displayName ||
      user.displayName ||
      cleanStoreName
    ).slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX);

    const existingParsed = parsePayoutAccounts(
      privateInfo?.payoutAccounts,
      privateInfo?.payoutMethod,
      privateInfo?.payoutAccount,
      displayName
    );
    const nextAccountsObj: SavedPayoutAccount[] = input.payoutAccounts
      ? input.payoutAccounts.slice(0, 6)
      : [
          {
            id: existingParsed[0]?.id || 'pay_primary',
            method: cleanMethod,
            providerLabel: existingParsed[0]?.providerLabel || cleanMethod,
            accountHolder: existingParsed[0]?.accountHolder || displayName,
            accountNumber: cleanPayoutAccount,
          },
          ...existingParsed.slice(1, 6),
        ];
    const serializedList = nextAccountsObj
      .filter((a) => a.accountNumber.trim().length > 0)
      .slice(0, 6)
      .map(serializePayoutAccount);

    // 1. Persist private payout record first so isActiveSellerUser relational check is satisfied immediately
    try {
      const privRef = doc(db, 'users', user.uid, 'private', 'info');
      const snap = await getDoc(privRef);
      if (!snap.exists()) {
        await setDoc(privRef, {
          uid: user.uid,
          email: safeEmail,
          defaultAmazonTag: privateInfo?.defaultAmazonTag || '',
          defaultDigistoreId: privateInfo?.defaultDigistoreId || '',
          payoutMethod: cleanMethod,
          payoutAccount: cleanPayoutAccount,
          payoutAccounts: serializedList,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(privRef, {
          email: safeEmail,
          payoutMethod: cleanMethod,
          payoutAccount: cleanPayoutAccount,
          payoutAccounts: serializedList,
          updatedAt: serverTimestamp(),
        });
      }
      setPrivateInfo((prev) => ({
        uid: user.uid,
        email: safeEmail,
        defaultAmazonTag: prev?.defaultAmazonTag || '',
        defaultDigistoreId: prev?.defaultDigistoreId || '',
        payoutMethod: cleanMethod,
        payoutAccount: cleanPayoutAccount,
        payoutAccounts: serializedList,
      }));
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `users/${user.uid}/private/info`
      );
    }

    // 2. Activate Seller Profile on /users/{uid}
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName,
        bio: cleanBio,
        isSeller: true,
        sellerStatus: 'active',
        storeName: cleanStoreName,
        updatedAt: serverTimestamp(),
      });
      setProfile({
        uid: user.uid,
        displayName,
        bio: cleanBio,
        isSeller: true,
        sellerStatus: 'active',
        storeName: cleanStoreName,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  }

  async function saveUserPaymentMethods(
    accounts: SavedPayoutAccount[],
    primaryId?: string
  ): Promise<void> {
    assertSignedInAccount();
    if (!user) throw new Error('Sign-in required.');

    await ensureParentUserProfileExists(user);

    const validAccounts = accounts
      .filter((acc) => acc.accountNumber && acc.accountNumber.trim().length >= 3)
      .slice(0, VALIDATION_LIMITS.PAYOUT_ACCOUNTS_MAX_COUNT);

    if (primaryId) {
      validAccounts.sort((a, b) =>
        a.id === primaryId ? -1 : b.id === primaryId ? 1 : 0
      );
    }

    const serializedList = validAccounts.map(serializePayoutAccount);
    const primary = validAccounts[0];
    const cleanMethod: SellerPayoutMethod = primary
      ? VALID_PAYOUT_METHODS.includes(primary.method)
        ? primary.method
        : 'BankTransfer'
      : 'None';
    const cleanPayoutAccount = primary
      ? formatPayoutSummary(primary).slice(0, VALIDATION_LIMITS.PAYOUT_ACCOUNT_MAX)
      : '';
    const safeEmail = (user.email || 'member@example.com').slice(0, 254);

    try {
      const privRef = doc(db, 'users', user.uid, 'private', 'info');
      const snap = await getDoc(privRef);
      if (!snap.exists()) {
        await setDoc(privRef, {
          uid: user.uid,
          email: safeEmail,
          defaultAmazonTag: privateInfo?.defaultAmazonTag || '',
          defaultDigistoreId: privateInfo?.defaultDigistoreId || '',
          payoutMethod: cleanMethod,
          payoutAccount: cleanPayoutAccount,
          payoutAccounts: serializedList,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(privRef, {
          email: safeEmail,
          payoutMethod: cleanMethod,
          payoutAccount: cleanPayoutAccount,
          payoutAccounts: serializedList,
          updatedAt: serverTimestamp(),
        });
      }
      setPrivateInfo((prev) => ({
        uid: user.uid,
        email: safeEmail,
        defaultAmazonTag: prev?.defaultAmazonTag || '',
        defaultDigistoreId: prev?.defaultDigistoreId || '',
        payoutMethod: cleanMethod,
        payoutAccount: cleanPayoutAccount,
        payoutAccounts: serializedList,
      }));
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `users/${user.uid}/private/info`
      );
    }
  }

  async function moderateUserSellerStatus(
    targetUid: string,
    nextStatus: SellerAccountStatus,
    isSellerFlag?: boolean
  ): Promise<void> {
    assertCreatorAccess();
    const cleanUid = targetUid.trim();
    if (!VALIDATION_LIMITS.ID_REGEX.test(cleanUid)) {
      throw new Error('Invalid user UID.');
    }
    const existingTarget = allUsers.find((u) => u.uid === cleanUid);
    const nextIsSeller =
      typeof isSellerFlag === 'boolean'
        ? isSellerFlag
        : nextStatus === 'active';
    const nextStoreName =
      nextIsSeller && (!existingTarget?.storeName || existingTarget.storeName.length < 2)
        ? (existingTarget?.displayName || 'Creator Studio').slice(0, 80)
        : existingTarget?.storeName || '';

    const path = `users/${cleanUid}`;
    try {
      await updateDoc(doc(db, 'users', cleanUid), {
        isSeller: nextIsSeller,
        sellerStatus: nextStatus,
        storeName: nextStoreName,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  function sanitizeOptionalMediaVideoUrl(raw?: string): string {
    const val = (raw || '').trim();
    if (!val) return '';
    if (val.startsWith('data:video/')) {
      return val.slice(0, VALIDATION_LIMITS.VIDEO_URL_MAX);
    }
    let normalized = val;
    if (!normalized.startsWith('https://') && !normalized.startsWith('http://')) {
      normalized = `https://${normalized}`;
    } else if (normalized.startsWith('http://')) {
      normalized = `https://${normalized.slice(7)}`;
    }
    return normalized.slice(0, VALIDATION_LIMITS.VIDEO_URL_MAX);
  }

  function canMutateDropdownList(listKey: DropdownListKey): boolean {
    if (isCreatorAdmin) return true;
    if (
      (listKey === 'storeCategories' || listKey === 'digitalFormats') &&
      isActiveSeller
    ) {
      return true;
    }
    return false;
  }

  function addDropdownOption(listKey: DropdownListKey, newOption: string) {
    if (!canMutateDropdownList(listKey)) return;
    const cleaned = newOption.trim().slice(0, 140);
    if (cleaned.length < 2) return;
    updateAdminUiPrefs((prev) => {
      const current = prev.dropdownOptions[listKey] || [];
      if (current.some((o) => o.toLowerCase() === cleaned.toLowerCase())) {
        return prev;
      }
      return {
        ...prev,
        dropdownOptions: {
          ...prev.dropdownOptions,
          [listKey]: [...current, cleaned].slice(0, 40),
        },
      };
    });
  }

  function renameDropdownOption(
    listKey: DropdownListKey,
    oldOption: string,
    nextOption: string
  ) {
    if (!canMutateDropdownList(listKey)) return;
    const cleaned = nextOption.trim().slice(0, 140);
    if (cleaned.length < 2) return;
    updateAdminUiPrefs((prev) => {
      const current = prev.dropdownOptions[listKey] || [];
      const updated = current.map((o) => (o === oldOption ? cleaned : o));
      const deduped = Array.from(new Set(updated));
      return {
        ...prev,
        dropdownOptions: {
          ...prev.dropdownOptions,
          [listKey]: deduped,
        },
      };
    });
  }

  function deleteDropdownOption(
    listKey: DropdownListKey,
    optionToDelete: string
  ) {
    if (!canMutateDropdownList(listKey)) return;
    updateAdminUiPrefs((prev) => {
      const current = prev.dropdownOptions[listKey] || [];
      if (current.length <= 1) return prev;
      const filtered = current.filter((o) => o !== optionToDelete);
      return {
        ...prev,
        dropdownOptions: {
          ...prev.dropdownOptions,
          [listKey]: filtered.length > 0 ? filtered : current,
        },
      };
    });
  }

  function saveSectionHeader(key: SectionHeaderKey, copy: SectionHeaderCopy) {
    if (!isCreatorAdmin) return;
    updateAdminUiPrefs((prev) => ({
      ...prev,
      sectionHeaders: {
        ...prev.sectionHeaders,
        [key]: {
          kicker: copy.kicker.trim().slice(0, 120),
          title: (copy.title.trim() || DEFAULT_SECTION_HEADERS[key].title).slice(
            0,
            180
          ),
          subtitle: (copy.subtitle || '').trim().slice(0, 400),
        },
      },
    }));
  }

  function resetSectionHeader(key: SectionHeaderKey) {
    if (!isCreatorAdmin) return;
    updateAdminUiPrefs((prev) => ({
      ...prev,
      sectionHeaders: {
        ...prev.sectionHeaders,
        [key]: { ...DEFAULT_SECTION_HEADERS[key] },
      },
    }));
  }

  async function saveOffer(input: OfferDraftInput): Promise<string> {
    assertCreatorAccess();
    if (!user) throw new Error('Website Owner sign-in required.');

    const cleanTitle = input.title.trim().slice(0, VALIDATION_LIMITS.OFFER_TITLE_MAX);
    if (cleanTitle.length < 2) {
      throw new Error('Title must be at least 2 characters.');
    }
    const cleanPlatform = (String(input.platform || 'Custom').trim() || 'Custom').slice(
      0,
      60
    );
    const cleanCategory = (input.category.trim() || 'General').slice(
      0,
      VALIDATION_LIMITS.OFFER_CATEGORY_MAX
    );
    const cleanPrice = (input.priceLabel.trim() || 'Check price').slice(
      0,
      VALIDATION_LIMITS.PRICE_LABEL_MAX
    );
    const cleanCommission = input.commissionNote
      .trim()
      .slice(0, VALIDATION_LIMITS.COMMISSION_NOTE_MAX);

    let cleanUrl = input.affiliateUrl.trim();
    if (cleanUrl && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('http://')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    if (cleanUrl.startsWith('http://')) {
      cleanUrl = `https://${cleanUrl.slice(7)}`;
    }
    cleanUrl = cleanUrl.slice(0, VALIDATION_LIMITS.URL_MAX);

    if (!VALIDATION_LIMITS.HTTPS_URL_REGEX.test(cleanUrl)) {
      throw new Error('Affiliate destination URL must be a valid https:// link.');
    }

    const cleanImageKey = (input.imageKey.trim() || 'workspace').slice(
      0,
      VALIDATION_LIMITS.IMAGE_KEY_MAX
    );
    const cleanVideoUrl = sanitizeOptionalMediaVideoUrl(input.videoUrl);
    const rawSummary = input.summary.trim();
    const cleanSummary = (
      rawSummary.length >= VALIDATION_LIMITS.SUMMARY_MIN
        ? rawSummary
        : `${cleanTitle} — Vetted ${cleanPlatform} listing.`
    ).slice(0, VALIDATION_LIMITS.SUMMARY_MAX);

    const cleanHighlights = input.highlights
      .map((item) => item.trim().slice(0, VALIDATION_LIMITS.HIGHLIGHT_ITEM_MAX))
      .filter((item) => item.length >= 1)
      .slice(0, VALIDATION_LIMITS.HIGHLIGHTS_MAX_COUNT);

    const authorName = await ensureParentUserProfileExists(user);
    const replacingSeedId =
      input.id && input.id.startsWith('seed_') ? input.id : null;
    const isUpdate = Boolean(
      input.id && !input.id.startsWith('seed_') && !input.id.startsWith('local_')
    );
    const offerId = isUpdate && input.id ? input.id : generateSafeDocId('offer');
    const path = `offers/${offerId}`;

    try {
      if (isUpdate) {
        await updateDoc(doc(db, 'offers', offerId), {
          authorName,
          title: cleanTitle,
          kind: input.kind,
          platform: cleanPlatform,
          category: cleanCategory,
          priceLabel: cleanPrice,
          commissionNote: cleanCommission,
          affiliateUrl: cleanUrl,
          imageKey: cleanImageKey,
          videoUrl: cleanVideoUrl,
          summary: cleanSummary,
          highlights: cleanHighlights,
          status: input.status,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'offers', offerId), {
          authorId: user.uid,
          authorName,
          title: cleanTitle,
          kind: input.kind,
          platform: cleanPlatform,
          category: cleanCategory,
          priceLabel: cleanPrice,
          commissionNote: cleanCommission,
          affiliateUrl: cleanUrl,
          imageKey: cleanImageKey,
          videoUrl: cleanVideoUrl,
          summary: cleanSummary,
          highlights: cleanHighlights,
          status: input.status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (replacingSeedId) {
        await hideSeedItem(replacingSeedId);
      }
      return offerId;
    } catch (err) {
      handleFirestoreError(
        err,
        isUpdate ? OperationType.UPDATE : OperationType.CREATE,
        path
      );
    }
  }

  async function updateOfferImage(offerId: string, nextImageKey: string) {
    assertCreatorAccess();
    const existing = allAccessibleOffersMap[offerId];
    if (!existing) return;
    await saveOffer({
      id: existing.id,
      title: existing.title,
      kind: existing.kind,
      platform: existing.platform,
      category: existing.category,
      priceLabel: existing.priceLabel,
      commissionNote: existing.commissionNote,
      affiliateUrl: existing.affiliateUrl,
      imageKey: nextImageKey,
      videoUrl: existing.videoUrl,
      summary: existing.summary,
      highlights: existing.highlights,
      status: existing.status,
    });
  }

  async function updateOfferStatus(offerId: string, status: PublishStatus) {
    assertCreatorAccess();
    if (offerId.startsWith('seed_')) {
      if (status !== 'published') {
        await hideSeedItem(offerId);
      }
      return;
    }
    const path = `offers/${offerId}`;
    try {
      await updateDoc(doc(db, 'offers', offerId), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async function deleteOffer(offerId: string) {
    assertCreatorAccess();
    if (offerId.startsWith('seed_')) {
      await hideSeedItem(offerId);
      return;
    }
    const path = `offers/${offerId}`;
    try {
      await deleteDoc(doc(db, 'offers', offerId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }

  async function savePost(input: PostDraftInput): Promise<string> {
    assertCreatorAccess();
    if (!user) throw new Error('Website Owner sign-in required.');

    const cleanTitle = input.title.trim().slice(0, VALIDATION_LIMITS.POST_TITLE_MAX);
    if (cleanTitle.length < VALIDATION_LIMITS.POST_TITLE_MIN) {
      throw new Error('Headline must be at least 4 characters.');
    }

    const rawSubtitle = input.subtitle.trim();
    const cleanSubtitle = (
      rawSubtitle.length >= VALIDATION_LIMITS.POST_SUBTITLE_MIN
        ? rawSubtitle
        : `${cleanTitle} — Editorial notes and dispatches.`
    ).slice(0, VALIDATION_LIMITS.POST_SUBTITLE_MAX);

    const cleanCategory = (
      String(input.category || 'Field Guides').trim() || 'Field Guides'
    ).slice(0, 60);

    const cleanSlug = toSafeSlug(input.slug || cleanTitle);
    const cleanReadMinutes = Math.max(
      1,
      Math.min(60, Math.round(Number(input.readTimeMinutes) || 5))
    );
    const cleanCover = (input.coverImageKey.trim() || 'workspace').slice(
      0,
      VALIDATION_LIMITS.IMAGE_KEY_MAX
    );

    const cleanContent = input.content
      .trim()
      .slice(0, VALIDATION_LIMITS.POST_CONTENT_MAX);
    if (cleanContent.length < VALIDATION_LIMITS.POST_CONTENT_MIN) {
      throw new Error('Blog article body must be at least 20 characters.');
    }

    const cleanTheme: BlogColorTheme =
      input.theme && VALID_BLOG_THEMES.includes(input.theme)
        ? input.theme
        : 'classic';

    const cleanDisclosure = (
      input.disclosureText.trim() || siteConfig.defaultDisclosureText
    ).slice(0, VALIDATION_LIMITS.DISCLOSURE_MAX);

    const cleanPublishedLabel = (
      input.publishedLabel.trim() ||
      new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    ).slice(0, 40);

    const authorName = await ensureParentUserProfileExists(user);
    const replacingSeedId =
      input.id && input.id.startsWith('seed_') ? input.id : null;
    const isUpdate = Boolean(
      input.id && !input.id.startsWith('seed_') && !input.id.startsWith('local_')
    );
    const postId = isUpdate && input.id ? input.id : generateSafeDocId('post');
    const path = `posts/${postId}`;

    try {
      if (isUpdate) {
        await updateDoc(doc(db, 'posts', postId), {
          authorName,
          title: cleanTitle,
          subtitle: cleanSubtitle,
          slug: cleanSlug,
          category: cleanCategory,
          readTimeMinutes: cleanReadMinutes,
          coverImageKey: cleanCover,
          content: cleanContent,
          theme: cleanTheme,
          attachedOfferIds: [],
          disclosureText: cleanDisclosure,
          featured: Boolean(input.featured),
          status: input.status,
          publishedLabel: cleanPublishedLabel,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'posts', postId), {
          authorId: user.uid,
          authorName,
          title: cleanTitle,
          subtitle: cleanSubtitle,
          slug: cleanSlug,
          category: cleanCategory,
          readTimeMinutes: cleanReadMinutes,
          coverImageKey: cleanCover,
          content: cleanContent,
          theme: cleanTheme,
          attachedOfferIds: [],
          disclosureText: cleanDisclosure,
          featured: Boolean(input.featured),
          status: input.status,
          publishedLabel: cleanPublishedLabel,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (replacingSeedId) {
        await hideSeedItem(replacingSeedId);
      }
      return postId;
    } catch (err) {
      handleFirestoreError(
        err,
        isUpdate ? OperationType.UPDATE : OperationType.CREATE,
        path
      );
    }
  }

  async function updatePostCoverImage(
    postId: string,
    nextCoverImageKey: string
  ) {
    assertCreatorAccess();
    const existing = allAccessiblePostsMap[postId];
    if (!existing) return;
    await savePost({
      id: existing.id,
      title: existing.title,
      subtitle: existing.subtitle,
      slug: existing.slug,
      category: existing.category,
      readTimeMinutes: existing.readTimeMinutes,
      coverImageKey: nextCoverImageKey,
      content: existing.content,
      theme: existing.theme,
      attachedOfferIds: [],
      disclosureText: existing.disclosureText,
      featured: existing.featured,
      status: existing.status,
      publishedLabel: existing.publishedLabel,
    });
  }

  async function updatePostStatus(postId: string, status: PublishStatus) {
    assertCreatorAccess();
    const publishedLabel = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    if (postId.startsWith('seed_')) {
      if (status !== 'published') {
        await hideSeedItem(postId);
      }
      return;
    }
    const path = `posts/${postId}`;
    try {
      await updateDoc(doc(db, 'posts', postId), {
        status,
        publishedLabel,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async function deletePost(postId: string) {
    assertCreatorAccess();
    if (postId.startsWith('seed_')) {
      await hideSeedItem(postId);
      return;
    }
    const path = `posts/${postId}`;
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }

  async function saveDirectProduct(input: DirectProductDraftInput): Promise<string> {
    assertActiveSellerAccess();
    if (!user) throw new Error('Seller sign-in required.');

    const existing = input.id ? allAccessibleDirectProductsMap[input.id] : undefined;
    const isSeedId = Boolean(input.id && input.id.startsWith('seed_'));

    if (isSeedId) {
      assertCreatorAccess();
    } else if (existing && existing.sellerId !== user.uid && !isCreatorAdmin) {
      throw new Error('Permission denied: sellers can never modify another seller’s products.');
    }

    const cleanTitle = input.title.trim().slice(0, VALIDATION_LIMITS.OFFER_TITLE_MAX);
    if (cleanTitle.length < VALIDATION_LIMITS.OFFER_TITLE_MIN) {
      throw new Error('Product title must be at least 2 characters.');
    }

    const rawSubtitle = input.subtitle.trim();
    const cleanSubtitle = (
      rawSubtitle.length >= VALIDATION_LIMITS.PRODUCT_SUBTITLE_MIN
        ? rawSubtitle
        : cleanTitle
    ).slice(0, VALIDATION_LIMITS.PRODUCT_SUBTITLE_MAX);

    const cleanCategory = (input.category.trim() || 'Studio Editions').slice(
      0,
      VALIDATION_LIMITS.OFFER_CATEGORY_MAX
    );
    const cleanSku = toSafeSku(input.sku || cleanTitle);
    const cleanPriceCents = Math.max(
      100,
      Math.min(10000000, Math.round(Number(input.priceCents) || 1000))
    );
    const rawCompare = Math.max(
      0,
      Math.min(10000000, Math.round(Number(input.compareAtCents) || 0))
    );
    const cleanCompareAtCents = rawCompare > cleanPriceCents ? rawCompare : 0;
    const cleanStock = Math.max(
      0,
      Math.min(100000, Math.round(Number(input.stockCount) || 0))
    );
    const cleanBadge = input.badgeLabel
      .trim()
      .slice(0, VALIDATION_LIMITS.PRODUCT_BADGE_MAX);
    const cleanImageKey = (input.imageKey.trim() || 'edition').slice(
      0,
      VALIDATION_LIMITS.IMAGE_KEY_MAX
    );
    const cleanVideoUrl = sanitizeOptionalMediaVideoUrl(input.videoUrl);

    const rawFileName = (input.digitalFileName || '').trim();
    if (rawFileName) {
      const lowerName = rawFileName.toLowerCase();
      if (FORBIDDEN_DIGITAL_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
        throw new Error(
          'Executable files are blocked for security. Upload PDF, ZIP, Excel, eBook, HTML, or Markdown deliverables.'
        );
      }
    }

    let cleanDigitalFileUrl = '';
    if (input.kind === 'digital' && input.digitalFileUrl && input.digitalFileUrl.trim()) {
      const rawFileUrl = input.digitalFileUrl.trim();
      if (rawFileUrl.startsWith('data:')) {
        if (
          rawFileUrl.startsWith('data:application/x-msdownload') ||
          rawFileUrl.startsWith('data:application/x-executable')
        ) {
          throw new Error('Executable binary uploads are blocked for security.');
        }
        cleanDigitalFileUrl = rawFileUrl.slice(0, VALIDATION_LIMITS.DIGITAL_FILE_URL_MAX);
      } else {
        let normFileUrl = rawFileUrl;
        if (!normFileUrl.startsWith('https://') && !normFileUrl.startsWith('http://')) {
          normFileUrl = `https://${normFileUrl}`;
        } else if (normFileUrl.startsWith('http://')) {
          normFileUrl = `https://${normFileUrl.slice(7)}`;
        }
        if (!VALIDATION_LIMITS.HTTPS_URL_REGEX.test(normFileUrl)) {
          throw new Error('Digital download link must be a valid https:// URL.');
        }
        cleanDigitalFileUrl = normFileUrl.slice(0, VALIDATION_LIMITS.DIGITAL_FILE_URL_MAX);
      }
    }

    const isUpdate = Boolean(
      input.id && !isSeedId && !input.id.startsWith('local_')
    );
    const preservesExistingVault = Boolean(
      isUpdate &&
        input.kind === 'digital' &&
        !cleanDigitalFileUrl &&
        existing?.hasDigitalAsset
    );

    if (input.kind === 'digital' && !cleanDigitalFileUrl && !preservesExistingVault && !isSeedId) {
      throw new Error(
        'Upload a digital deliverable (PDF, ZIP, Excel, eBook, HTML, Tool) or paste an HTTPS download link before saving a digital product.'
      );
    }

    const cleanDigitalFileName =
      input.kind === 'digital'
        ? (
            rawFileName ||
            (preservesExistingVault ? existing?.digitalFileName || '' : '') ||
            (cleanDigitalFileUrl ? `${cleanSku.toLowerCase()}-download` : '')
          ).slice(0, VALIDATION_LIMITS.DIGITAL_FILE_NAME_MAX)
        : '';
    const cleanDigitalFileType =
      input.kind === 'digital'
        ? (
            (input.digitalFileType || '').trim() ||
            (preservesExistingVault ? existing?.digitalFileType || '' : '') ||
            'Digital Download'
          ).slice(0, VALIDATION_LIMITS.DIGITAL_FILE_TYPE_MAX)
        : '';
    const hasDigitalAsset = Boolean(
      input.kind === 'digital' && (cleanDigitalFileUrl || preservesExistingVault)
    );

    if (cleanImageKey.length + cleanVideoUrl.length > 430000) {
      throw new Error(
        'Combined cover image and showcase video exceed cloud document limits. Use a YouTube/Vimeo/MP4 HTTPS link for the showcase video.'
      );
    }

    const rawSummary = input.summary.trim();
    const cleanSummary = (
      rawSummary.length >= VALIDATION_LIMITS.SUMMARY_MIN
        ? rawSummary
        : `${cleanTitle} — ${cleanSubtitle}`
    ).slice(0, VALIDATION_LIMITS.PRODUCT_SUMMARY_MAX);

    const cleanHighlights = input.highlights
      .map((item) => item.trim().slice(0, VALIDATION_LIMITS.HIGHLIGHT_ITEM_MAX))
      .filter((item) => item.length >= 1)
      .slice(0, VALIDATION_LIMITS.HIGHLIGHTS_MAX_COUNT);

    const cleanDeliveryNote = (
      input.deliveryNote.trim() ||
      (input.kind === 'digital'
        ? 'Instant digital download unlocked upon order confirmation'
        : 'Ships directly within 48 hours via tracked courier')
    ).slice(0, VALIDATION_LIMITS.PRODUCT_DELIVERY_NOTE_MAX);

    const replacingSeedId = isSeedId && input.id ? input.id : null;
    const resolvedSellerName = await ensureParentUserProfileExists(user);
    const sellerName =
      existing && existing.sellerId !== user.uid && !isSeedId
        ? existing.sellerName
        : (profile?.storeName || resolvedSellerName).slice(0, 80);
    const targetSellerId =
      isUpdate && existing?.sellerId ? existing.sellerId : user.uid;

    // Non-admin seller submissions MUST enter Admin Review Queue (draft + pending)
    const enforcedApprovalStatus: ProductApprovalStatus = isCreatorAdmin
      ? 'approved'
      : 'pending';
    const enforcedStatus: PublishStatus = isCreatorAdmin ? input.status : 'draft';
    const enforcedModerationNote = isCreatorAdmin
      ? existing?.moderationNote || ''
      : 'Submitted for administrator review before public Store publication.';

    const productId = isUpdate && input.id ? input.id : generateSafeDocId('prod');
    const path = `directProducts/${productId}`;

    try {
      const batch = writeBatch(db);
      const prodRef = doc(db, 'directProducts', productId);

      if (isUpdate) {
        batch.update(prodRef, {
          sellerName,
          title: cleanTitle,
          subtitle: cleanSubtitle,
          kind: input.kind,
          category: cleanCategory,
          sku: cleanSku,
          priceCents: cleanPriceCents,
          compareAtCents: cleanCompareAtCents,
          stockCount: cleanStock,
          badgeLabel: cleanBadge,
          imageKey: cleanImageKey,
          videoUrl: cleanVideoUrl,
          digitalFileUrl: '',
          digitalFileName: cleanDigitalFileName,
          digitalFileType: cleanDigitalFileType,
          hasDigitalAsset,
          approvalStatus: enforcedApprovalStatus,
          moderationNote: enforcedModerationNote,
          summary: cleanSummary,
          highlights: cleanHighlights,
          deliveryNote: cleanDeliveryNote,
          featured: Boolean(input.featured),
          status: enforcedStatus,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(prodRef, {
          sellerId: targetSellerId,
          sellerName,
          title: cleanTitle,
          subtitle: cleanSubtitle,
          kind: input.kind,
          category: cleanCategory,
          sku: cleanSku,
          priceCents: cleanPriceCents,
          compareAtCents: cleanCompareAtCents,
          stockCount: cleanStock,
          badgeLabel: cleanBadge,
          imageKey: cleanImageKey,
          videoUrl: cleanVideoUrl,
          digitalFileUrl: '',
          digitalFileName: cleanDigitalFileName,
          digitalFileType: cleanDigitalFileType,
          hasDigitalAsset,
          approvalStatus: enforcedApprovalStatus,
          moderationNote: enforcedModerationNote,
          summary: cleanSummary,
          highlights: cleanHighlights,
          deliveryNote: cleanDeliveryNote,
          featured: Boolean(input.featured),
          status: enforcedStatus,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (input.kind === 'digital' && cleanDigitalFileUrl) {
        const secretRef = doc(db, 'productSecrets', productId);
        let secretExists = false;
        if (isUpdate) {
          try {
            const existingSecret = await getDoc(secretRef);
            secretExists = existingSecret.exists();
          } catch {
            secretExists = false;
          }
        }
        if (secretExists) {
          batch.update(secretRef, {
            digitalFileUrl: cleanDigitalFileUrl,
            digitalFileName: cleanDigitalFileName,
            digitalFileType: cleanDigitalFileType,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(secretRef, {
            productId,
            sellerId: targetSellerId,
            digitalFileUrl: cleanDigitalFileUrl,
            digitalFileName: cleanDigitalFileName,
            digitalFileType: cleanDigitalFileType,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();

      if (replacingSeedId) {
        await hideSeedItem(replacingSeedId);
      }
      return productId;
    } catch (err) {
      handleFirestoreError(
        err,
        isUpdate ? OperationType.UPDATE : OperationType.CREATE,
        path
      );
    }
  }

  async function moderateDirectProduct(
    productId: string,
    decision: ProductApprovalStatus,
    moderationNote = ''
  ): Promise<void> {
    assertCreatorAccess();
    if (productId.startsWith('seed_')) return;
    const nextStatus: PublishStatus =
      decision === 'approved' ? 'published' : 'draft';
    const cleanNote = moderationNote.trim().slice(0, 300);
    const path = `directProducts/${productId}`;
    try {
      await updateDoc(doc(db, 'directProducts', productId), {
        approvalStatus: decision,
        status: nextStatus,
        moderationNote: cleanNote,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async function updateDirectProductImage(
    productId: string,
    nextImageKey: string
  ) {
    assertActiveSellerAccess();
    const existing = allAccessibleDirectProductsMap[productId];
    if (!existing) return;
    if (productId.startsWith('seed_')) {
      assertCreatorAccess();
    } else if (existing.sellerId !== user?.uid && !isCreatorAdmin) {
      throw new Error('Permission denied: sellers can only edit their own products.');
    }
    await saveDirectProduct({
      id: existing.id,
      title: existing.title,
      subtitle: existing.subtitle,
      kind: existing.kind,
      category: existing.category,
      sku: existing.sku,
      priceCents: existing.priceCents,
      compareAtCents: existing.compareAtCents,
      stockCount: existing.stockCount,
      badgeLabel: existing.badgeLabel,
      imageKey: nextImageKey,
      videoUrl: existing.videoUrl,
      digitalFileName: existing.digitalFileName,
      digitalFileType: existing.digitalFileType,
      hasDigitalAsset: existing.hasDigitalAsset,
      summary: existing.summary,
      highlights: existing.highlights,
      deliveryNote: existing.deliveryNote,
      featured: existing.featured,
      status: existing.status,
    });
  }

  async function updateDirectProductStatus(
    productId: string,
    status: PublishStatus,
    stockCount?: number
  ) {
    assertActiveSellerAccess();
    const existingProd = allAccessibleDirectProductsMap[productId];
    if (!existingProd) return;

    if (productId.startsWith('seed_')) {
      assertCreatorAccess();
      if (status !== 'published') {
        await hideSeedItem(productId);
      }
      return;
    }

    if (existingProd.sellerId !== user?.uid && !isCreatorAdmin) {
      throw new Error('Permission denied: sellers can never modify another seller’s products.');
    }

    if (
      !isCreatorAdmin &&
      status === 'published' &&
      existingProd.approvalStatus !== 'approved'
    ) {
      throw new Error(
        'This product is awaiting Administrator approval before it can be published to the public Store.'
      );
    }

    const nextStock =
      typeof stockCount === 'number'
        ? Math.max(0, Math.min(100000, Math.round(stockCount)))
        : existingProd.stockCount ?? 10;

    const path = `directProducts/${productId}`;
    try {
      await updateDoc(doc(db, 'directProducts', productId), {
        status,
        stockCount: nextStock,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async function deleteDirectProduct(productId: string) {
    assertActiveSellerAccess();
    const existingProd = allAccessibleDirectProductsMap[productId];

    if (productId.startsWith('seed_')) {
      assertCreatorAccess();
      await hideSeedItem(productId);
      return;
    }

    if (existingProd && existingProd.sellerId !== user?.uid && !isCreatorAdmin) {
      throw new Error('Permission denied: sellers can only delete their own products.');
    }

    const path = `directProducts/${productId}`;
    try {
      await deleteDoc(doc(db, 'directProducts', productId));
      if (existingProd?.hasDigitalAsset) {
        try {
          await deleteDoc(doc(db, 'productSecrets', productId));
        } catch {
          // ignore if secret record was never created
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }

  async function fetchProtectedDigitalSecret(
    productId: string,
    orderId?: string
  ): Promise<DeliveredDigitalAsset | null> {
    if (deliveredDigitalCache[productId]) {
      return deliveredDigitalCache[productId];
    }
    const prod = allAccessibleDirectProductsMap[productId];
    if (prod?.isSeed && prod.kind === 'digital') {
      const seedAsset = buildSeedDigitalBundleAsset(prod);
      return seedAsset;
    }
    if (prod?.digitalFileUrl && prod.digitalFileUrl.trim()) {
      return {
        url: prod.digitalFileUrl,
        fileName: prod.digitalFileName || `${prod.sku.toLowerCase()}-download`,
        fileType: prod.digitalFileType || 'Digital Download',
      };
    }

    const secretRef = doc(db, 'productSecrets', productId);
    // If signed-in buyer is re-downloading from an existing paid order, unlock capability window first
    if (
      orderId &&
      isNonAnonymousUser(user) &&
      prod &&
      prod.sellerId !== user.uid &&
      !isCreatorAdmin
    ) {
      try {
        await updateDoc(secretRef, {
          lastOrderRef: orderId,
          unlockedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `productSecrets/${productId}`);
      }
    }

    try {
      const snap = await getDoc(secretRef);
      if (!snap.exists()) return null;
      const d = snap.data();
      const asset: DeliveredDigitalAsset = {
        url: String(d.digitalFileUrl || ''),
        fileName: String(d.digitalFileName || `${productId}-download`),
        fileType: String(d.digitalFileType || 'Digital Download'),
      };
      if (!asset.url) return null;
      if (orderId) {
        setDeliveredDigitalCache((prev) => {
          const next = { ...prev, [productId]: asset };
          try {
            localStorage.setItem(DELIVERED_DIGITAL_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // ignore storage quota errors
          }
          return next;
        });
      }
      return asset;
    } catch {
      return null;
    }
  }

  async function saveCampaign(input: CampaignDraftInput): Promise<string> {
    assertCreatorAccess();
    if (!user) throw new Error('Website Owner sign-in required.');

    const cleanTitle = input.title
      .trim()
      .slice(0, VALIDATION_LIMITS.CAMPAIGN_TITLE_MAX);
    if (cleanTitle.length < VALIDATION_LIMITS.CAMPAIGN_TITLE_MIN) {
      throw new Error('Campaign headline must be at least 3 characters.');
    }

    const cleanDesc = input.description
      .trim()
      .slice(0, VALIDATION_LIMITS.CAMPAIGN_DESC_MAX);
    if (cleanDesc.length < VALIDATION_LIMITS.CAMPAIGN_DESC_MIN) {
      throw new Error('Campaign offer description must be at least 8 characters.');
    }

    const cleanCode = toSafePromoCode(input.promoCode);
    const cleanDiscount = Math.max(
      5,
      Math.min(90, Math.round(Number(input.discountPercent) || 15))
    );
    const cleanMinOrder = Math.max(
      0,
      Math.min(5000000, Math.round(Number(input.minOrderCents) || 0))
    );
    const cleanChannel = (
      String(input.channel || 'Storefront Banner').trim() || 'Storefront Banner'
    ).slice(0, 60);
    const rawFeaturedId = input.featuredProductId.trim();
    const cleanFeaturedId =
      rawFeaturedId && VALIDATION_LIMITS.ID_REGEX.test(rawFeaturedId)
        ? rawFeaturedId.slice(0, 128)
        : '';
    const cleanCta = (input.ctaLabel.trim() || `Apply ${cleanCode}`).slice(0, 40);
    const cleanExpires = (input.expiresLabel.trim() || 'Limited Release').slice(
      0,
      40
    );

    await ensureParentUserProfileExists(user);
    const replacingSeedId =
      input.id && input.id.startsWith('seed_') ? input.id : null;
    const isUpdate = Boolean(
      input.id && !input.id.startsWith('seed_') && !input.id.startsWith('local_')
    );
    const campaignId = isUpdate && input.id ? input.id : generateSafeDocId('camp');
    const path = `campaigns/${campaignId}`;

    try {
      if (isUpdate) {
        await updateDoc(doc(db, 'campaigns', campaignId), {
          title: cleanTitle,
          description: cleanDesc,
          promoCode: cleanCode,
          discountPercent: cleanDiscount,
          minOrderCents: cleanMinOrder,
          channel: cleanChannel,
          featuredProductId: cleanFeaturedId,
          ctaLabel: cleanCta,
          expiresLabel: cleanExpires,
          status: input.status,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'campaigns', campaignId), {
          authorId: user.uid,
          title: cleanTitle,
          description: cleanDesc,
          promoCode: cleanCode,
          discountPercent: cleanDiscount,
          minOrderCents: cleanMinOrder,
          channel: cleanChannel,
          featuredProductId: cleanFeaturedId,
          ctaLabel: cleanCta,
          expiresLabel: cleanExpires,
          status: input.status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (replacingSeedId) {
        await hideSeedItem(replacingSeedId);
      }
      return campaignId;
    } catch (err) {
      handleFirestoreError(
        err,
        isUpdate ? OperationType.UPDATE : OperationType.CREATE,
        path
      );
    }
  }

  async function updateCampaignStatus(campaignId: string, status: PublishStatus) {
    assertCreatorAccess();
    if (campaignId.startsWith('seed_')) {
      if (status !== 'published') {
        await hideSeedItem(campaignId);
      }
      return;
    }
    const path = `campaigns/${campaignId}`;
    try {
      await updateDoc(doc(db, 'campaigns', campaignId), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async function deleteCampaign(campaignId: string) {
    assertCreatorAccess();
    if (campaignId.startsWith('seed_')) {
      await hideSeedItem(campaignId);
      return;
    }
    const path = `campaigns/${campaignId}`;
    try {
      await deleteDoc(doc(db, 'campaigns', campaignId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }

  async function placeDirectOrder(input: DirectCheckoutInput): Promise<DirectOrder> {
    if (!siteConfig.storeCheckoutEnabled || !siteConfig.storeEnabled) {
      throw new Error(
        'Store checkout is temporarily paused by the website owner. Please check back shortly.'
      );
    }
    if (cartItems.length === 0) {
      throw new Error('Your shopping bag is empty.');
    }

    const resolvedLines = cartItems
      .map((item) => {
        const product = allAccessibleDirectProductsMap[item.productId];
        return product && product.status === 'published'
          ? { product, quantity: item.quantity }
          : null;
      })
      .filter(
        (line): line is { product: DirectProduct; quantity: number } => Boolean(line)
      );

    if (resolvedLines.length === 0) {
      throw new Error('Selected products are no longer available.');
    }

    for (const line of resolvedLines) {
      if (line.product.kind === 'physical' && line.quantity > line.product.stockCount) {
        throw new Error(
          `Only ${line.product.stockCount} unit(s) of "${line.product.title}" remain in stock.`
        );
      }
    }

    const cleanBuyerName = input.buyerName
      .trim()
      .slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX);
    if (cleanBuyerName.length < 2) {
      throw new Error('Enter your full name (at least 2 characters).');
    }

    const isSignedInBuyer = isNonAnonymousUser(user);
    const cleanBuyerEmail = (
      input.buyerEmail.trim() ||
      (isSignedInBuyer ? user.email || '' : '')
    ).slice(0, 254);
    if (cleanBuyerEmail.length < 3 || !cleanBuyerEmail.includes('@')) {
      throw new Error('Enter a valid receipt email address.');
    }

    const anyPhysical = resolvedLines.some((l) => l.product.kind === 'physical');
    const cleanAddress = input.shippingAddress
      .trim()
      .slice(0, VALIDATION_LIMITS.ORDER_ADDRESS_MAX);
    if (anyPhysical && cleanAddress.length < 6) {
      throw new Error('Enter a complete shipping address for physical items.');
    }

    const cleanPayMethod: CustomerPaymentMethod =
      input.paymentMethod &&
      VALID_CUSTOMER_PAYMENT_METHODS.includes(input.paymentMethod)
        ? input.paymentMethod
        : 'Card';
    const cleanPayRef = (input.paymentReference || `${cleanPayMethod} Verified`)
      .trim()
      .slice(0, 80);

    if (isSignedInBuyer) {
      await ensureParentUserProfileExists(user);
    }

    const effectiveBuyerId = isSignedInBuyer
      ? user.uid
      : generateSafeDocId('guest');

    const groupedBySeller = new Map<
      string,
      { sellerName: string; lines: { product: DirectProduct; quantity: number }[] }
    >();
    for (const line of resolvedLines) {
      const sId = line.product.sellerId || 'editorial_desk';
      const sName = line.product.sellerName || 'Pickras Studio';
      const bucket = groupedBySeller.get(sId);
      if (bucket) {
        bucket.lines.push(line);
      } else {
        groupedBySeller.set(sId, { sellerName: sName, lines: [line] });
      }
    }

    const activeCode =
      appliedCampaign && cartDiscountCents > 0 ? appliedCampaign.promoCode : '';
    const createdOrders: DirectOrder[] = [];
    const newlyUnlockedDigital: Record<string, DeliveredDigitalAsset> = {};
    const seedPhysicalDecrements: Record<string, number> = {};
    const nowMs = Date.now();
    let shippingAssigned = false;

    for (const [sellerId, group] of groupedBySeller.entries()) {
      const groupLines = group.lines;
      const groupSubtotal = groupLines.reduce(
        (sum, l) => sum + l.product.priceCents * l.quantity,
        0
      );
      const groupDiscount =
        cartSubtotalCents > 0 && cartDiscountCents > 0
          ? Math.round((groupSubtotal / cartSubtotalCents) * cartDiscountCents)
          : 0;
      const groupHasPhysical = groupLines.some((l) => l.product.kind === 'physical');
      const groupHasDigital = groupLines.some((l) => l.product.kind === 'digital');
      const fulfillmentType: DirectOrder['fulfillmentType'] =
        groupHasPhysical && groupHasDigital
          ? 'mixed'
          : groupHasPhysical
          ? 'physical'
          : 'digital';

      const groupShipping =
        groupHasPhysical && !shippingAssigned ? cartShippingCents : 0;
      if (groupHasPhysical && !shippingAssigned) {
        shippingAssigned = true;
      }

      const groupTotal = Math.max(0, groupSubtotal - groupDiscount + groupShipping);
      const isHouseEdition = sellerId === 'editorial_desk';
      const platformFeeCents = isHouseEdition
        ? 0
        : Math.round(Math.max(0, groupSubtotal - groupDiscount) * 0.1);
      const sellerPayoutCents = Math.max(0, groupTotal - platformFeeCents);
      const payoutStatus: PayoutSettlementStatus = isHouseEdition
        ? 'not_applicable'
        : 'pending';

      const ownPayoutDetails =
        isSignedInBuyer &&
        sellerId === user.uid &&
        privateInfo?.payoutMethod &&
        privateInfo.payoutMethod !== 'None'
          ? `${privateInfo.payoutMethod}: ${privateInfo.payoutAccount || user.email || ''}`.slice(
              0,
              VALIDATION_LIMITS.ORDER_PAYOUT_DETAILS_MAX
            )
          : '';

      const productIds = groupLines.map((l) => l.product.id).slice(0, 8);
      const itemsSummary = groupLines
        .map((l) => `${l.quantity}x ${l.product.title} (${l.product.sku})`)
        .join(' · ')
        .slice(0, VALIDATION_LIMITS.ORDER_ITEMS_SUMMARY_MAX);
      const itemCount = Math.min(
        50,
        groupLines.reduce((sum, l) => sum + l.quantity, 0)
      );

      const orderNumber = generateOrderNumber();
      const orderId = generateSafeDocId('ord');
      const initialFulfillmentNote =
        fulfillmentType === 'digital'
          ? 'Instant digital product unlocked. Download your files immediately from your Order Confirmation or My Purchases.'
          : `Order confirmed (${cleanPayRef}). ${group.sellerName} is preparing tracked dispatch.`;

      const path = `directOrders/${orderId}`;
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'directOrders', orderId), {
          buyerId: effectiveBuyerId,
          sellerId,
          sellerName: group.sellerName.slice(0, 80),
          orderNumber,
          buyerName: cleanBuyerName,
          buyerEmail: cleanBuyerEmail,
          shippingAddress: groupHasPhysical ? cleanAddress : '',
          paymentMethod: cleanPayMethod,
          paymentReference: cleanPayRef,
          productIds,
          itemsSummary,
          itemCount,
          fulfillmentType,
          promoCode: activeCode,
          subtotalCents: groupSubtotal,
          discountCents: groupDiscount,
          shippingCents: groupShipping,
          totalCents: groupTotal,
          platformFeeCents,
          sellerPayoutCents,
          payoutStatus,
          sellerPayoutDetails: ownPayoutDetails,
          payoutNote: '',
          fulfillmentNote: initialFulfillmentNote,
          status: 'paid',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        for (const line of groupLines) {
          const p = line.product;
          if (p.kind === 'physical') {
            if (p.isSeed || p.id.startsWith('seed_')) {
              seedPhysicalDecrements[p.id] =
                (seedPhysicalDecrements[p.id] || 0) + line.quantity;
            } else {
              batch.update(doc(db, 'directProducts', p.id), {
                stockCount: Math.max(0, p.stockCount - line.quantity),
                lastOrderRef: orderId,
                updatedAt: serverTimestamp(),
              });
            }
          } else if (p.kind === 'digital') {
            if (
              !p.isSeed &&
              !p.id.startsWith('seed_') &&
              p.hasDigitalAsset &&
              !p.digitalFileUrl
            ) {
              batch.update(doc(db, 'productSecrets', p.id), {
                lastOrderRef: orderId,
                unlockedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          }
        }

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }

      const orderDeliveredAssets: Record<string, DeliveredDigitalAsset> = {};
      for (const line of groupLines) {
        const p = line.product;
        if (p.kind !== 'digital') continue;
        if (p.isSeed || p.id.startsWith('seed_')) {
          const seedAsset = buildSeedDigitalBundleAsset(p);
          orderDeliveredAssets[p.id] = seedAsset;
          newlyUnlockedDigital[p.id] = seedAsset;
        } else if (p.digitalFileUrl && p.digitalFileUrl.trim()) {
          const legacyAsset: DeliveredDigitalAsset = {
            url: p.digitalFileUrl,
            fileName: p.digitalFileName || `${p.sku.toLowerCase()}-download`,
            fileType: p.digitalFileType || 'Digital Download',
          };
          orderDeliveredAssets[p.id] = legacyAsset;
          newlyUnlockedDigital[p.id] = legacyAsset;
        } else if (p.hasDigitalAsset) {
          try {
            const secretSnap = await getDoc(doc(db, 'productSecrets', p.id));
            if (secretSnap.exists()) {
              const sd = secretSnap.data();
              const vaultedAsset: DeliveredDigitalAsset = {
                url: String(sd.digitalFileUrl || ''),
                fileName: String(
                  sd.digitalFileName || `${p.sku.toLowerCase()}-download`
                ),
                fileType: String(sd.digitalFileType || 'Digital Download'),
              };
              if (vaultedAsset.url) {
                orderDeliveredAssets[p.id] = vaultedAsset;
                newlyUnlockedDigital[p.id] = vaultedAsset;
              }
            }
          } catch {
            // non-fatal; buyer can re-trigger fetchProtectedDigitalSecret
          }
        }
      }

      void persistTelemetryEvent({
        targetOwnerId: sellerId,
        eventType: 'order_placed',
        channel: 'store',
        targetId: orderId,
        targetTitle: `${orderNumber} · ${itemsSummary}`.slice(0, 150),
        platform: group.sellerName.slice(0, 40),
        valueCents: groupTotal,
      });

      createdOrders.push({
        id: orderId,
        buyerId: effectiveBuyerId,
        sellerId,
        sellerName: group.sellerName.slice(0, 80),
        orderNumber,
        buyerName: cleanBuyerName,
        buyerEmail: cleanBuyerEmail,
        shippingAddress: groupHasPhysical ? cleanAddress : '',
        paymentMethod: cleanPayMethod,
        paymentReference: cleanPayRef,
        productIds,
        itemsSummary,
        itemCount,
        fulfillmentType,
        promoCode: activeCode,
        subtotalCents: groupSubtotal,
        discountCents: groupDiscount,
        shippingCents: groupShipping,
        totalCents: groupTotal,
        platformFeeCents,
        sellerPayoutCents,
        payoutStatus,
        sellerPayoutDetails: ownPayoutDetails,
        payoutNote: '',
        fulfillmentNote: initialFulfillmentNote,
        status: 'paid',
        deliveredDigitalAssets: orderDeliveredAssets,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      });
    }

    if (Object.keys(newlyUnlockedDigital).length > 0) {
      setDeliveredDigitalCache((prev) => {
        const next = { ...prev, ...newlyUnlockedDigital };
        try {
          localStorage.setItem(DELIVERED_DIGITAL_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore storage quota errors
        }
        return next;
      });
    }

    if (Object.keys(seedPhysicalDecrements).length > 0) {
      setSeedStockOffsets((prev) => {
        const next = { ...prev };
        for (const [sid, qty] of Object.entries(seedPhysicalDecrements)) {
          next[sid] = (next[sid] || 0) + qty;
        }
        try {
          localStorage.setItem(SEED_STOCK_OFFSETS_KEY, JSON.stringify(next));
        } catch {
          // ignore storage quota errors
        }
        return next;
      });
    }

    if (!isSignedInBuyer && createdOrders.length > 0) {
      setGuestPurchases((prev) => {
        const next = [...createdOrders, ...prev].slice(0, 30);
        try {
          localStorage.setItem(GUEST_ORDERS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore storage quota errors
        }
        return next;
      });
    }

    clearCart();
    return createdOrders[0];
  }

  async function updateDirectOrderFulfillment(
    orderId: string,
    status: OrderFulfillmentStatus,
    fulfillmentNote: string
  ) {
    assertActiveSellerAccess();
    const targetOrder = sellerOrders.find((o) => o.id === orderId);
    if (targetOrder && targetOrder.sellerId !== user?.uid && !isCreatorAdmin) {
      throw new Error(
        'Only the product seller or Website Owner can update fulfillment.'
      );
    }
    const cleanNote = fulfillmentNote
      .trim()
      .slice(0, VALIDATION_LIMITS.ORDER_FULFILLMENT_NOTE_MAX);
    const path = `directOrders/${orderId}`;
    try {
      await updateDoc(doc(db, 'directOrders', orderId), {
        status,
        fulfillmentNote: cleanNote,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async function updateOrderPayoutDetails(
    orderId: string,
    sellerPayoutDetails: string
  ) {
    assertActiveSellerAccess();
    const cleanDetails = sellerPayoutDetails
      .trim()
      .slice(0, VALIDATION_LIMITS.ORDER_PAYOUT_DETAILS_MAX);
    const path = `directOrders/${orderId}`;
    try {
      await updateDoc(doc(db, 'directOrders', orderId), {
        sellerPayoutDetails: cleanDetails,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async function markSellerOrderPaidOut(
    orderId: string,
    payoutStatus: PayoutSettlementStatus,
    payoutNote: string
  ) {
    assertCreatorAccess();
    const cleanNote = payoutNote
      .trim()
      .slice(0, VALIDATION_LIMITS.ORDER_PAYOUT_NOTE_MAX);
    const path = `directOrders/${orderId}`;
    try {
      await updateDoc(doc(db, 'directOrders', orderId), {
        payoutStatus,
        payoutNote: cleanNote,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  function removeLocalPurchaseRecord(orderId: string) {
    setGuestPurchases((prev) => {
      const next = prev.filter((o) => o.id !== orderId);
      try {
        localStorage.setItem(GUEST_ORDERS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }

  async function deleteDirectOrder(orderId: string) {
    assertCreatorAccess();
    const path = `directOrders/${orderId}`;
    try {
      await deleteDoc(doc(db, 'directOrders', orderId));
      removeLocalPurchaseRecord(orderId);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }

  async function cancelBuyerOrder(orderId: string) {
    if (orderId && guestPurchases.some((o) => o.id === orderId) && !user) {
      setGuestPurchases((prev) => {
        const next = prev.map((o) =>
          o.id === orderId ? { ...o, status: 'cancelled' as const } : o
        );
        try {
          localStorage.setItem(GUEST_ORDERS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      return;
    }
    if (!user) throw new Error('Please sign in first.');
    const path = `directOrders/${orderId}`;
    try {
      await updateDoc(doc(db, 'directOrders', orderId), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async function saveProfileAndAffiliateTags(input: {
    displayName: string;
    bio: string;
    defaultAmazonTag: string;
    defaultDigistoreId: string;
  }) {
    assertCreatorAccess();
    if (!user) throw new Error('Creator sign-in required.');

    const cleanName = (input.displayName.trim() || 'Publisher').slice(
      0,
      VALIDATION_LIMITS.DISPLAY_NAME_MAX
    );
    const cleanBio = input.bio.trim().slice(0, VALIDATION_LIMITS.BIO_MAX);
    const cleanAmazon = input.defaultAmazonTag.trim().slice(0, 60);
    const cleanDigistore = input.defaultDigistoreId.trim().slice(0, 60);
    const safeEmail = (user.email || 'publisher@example.com').slice(0, 254);

    await ensureParentUserProfileExists(user);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: cleanName,
        bio: cleanBio,
        updatedAt: serverTimestamp(),
      });
      setProfile((prev) => ({
        uid: user.uid,
        displayName: cleanName,
        bio: cleanBio,
        isSeller: prev?.isSeller,
        sellerStatus: prev?.sellerStatus,
        storeName: prev?.storeName,
      }));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }

    try {
      const privRef = doc(db, 'users', user.uid, 'private', 'info');
      const snap = await getDoc(privRef);
      if (!snap.exists()) {
        await setDoc(privRef, {
          uid: user.uid,
          email: safeEmail,
          defaultAmazonTag: cleanAmazon,
          defaultDigistoreId: cleanDigistore,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(privRef, {
          email: safeEmail,
          defaultAmazonTag: cleanAmazon,
          defaultDigistoreId: cleanDigistore,
          updatedAt: serverTimestamp(),
        });
      }
      setPrivateInfo((prev) => ({
        uid: user.uid,
        email: safeEmail,
        defaultAmazonTag: cleanAmazon,
        defaultDigistoreId: cleanDigistore,
        payoutMethod: prev?.payoutMethod || 'None',
        payoutAccount: prev?.payoutAccount || '',
        payoutAccounts: prev?.payoutAccounts || [],
      }));
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `users/${user.uid}/private/info`
      );
    }
  }

  async function saveSiteConfig(input: SiteConfigInput): Promise<void> {
    assertCreatorAccess();
    if (!user) throw new Error('Creator sign-in required.');

    const cleanTagline = (
      input.siteTagline.trim() || DEFAULT_SITE_TAGLINE
    ).slice(0, VALIDATION_LIMITS.SITE_TAGLINE_MAX);
    if (cleanTagline.length < VALIDATION_LIMITS.SITE_TAGLINE_MIN) {
      throw new Error('Site tagline must be at least 4 characters.');
    }

    const cleanAnnouncementText = input.announcementText
      .trim()
      .slice(0, VALIDATION_LIMITS.ANNOUNCEMENT_TEXT_MAX);
    const cleanAnnouncementCta = input.announcementCtaLabel
      .trim()
      .slice(0, VALIDATION_LIMITS.ANNOUNCEMENT_CTA_MAX);
    const cleanThresholdCents = Math.max(
      0,
      Math.min(1000000, Math.round(Number(input.freeShippingThresholdCents) || 0))
    );
    const cleanFlatShippingCents = Math.max(
      0,
      Math.min(100000, Math.round(Number(input.flatShippingCents) || 0))
    );
    const cleanDisclosure = (
      input.defaultDisclosureText.trim() || DEFAULT_DISCLOSURE
    ).slice(0, VALIDATION_LIMITS.DISCLOSURE_MAX);
    if (cleanDisclosure.length < VALIDATION_LIMITS.DISCLOSURE_MIN) {
      throw new Error('Default disclosure text must be at least 10 characters.');
    }

    const cleanHiddenSeedIds = Array.from(
      new Set(
        (input.hiddenSeedIds ?? siteConfig.hiddenSeedIds ?? [])
          .map((s) => String(s).trim().slice(0, 128))
          .filter(Boolean)
      )
    ).slice(0, 50);

    const nextBlogEnabled =
      typeof input.blogEnabled === 'boolean'
        ? input.blogEnabled
        : siteConfig.blogEnabled;
    const nextStoreEnabled =
      typeof input.storeEnabled === 'boolean'
        ? input.storeEnabled
        : siteConfig.storeEnabled;
    const nextProductAffEnabled =
      typeof input.productAffiliateEnabled === 'boolean'
        ? input.productAffiliateEnabled
        : siteConfig.productAffiliateEnabled;
    const nextServiceAffEnabled =
      typeof input.serviceAffiliateEnabled === 'boolean'
        ? input.serviceAffiliateEnabled
        : siteConfig.serviceAffiliateEnabled;

    const cleanAboutMission = (
      input.aboutMission !== undefined
        ? input.aboutMission
        : siteConfig.aboutMission || DEFAULT_ABOUT_MISSION
    )
      .trim()
      .slice(0, 2500);
    const cleanAboutStory = (
      input.aboutStory !== undefined
        ? input.aboutStory
        : siteConfig.aboutStory || DEFAULT_ABOUT_STORY
    )
      .trim()
      .slice(0, 4000);
    const cleanContactEmail = sanitizePublicContactEmail(
      input.contactEmail !== undefined
        ? input.contactEmail
        : siteConfig.contactEmail || DEFAULT_CONTACT_EMAIL
    ).slice(0, 254);
    const cleanContactPhone = (
      input.contactPhone !== undefined
        ? input.contactPhone
        : siteConfig.contactPhone || DEFAULT_CONTACT_PHONE
    )
      .trim()
      .slice(0, 80);
    const cleanContactLocation = (
      input.contactLocation !== undefined
        ? input.contactLocation
        : siteConfig.contactLocation || DEFAULT_CONTACT_LOCATION
    )
      .trim()
      .slice(0, 160);
    const cleanPrivacyPolicy = (
      input.privacyPolicySummary !== undefined
        ? input.privacyPolicySummary
        : siteConfig.privacyPolicySummary || DEFAULT_PRIVACY_POLICY_SUMMARY
    )
      .trim()
      .slice(0, 5000);

    await ensureParentUserProfileExists(user);

    const configRef = doc(db, 'siteConfig', 'main');
    const path = 'siteConfig/main';

    try {
      const existingSnap = await getDoc(configRef);
      if (existingSnap.exists()) {
        await updateDoc(configRef, {
          siteTagline: cleanTagline,
          announcementEnabled: Boolean(input.announcementEnabled),
          announcementText: cleanAnnouncementText,
          announcementCtaLabel: cleanAnnouncementCta,
          announcementTargetSection: input.announcementTargetSection,
          freeShippingThresholdCents: cleanThresholdCents,
          flatShippingCents: cleanFlatShippingCents,
          defaultDisclosureText: cleanDisclosure,
          storeCheckoutEnabled: Boolean(input.storeCheckoutEnabled),
          blogEnabled: nextBlogEnabled,
          storeEnabled: nextStoreEnabled,
          productAffiliateEnabled: nextProductAffEnabled,
          serviceAffiliateEnabled: nextServiceAffEnabled,
          showStarterSeeds: Boolean(input.showStarterSeeds),
          hiddenSeedIds: cleanHiddenSeedIds,
          aboutMission: cleanAboutMission,
          aboutStory: cleanAboutStory,
          contactEmail: cleanContactEmail,
          contactPhone: cleanContactPhone,
          contactLocation: cleanContactLocation,
          privacyPolicySummary: cleanPrivacyPolicy,
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(configRef, {
          siteTagline: cleanTagline,
          announcementEnabled: Boolean(input.announcementEnabled),
          announcementText: cleanAnnouncementText,
          announcementCtaLabel: cleanAnnouncementCta,
          announcementTargetSection: input.announcementTargetSection,
          freeShippingThresholdCents: cleanThresholdCents,
          flatShippingCents: cleanFlatShippingCents,
          defaultDisclosureText: cleanDisclosure,
          storeCheckoutEnabled: Boolean(input.storeCheckoutEnabled),
          blogEnabled: nextBlogEnabled,
          storeEnabled: nextStoreEnabled,
          productAffiliateEnabled: nextProductAffEnabled,
          serviceAffiliateEnabled: nextServiceAffEnabled,
          showStarterSeeds: Boolean(input.showStarterSeeds),
          hiddenSeedIds: cleanHiddenSeedIds,
          aboutMission: cleanAboutMission,
          aboutStory: cleanAboutStory,
          contactEmail: cleanContactEmail,
          contactPhone: cleanContactPhone,
          contactLocation: cleanContactLocation,
          privacyPolicySummary: cleanPrivacyPolicy,
          updatedBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setHideSeeds(!input.showStarterSeeds);
      setLocalHiddenSeedIds(cleanHiddenSeedIds);
      try {
        localStorage.setItem(
          HIDE_SEEDS_KEY,
          input.showStarterSeeds ? 'false' : 'true'
        );
        localStorage.setItem(
          HIDDEN_SEED_IDS_KEY,
          JSON.stringify(cleanHiddenSeedIds)
        );
      } catch {
        // ignore storage errors
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  async function submitContactMessage(
    input: ContactMessageInput
  ): Promise<ContactMessage> {
    const cleanName = input.senderName.trim().slice(0, 80);
    if (cleanName.length < 2) {
      throw new Error('Please enter your name (at least 2 characters).');
    }
    const isSignedInSender = isNonAnonymousUser(user);
    const cleanEmail = (
      input.senderEmail.trim() ||
      (isSignedInSender ? user.email || '' : '')
    ).slice(0, 254);
    if (cleanEmail.length < 3 || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid reply-to email address.');
    }
    const cleanCategory: ContactIssueCategory = VALID_CONTACT_CATEGORIES.includes(
      input.category
    )
      ? input.category
      : 'general';
    const cleanOrderNumber = (input.orderNumber || '').trim().slice(0, 40);
    const cleanSubject = input.subject.trim().slice(0, 140);
    if (cleanSubject.length < 3) {
      throw new Error('Please enter a brief subject (at least 3 characters).');
    }
    const cleanMessage = input.message.trim().slice(0, 3000);
    if (cleanMessage.length < 10) {
      throw new Error(
        'Please describe your inquiry or private issue (at least 10 characters).'
      );
    }

    if (isSignedInSender) {
      await ensureParentUserProfileExists(user);
    }

    const senderId = isSignedInSender
      ? user.uid
      : generateSafeDocId('guest');
    const messageId = generateSafeDocId('msg');
    const path = `contactMessages/${messageId}`;
    const nowMs = Date.now();

    try {
      await setDoc(doc(db, 'contactMessages', messageId), {
        senderId,
        senderName: cleanName,
        senderEmail: cleanEmail,
        category: cleanCategory,
        orderNumber: cleanOrderNumber,
        subject: cleanSubject,
        message: cleanMessage,
        status: 'unread',
        adminNote: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }

    const createdRecord: ContactMessage = {
      id: messageId,
      senderId,
      senderName: cleanName,
      senderEmail: cleanEmail,
      category: cleanCategory,
      orderNumber: cleanOrderNumber,
      subject: cleanSubject,
      message: cleanMessage,
      status: 'unread',
      adminNote: '',
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };

    if (!isSignedInSender) {
      setGuestContactMessages((prev) => [createdRecord, ...prev].slice(0, 15));
    }

    return createdRecord;
  }

  async function updateContactMessageStatus(
    messageId: string,
    status: ContactMessageStatus,
    adminNote: string
  ): Promise<void> {
    assertCreatorAccess();
    const cleanStatus: ContactMessageStatus = VALID_CONTACT_STATUSES.includes(
      status
    )
      ? status
      : 'in_review';
    const cleanNote = adminNote.trim().slice(0, 500);
    const path = `contactMessages/${messageId}`;
    try {
      await updateDoc(doc(db, 'contactMessages', messageId), {
        status: cleanStatus,
        adminNote: cleanNote,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async function deleteContactMessage(messageId: string): Promise<void> {
    assertCreatorAccess();
    const path = `contactMessages/${messageId}`;
    try {
      await deleteDoc(doc(db, 'contactMessages', messageId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }

  async function grantCoAdmin(targetUid: string): Promise<void> {
    assertCreatorAccess();
    if (!user) throw new Error('Creator sign-in required.');

    const cleanUid = targetUid.trim();
    if (!VALIDATION_LIMITS.ID_REGEX.test(cleanUid) || cleanUid.length > 128) {
      throw new Error(
        'Enter a valid Firebase Auth UID (letters, numbers, hyphens, underscores).'
      );
    }
    const path = `admins/${cleanUid}`;
    try {
      await setDoc(doc(db, 'admins', cleanUid), {
        uid: cleanUid,
        grantedBy: user.uid,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }

  async function revokeCoAdmin(targetUid: string): Promise<void> {
    assertCreatorAccess();
    const cleanUid = targetUid.trim();
    if (!VALIDATION_LIMITS.ID_REGEX.test(cleanUid)) {
      throw new Error('Invalid UID.');
    }
    const path = `admins/${cleanUid}`;
    try {
      await deleteDoc(doc(db, 'admins', cleanUid));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }

  async function importStarterCatalog() {
    assertCreatorAccess();

    for (const seedOffer of SEED_OFFERS) {
      await saveOffer({
        title: seedOffer.title,
        kind: seedOffer.kind,
        platform: seedOffer.platform,
        category: seedOffer.category,
        priceLabel: seedOffer.priceLabel,
        commissionNote: seedOffer.commissionNote,
        affiliateUrl: seedOffer.affiliateUrl,
        imageKey: seedOffer.imageKey,
        summary: seedOffer.summary,
        highlights: seedOffer.highlights,
        status: 'published',
      });
    }

    const productIdMap: Record<string, string> = {};
    for (const seedProd of SEED_DIRECT_PRODUCTS) {
      const seedDigitalAsset =
        seedProd.kind === 'digital'
          ? buildSeedDigitalBundleAsset(seedProd)
          : null;
      const createdProdId = await saveDirectProduct({
        title: seedProd.title,
        subtitle: seedProd.subtitle,
        kind: seedProd.kind,
        category: seedProd.category,
        sku: seedProd.sku,
        priceCents: seedProd.priceCents,
        compareAtCents: seedProd.compareAtCents,
        stockCount: seedProd.stockCount,
        badgeLabel: seedProd.badgeLabel,
        imageKey: seedProd.imageKey,
        digitalFileUrl: seedDigitalAsset?.url || '',
        digitalFileName: seedDigitalAsset?.fileName || '',
        digitalFileType: seedDigitalAsset?.fileType || '',
        summary: seedProd.summary,
        highlights: seedProd.highlights,
        deliveryNote: seedProd.deliveryNote,
        featured: seedProd.featured,
        status: 'published',
      });
      productIdMap[seedProd.id] = createdProdId;
    }

    for (const seedCamp of SEED_CAMPAIGNS) {
      await saveCampaign({
        title: seedCamp.title,
        description: seedCamp.description,
        promoCode: seedCamp.promoCode,
        discountPercent: seedCamp.discountPercent,
        minOrderCents: seedCamp.minOrderCents,
        channel: seedCamp.channel,
        featuredProductId: productIdMap[seedCamp.featuredProductId] || '',
        ctaLabel: seedCamp.ctaLabel,
        expiresLabel: seedCamp.expiresLabel,
        status: 'published',
      });
    }

    for (const seedPost of SEED_POSTS) {
      // Strip any legacy [[offer:...]] or [[product:...]] tokens so imported Blog posts stay 100% module-independent
      const cleanProse = seedPost.content
        .replace(/\[\[offer:[a-zA-Z0-9_-]+\]\]/g, '')
        .replace(/\[\[product:[a-zA-Z0-9_-]+\]\]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      await savePost({
        title: seedPost.title,
        subtitle: seedPost.subtitle,
        slug: seedPost.slug,
        category: seedPost.category,
        readTimeMinutes: seedPost.readTimeMinutes,
        coverImageKey: seedPost.coverImageKey,
        content: cleanProse,
        theme: seedPost.theme || 'classic',
        attachedOfferIds: [],
        disclosureText: seedPost.disclosureText,
        featured: seedPost.featured,
        status: 'published',
        publishedLabel: seedPost.publishedLabel,
      });
    }

    await saveSiteConfig({
      siteTagline: siteConfig.siteTagline,
      announcementEnabled: siteConfig.announcementEnabled,
      announcementText: siteConfig.announcementText,
      announcementCtaLabel: siteConfig.announcementCtaLabel,
      announcementTargetSection: siteConfig.announcementTargetSection,
      freeShippingThresholdCents: siteConfig.freeShippingThresholdCents,
      flatShippingCents: siteConfig.flatShippingCents,
      defaultDisclosureText: siteConfig.defaultDisclosureText,
      storeCheckoutEnabled: siteConfig.storeCheckoutEnabled,
      blogEnabled: siteConfig.blogEnabled,
      storeEnabled: siteConfig.storeEnabled,
      productAffiliateEnabled: siteConfig.productAffiliateEnabled,
      serviceAffiliateEnabled: siteConfig.serviceAffiliateEnabled,
      showStarterSeeds: false,
      hiddenSeedIds: [],
    });
  }

  function recordOutboundClick(offerId: string) {
    setLocalClickCounts((prev) => {
      const next = { ...prev, [offerId]: (prev[offerId] || 0) + 1 };
      try {
        localStorage.setItem(CLICK_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });

    const offer = allAccessibleOffersMap[offerId];
    if (offer) {
      void persistTelemetryEvent({
        targetOwnerId: offer.authorId || 'editorial_desk',
        eventType: 'affiliate_click',
        channel: offer.kind === 'service' ? 'services' : 'affiliate',
        targetId: offer.id,
        targetTitle: offer.title,
        platform: offer.platform,
        valueCents: 0,
      });
    }
  }

  function recordPostView(post: BlogPost) {
    const key = `post_${post.id}`;
    if (sessionSeenViewsRef.current.has(key)) return;
    sessionSeenViewsRef.current.add(key);

    setLocalPostViews((prev) => {
      const next = { ...prev, [post.id]: (prev[post.id] || 0) + 1 };
      try {
        localStorage.setItem(POST_VIEWS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });

    void persistTelemetryEvent({
      targetOwnerId: post.authorId || 'editorial_desk',
      eventType: 'post_view',
      channel: 'blog',
      targetId: post.id,
      targetTitle: post.title,
      platform: post.category,
      valueCents: 0,
    });
  }

  function recordProductView(product: DirectProduct) {
    const key = `prod_view_${product.id}`;
    if (sessionSeenViewsRef.current.has(key)) return;
    sessionSeenViewsRef.current.add(key);

    void persistTelemetryEvent({
      targetOwnerId: product.sellerId || 'editorial_desk',
      eventType: 'product_view',
      channel: 'store',
      targetId: product.id,
      targetTitle: product.title,
      platform: 'Pickras Store',
      valueCents: product.priceCents,
    });
  }

  async function deleteAnalyticsEvent(eventId: string): Promise<void> {
    assertCreatorAccess();
    const path = `analyticsEvents/${eventId}`;
    try {
      await deleteDoc(doc(db, 'analyticsEvents', eventId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        loadingData,
        loadingPosts,
        loadingProducts,
        loadingOffers,
        publicDataError,
        retryPublicData,
        isBootstrappedCreator,
        isCreatorAdmin,
        adminRoleReady,
        adminRegistry,
        allUsers,
        siteConfig,
        hasSavedSiteConfig: Boolean(firestoreSiteConfig),
        profile,
        privateInfo,
        isActiveSeller,
        isSellerSuspended,
        publishedPosts,
        publishedOffers,
        studioPosts,
        studioOffers,
        allAccessibleOffersMap,
        clickCounts,
        postViewCounts,
        productBagCounts,
        analyticsEvents: firestoreAnalyticsEvents,
        hasFirestoreContent,
        publishedDirectProducts,
        mySellerProducts: effectiveMySellerProducts,
        studioDirectProducts,
        allAccessibleDirectProductsMap,
        publishedCampaigns,
        studioCampaigns,
        myPurchases,
        mySellerOrders,
        sellerOrders,
        deliveredDigitalCache,
        cartItems,
        cartCount,
        cartSubtotalCents,
        appliedPromoCode,
        appliedCampaign,
        cartDiscountCents,
        cartShippingCents,
        cartTotalCents,
        cartRequiresShipping,
        isCartOpen,
        setIsCartOpen,
        cartInitialStep,
        setCartInitialStep,
        addToCart,
        buyNowProduct,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        applyPromoCode,
        clearPromoCode,
        authBusy,
        authError,
        clearAuthError,
        isAuthModalOpen,
        authModalMode,
        authModalSellerPreset,
        openAuthModal,
        closeAuthModal,
        signInWithGoogle,
        registerWithEmailPassword,
        signInWithEmailPassword,
        sendPasswordReset,
        resendOwnerVerificationEmail,
        refreshAuthUser,
        signOutUser,
        registerOrUpdateSellerAccount,
        saveUserPaymentMethods,
        moderateUserSellerStatus,
        saveOffer,
        updateOfferStatus,
        deleteOffer,
        updateOfferImage,
        savePost,
        updatePostStatus,
        deletePost,
        updatePostCoverImage,
        saveDirectProduct,
        updateDirectProductStatus,
        moderateDirectProduct,
        deleteDirectProduct,
        updateDirectProductImage,
        fetchProtectedDigitalSecret,
        saveCampaign,
        updateCampaignStatus,
        deleteCampaign,
        dropdownOptions: adminUiPrefs.dropdownOptions,
        addDropdownOption,
        renameDropdownOption,
        deleteDropdownOption,
        sectionHeaders: adminUiPrefs.sectionHeaders,
        saveSectionHeader,
        resetSectionHeader,
        placeDirectOrder,
        updateDirectOrderFulfillment,
        updateOrderPayoutDetails,
        markSellerOrderPaidOut,
        cancelBuyerOrder,
        removeLocalPurchaseRecord,
        deleteDirectOrder,
        saveProfileAndAffiliateTags,
        saveSiteConfig,
        contactMessages: isBootstrappedCreator
          ? adminContactMessages
          : ownContactMessages,
        myContactMessages: isNonAnonymousUser(user)
          ? ownContactMessages
          : guestContactMessages,
        submitContactMessage,
        updateContactMessageStatus,
        deleteContactMessage,
        hideSeedItem,
        grantCoAdmin,
        revokeCoAdmin,
        importStarterCatalog,
        recordOutboundClick,
        recordPostView,
        recordProductView,
        deleteAnalyticsEvent,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebaseApp() {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebaseApp must be used inside FirebaseProvider');
  }
  return ctx;
}
