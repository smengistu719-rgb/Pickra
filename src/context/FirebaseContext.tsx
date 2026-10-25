import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  generateOrderNumber,
  generateSafeDocId,
  googleProvider,
  handleFirestoreError,
  OperationType,
  toSafePromoCode,
  toSafeSku,
  toSafeSlug,
  VALIDATION_LIMITS,
} from '../firebase';
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
  DirectOrder,
  DirectProduct,
  DirectProductKind,
  MarketingCampaign,
  OrderFulfillmentStatus,
  PayoutSettlementStatus,
  PublishStatus,
  SellerPayoutMethod,
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
}

export interface SellerAccountInput {
  storeName: string;
  bio: string;
  payoutMethod: SellerPayoutMethod;
  payoutAccount: string;
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
  showStarterSeeds: boolean;
  hiddenSeedIds?: string[];
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
  // Website Owner RBAC & Backend Governance
  isBootstrappedCreator: boolean;
  isCreatorAdmin: boolean;
  adminRoleReady: boolean;
  adminRegistry: AdminRecord[];
  siteConfig: SiteConfig;
  hasSavedSiteConfig: boolean;
  // Profiles & Creator Seller Account
  profile: UserProfile | null;
  privateInfo: UserPrivateInfo | null;
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
  addToCart: (productId: string, quantity?: number, openDrawer?: boolean) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  applyPromoCode: (rawCode: string) => { ok: boolean; message: string };
  clearPromoCode: () => void;
  // Auth & Mutations
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  registerOrUpdateSellerAccount: (input: SellerAccountInput) => Promise<void>;
  saveOffer: (input: OfferDraftInput) => Promise<string>;
  updateOfferStatus: (offerId: string, status: PublishStatus) => Promise<void>;
  deleteOffer: (offerId: string) => Promise<void>;
  savePost: (input: PostDraftInput) => Promise<string>;
  updatePostStatus: (postId: string, status: PublishStatus) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  saveDirectProduct: (input: DirectProductDraftInput) => Promise<string>;
  updateDirectProductStatus: (
    productId: string,
    status: PublishStatus,
    stockCount?: number
  ) => Promise<void>;
  deleteDirectProduct: (productId: string) => Promise<void>;
  saveCampaign: (input: CampaignDraftInput) => Promise<string>;
  updateCampaignStatus: (campaignId: string, status: PublishStatus) => Promise<void>;
  deleteCampaign: (campaignId: string) => Promise<void>;
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
  saveProfileAndAffiliateTags: (input: {
    displayName: string;
    bio: string;
    defaultAmazonTag: string;
    defaultDigistoreId: string;
  }) => Promise<void>;
  saveSiteConfig: (input: SiteConfigInput) => Promise<void>;
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
export const BOOTSTRAPPED_ADMIN_EMAIL = 'mengistushimelis@gmail.com';
const DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS = 9500;
const DEFAULT_FLAT_PHYSICAL_SHIPPING_CENTS = 900;

const DEFAULT_SITE_TAGLINE =
  'Independent editorial blog, multi-creator product store, and global affiliate directory.';

const VALID_BLOG_THEMES: BlogColorTheme[] = [
  'classic',
  'midnight',
  'sage',
  'terracotta',
  'slate',
];

const VALID_PAYOUT_METHODS: SellerPayoutMethod[] = [
  'None',
  'Stripe',
  'PayPal',
  'Wise',
  'BankTransfer',
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

function parseOfferDoc(id: string, data: Record<string, unknown>): AffiliateOffer {
  return {
    id,
    authorId: String(data.authorId || ''),
    authorName: String(data.authorName || 'Pickra Editorial'),
    title: String(data.title || ''),
    kind: (data.kind as AffiliateOffer['kind']) || 'physical',
    platform: (data.platform as AffiliateOffer['platform']) || 'Amazon',
    category: String(data.category || 'General'),
    priceLabel: String(data.priceLabel || ''),
    commissionNote: String(data.commissionNote || ''),
    affiliateUrl: String(data.affiliateUrl || ''),
    imageKey: String(data.imageKey || 'workspace'),
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
    authorName: String(data.authorName || 'Pickra Editorial'),
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
    status: (data.status as PublishStatus) || 'draft',
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
  return {
    id,
    sellerId: String(data.sellerId || ''),
    sellerName: String(data.sellerName || 'Pickra Studio'),
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
    summary: String(data.summary || ''),
    highlights: Array.isArray(data.highlights)
      ? data.highlights.map((h) => String(h)).slice(0, 4)
      : [],
    deliveryNote: String(data.deliveryNote || 'Direct creator fulfillment'),
    featured: Boolean(data.featured),
    status: (data.status as PublishStatus) || 'draft',
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

  return {
    id,
    buyerId: String(data.buyerId || ''),
    sellerId,
    sellerName: String(
      data.sellerName ||
        (sellerId === 'editorial_desk' ? 'Pickra House Studio' : 'Creator Seller')
    ),
    orderNumber: String(data.orderNumber || id),
    buyerName: String(data.buyerName || ''),
    buyerEmail: String(data.buyerEmail || ''),
    shippingAddress: String(data.shippingAddress || ''),
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
    showStarterSeeds:
      typeof data.showStarterSeeds === 'boolean'
        ? data.showStarterSeeds
        : fallbackShowSeeds,
    hiddenSeedIds,
    updatedBy: String(data.updatedBy || ''),
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
    platform: String(data.platform || 'Pickra'),
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

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [isCoAdmin, setIsCoAdmin] = useState(false);
  const [adminRoleReady, setAdminRoleReady] = useState(false);
  const [adminRegistry, setAdminRegistry] = useState<AdminRecord[]>([]);

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

  const [myPurchases, setMyPurchases] = useState<DirectOrder[]>([]);
  const [mySellerOrders, setMySellerOrders] = useState<DirectOrder[]>([]);
  const [adminAllOrders, setAdminAllOrders] = useState<DirectOrder[]>([]);
  const [firestoreAnalyticsEvents, setFirestoreAnalyticsEvents] = useState<
    AnalyticsEvent[]
  >([]);

  const [isCartOpen, setIsCartOpen] = useState(false);

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

  const isBootstrappedCreator = Boolean(
    user &&
      user.emailVerified &&
      user.email &&
      user.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
  );

  const isCreatorAdmin = Boolean(
    user && user.emailVerified && (isBootstrappedCreator || isCoAdmin)
  );

  const siteConfig: SiteConfig = useMemo(() => {
    const mergedHidden = Array.from(
      new Set([
        ...(firestoreSiteConfig?.hiddenSeedIds || []),
        ...localHiddenSeedIds,
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
        'Free tracked courier shipping on Pickra Direct physical orders over $95 · Use code PICKRA15',
      announcementCtaLabel: 'Shop Direct',
      announcementTargetSection: 'store',
      freeShippingThresholdCents: DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS,
      flatShippingCents: DEFAULT_FLAT_PHYSICAL_SHIPPING_CENTS,
      defaultDisclosureText: DEFAULT_DISCLOSURE,
      storeCheckoutEnabled: true,
      showStarterSeeds: !hideSeeds,
      hiddenSeedIds: mergedHidden,
      updatedBy: '',
      updatedAtMs: 0,
    };
  }, [firestoreSiteConfig, hideSeeds, localHiddenSeedIds]);

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
    if (!user || !user.emailVerified) {
      setIsCoAdmin(false);
      setAdminRoleReady(true);
      return;
    }
    if (user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
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

  // Ensure User Public Profile & Split Private Info exist upon verified Google Sign-In
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setProfile(null);
      setPrivateInfo(null);
      return;
    }

    let cancelled = false;

    async function bootstrapUserRecords(currentUser: User) {
      const userPath = `users/${currentUser.uid}`;
      const privatePath = `users/${currentUser.uid}/private/info`;

      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);

        const defaultName = (
          currentUser.displayName ||
          currentUser.email?.split('@')[0] ||
          'Member'
        )
          .trim()
          .slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX);

        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: currentUser.uid,
            displayName: defaultName,
            bio: 'Pickra editorial & creator store member.',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          if (!cancelled) {
            setProfile({
              uid: currentUser.uid,
              displayName: defaultName,
              bio: 'Pickra editorial & creator store member.',
              isSeller: false,
              storeName: '',
            });
          }
        } else if (!cancelled) {
          const d = userSnap.data();
          setProfile({
            uid: currentUser.uid,
            displayName: String(d.displayName || defaultName),
            bio: String(d.bio || ''),
            isSeller: Boolean(d.isSeller),
            storeName: String(d.storeName || ''),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, userPath);
      }

      try {
        const privRef = doc(db, 'users', currentUser.uid, 'private', 'info');
        const privSnap = await getDoc(privRef);
        const safeEmail = (currentUser.email || 'member@example.com').slice(0, 254);

        if (!privSnap.exists()) {
          await setDoc(privRef, {
            uid: currentUser.uid,
            email: safeEmail,
            defaultAmazonTag: '',
            defaultDigistoreId: '',
            payoutMethod: 'None',
            payoutAccount: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          if (!cancelled) {
            setPrivateInfo({
              uid: currentUser.uid,
              email: safeEmail,
              defaultAmazonTag: '',
              defaultDigistoreId: '',
              payoutMethod: 'None',
              payoutAccount: '',
            });
          }
        } else if (!cancelled) {
          const pd = privSnap.data();
          const rawMethod = String(pd.payoutMethod || 'None') as SellerPayoutMethod;
          setPrivateInfo({
            uid: currentUser.uid,
            email: String(pd.email || safeEmail),
            defaultAmazonTag: String(pd.defaultAmazonTag || ''),
            defaultDigistoreId: String(pd.defaultDigistoreId || ''),
            payoutMethod: VALID_PAYOUT_METHODS.includes(rawMethod)
              ? rawMethod
              : 'None',
            payoutAccount: String(pd.payoutAccount || ''),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, privatePath);
      }

      // Flush queued pre-login telemetry events cleanly now that /users/{uid} exists
      try {
        const rawQueued = sessionStorage.getItem(PENDING_TELEMETRY_KEY);
        if (rawQueued) {
          sessionStorage.removeItem(PENDING_TELEMETRY_KEY);
          const parsedQueue = JSON.parse(rawQueued);
          if (Array.isArray(parsedQueue)) {
            const actorScope: 'customer' | 'creator' =
              currentUser.email?.toLowerCase() ===
              BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
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
                targetTitle: String(item.targetTitle || 'Pickra Item').slice(
                  0,
                  VALIDATION_LIMITS.EVENT_TITLE_MAX
                ),
                platform: String(item.platform || 'Pickra').slice(
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
    }

    void bootstrapUserRecords(user);
    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  // Public listeners: SiteConfig singleton, Published Offers, Posts, Direct Products, & Campaigns
  useEffect(() => {
    if (!authReady) return;

    let offersLoaded = false;
    let postsLoaded = false;

    const siteConfigRef = doc(db, 'siteConfig', 'main');
    const publishedOffersQuery = query(
      collection(db, 'offers'),
      where('status', '==', 'published')
    );
    const publishedPostsQuery = query(
      collection(db, 'posts'),
      where('status', '==', 'published')
    );
    const publishedProductsQuery = query(
      collection(db, 'directProducts'),
      where('status', '==', 'published')
    );
    const publishedCampaignsQuery = query(
      collection(db, 'campaigns'),
      where('status', '==', 'published')
    );

    const unsubSiteConfig = onSnapshot(
      siteConfigRef,
      (snap) => {
        if (snap.exists()) {
          setFirestoreSiteConfig(
            parseSiteConfigDoc(snap.data() as Record<string, unknown>, !hideSeeds)
          );
        } else {
          setFirestoreSiteConfig(null);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'siteConfig/main');
      }
    );

    const unsubOffers = onSnapshot(
      publishedOffersQuery,
      (snap) => {
        const items = snap.docs.map((d) =>
          parseOfferDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setPublicFirestoreOffers(items);
        offersLoaded = true;
        if (postsLoaded) setLoadingData(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'offers');
      }
    );

    const unsubPosts = onSnapshot(
      publishedPostsQuery,
      (snap) => {
        const items = snap.docs.map((d) =>
          parsePostDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setPublicFirestorePosts(items);
        postsLoaded = true;
        if (offersLoaded) setLoadingData(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'posts');
      }
    );

    const unsubProducts = onSnapshot(
      publishedProductsQuery,
      (snap) => {
        const items = snap.docs.map((d) =>
          parseDirectProductDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setPublicFirestoreProducts(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'directProducts');
      }
    );

    const unsubCampaigns = onSnapshot(
      publishedCampaignsQuery,
      (snap) => {
        const items = snap.docs.map((d) =>
          parseCampaignDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setPublicFirestoreCampaigns(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'campaigns');
      }
    );

    return () => {
      unsubSiteConfig();
      unsubOffers();
      unsubPosts();
      unsubProducts();
      unsubCampaigns();
    };
  }, [authReady, hideSeeds]);

  // Verified Customer Purchases + Creator Seller Hub + Website Owner Backend Listeners
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setAuthorFirestoreOffers([]);
      setAuthorFirestorePosts([]);
      setOwnSellerProducts([]);
      setAdminAllProducts([]);
      setAuthorFirestoreCampaigns([]);
      setMyPurchases([]);
      setMySellerOrders([]);
      setAdminAllOrders([]);
      setFirestoreAnalyticsEvents([]);
      setAdminRegistry([]);
      return;
    }

    // 1. Every verified user can view their own customer purchases
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
        setMyPurchases(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'directOrders');
      }
    );

    // 2. Every verified user can manage their own Creator Store products & incoming seller payouts
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

    // 3. Website Owner / Creator Admin Backend Listeners
    if (!isCreatorAdmin) {
      setAuthorFirestoreOffers([]);
      setAuthorFirestorePosts([]);
      setAdminAllProducts([]);
      setAuthorFirestoreCampaigns([]);
      setAdminAllOrders([]);
      setFirestoreAnalyticsEvents([]);
      setAdminRegistry([]);
      return () => {
        unsubBuyerOrders();
        unsubOwnProducts();
        unsubOwnSellerOrders();
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
    }

    return () => {
      unsubBuyerOrders();
      unsubOwnProducts();
      unsubOwnSellerOrders();
      unsubOffers();
      unsubPosts();
      unsubCampaigns();
      unsubAnalytics();
      unsubAdmins();
      unsubAdminProducts();
      unsubAdminOrders();
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
      map.set(offer.id, offer);
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
      map.set(post.id, post);
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
      map.set(prod.id, prod);
    }
    if (includeSeeds) {
      for (const seed of SEED_DIRECT_PRODUCTS) {
        if (!map.has(seed.id) && !hiddenSeedSet.has(seed.id)) {
          map.set(seed.id, seed);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return b.updatedAtMs - a.updatedAtMs;
    });
  }, [publicFirestoreProducts, includeSeeds, hiddenSeedSet]);

  const publishedCampaigns = useMemo(() => {
    const map = new Map<string, MarketingCampaign>();
    for (const camp of publicFirestoreCampaigns) {
      map.set(camp.id, camp);
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
      map.set(offer.id, offer);
    }
    for (const offer of publicFirestoreOffers) {
      if (!map.has(offer.id)) {
        map.set(offer.id, offer);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [authorFirestoreOffers, publicFirestoreOffers]);

  const studioPosts = useMemo(() => {
    const map = new Map<string, BlogPost>();
    for (const post of authorFirestorePosts) {
      map.set(post.id, post);
    }
    for (const post of publicFirestorePosts) {
      if (!map.has(post.id)) {
        map.set(post.id, post);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [authorFirestorePosts, publicFirestorePosts]);

  const studioDirectProducts = useMemo(() => {
    const map = new Map<string, DirectProduct>();
    for (const prod of adminAllProducts) {
      map.set(prod.id, prod);
    }
    for (const prod of ownSellerProducts) {
      map.set(prod.id, prod);
    }
    for (const prod of publicFirestoreProducts) {
      if (!map.has(prod.id)) {
        map.set(prod.id, prod);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [adminAllProducts, ownSellerProducts, publicFirestoreProducts]);

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
      map.set(camp.id, camp);
    }
    for (const camp of publicFirestoreCampaigns) {
      if (!map.has(camp.id)) {
        map.set(camp.id, camp);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [authorFirestoreCampaigns, publicFirestoreCampaigns]);

  const allAccessibleOffersMap = useMemo(() => {
    const record: Record<string, AffiliateOffer> = {};
    for (const seed of SEED_OFFERS) {
      if (!hiddenSeedSet.has(seed.id)) {
        record[seed.id] = seed;
      }
    }
    for (const pub of publicFirestoreOffers) {
      record[pub.id] = pub;
    }
    for (const own of authorFirestoreOffers) {
      record[own.id] = own;
    }
    return record;
  }, [publicFirestoreOffers, authorFirestoreOffers, hiddenSeedSet]);

  const allAccessibleDirectProductsMap = useMemo(() => {
    const record: Record<string, DirectProduct> = {};
    for (const seed of SEED_DIRECT_PRODUCTS) {
      if (!hiddenSeedSet.has(seed.id)) {
        record[seed.id] = seed;
      }
    }
    for (const pub of publicFirestoreProducts) {
      record[pub.id] = pub;
    }
    for (const own of ownSellerProducts) {
      record[own.id] = own;
    }
    for (const adm of adminAllProducts) {
      record[adm.id] = adm;
    }
    return record;
  }, [publicFirestoreProducts, ownSellerProducts, adminAllProducts, hiddenSeedSet]);

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
    const userRef = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(userRef);
    const fallbackName = (
      profile?.storeName ||
      profile?.displayName ||
      currentUser.displayName ||
      currentUser.email?.split('@')[0] ||
      'Creator'
    )
      .trim()
      .slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX);

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: currentUser.uid,
        displayName: fallbackName,
        bio: 'Pickra editorial & creator store member.',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return fallbackName;
    }
    const d = snap.data();
    return String(d.storeName || d.displayName || fallbackName).slice(
      0,
      VALIDATION_LIMITS.DISPLAY_NAME_MAX
    );
  }

  async function persistTelemetryEvent(payload: PendingTelemetryPayload) {
    const cleanTargetId = sanitizeSafeId(payload.targetId, 'item');
    const cleanOwnerId = sanitizeSafeId(payload.targetOwnerId, 'editorial_desk');
    const cleanTitle = (payload.targetTitle.trim() || 'Pickra Item').slice(
      0,
      VALIDATION_LIMITS.EVENT_TITLE_MAX
    );
    const cleanPlatform = (payload.platform.trim() || 'Pickra').slice(
      0,
      VALIDATION_LIMITS.EVENT_PLATFORM_MAX
    );
    const cleanValueCents = Math.max(
      0,
      Math.min(50000000, Math.round(Number(payload.valueCents) || 0))
    );

    if (!user || !user.emailVerified) {
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
    if (!product || product.stockCount <= 0) return;

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
      platform: 'Pickra Direct',
      valueCents: product.priceCents * Math.max(1, quantity),
    });

    if (openDrawer) {
      setIsCartOpen(true);
    }
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
      message: `Applied ${found.promoCode} for ${found.discountPercent}% off your direct order.`,
    };
  }

  function clearPromoCode() {
    setAppliedPromoCode('');
  }

  async function signInWithGoogle() {
    await signInWithPopup(auth, googleProvider);
  }

  async function signOutUser() {
    await signOut(auth);
  }

  function assertCreatorAccess() {
    if (!user || !user.emailVerified) {
      throw new Error('Sign in with your verified Website Owner Google account first.');
    }
    if (!isCreatorAdmin) {
      throw new Error(
        'Website Owner permission required: only authorized Pickra administrators can modify global blog stories, affiliate links, or backend settings.'
      );
    }
  }

  function assertVerifiedSeller() {
    if (!user || !user.emailVerified) {
      throw new Error('Sign in with a verified Google account to publish and sell products.');
    }
  }

  async function hideSeedItem(seedId: string): Promise<void> {
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

    if (user && user.emailVerified && isCreatorAdmin) {
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
        showStarterSeeds: siteConfig.showStarterSeeds,
        hiddenSeedIds: nextHidden,
      });
    }
  }

  async function registerOrUpdateSellerAccount(
    input: SellerAccountInput
  ): Promise<void> {
    assertVerifiedSeller();
    if (!user) throw new Error('Sign-in required.');

    const cleanStoreName = (
      input.storeName.trim() ||
      profile?.displayName ||
      user.displayName ||
      'Creator Studio'
    ).slice(0, VALIDATION_LIMITS.STORE_NAME_MAX);
    const cleanBio = input.bio.trim().slice(0, VALIDATION_LIMITS.BIO_MAX);
    const cleanMethod: SellerPayoutMethod = VALID_PAYOUT_METHODS.includes(
      input.payoutMethod
    )
      ? input.payoutMethod
      : 'Stripe';
    const cleanPayoutAccount = input.payoutAccount
      .trim()
      .slice(0, VALIDATION_LIMITS.PAYOUT_ACCOUNT_MAX);
    const safeEmail = (user.email || 'creator@example.com').slice(0, 254);

    await ensureParentUserProfileExists(user);

    const displayName = (
      profile?.displayName ||
      user.displayName ||
      cleanStoreName
    ).slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName,
        bio: cleanBio,
        isSeller: true,
        storeName: cleanStoreName,
        updatedAt: serverTimestamp(),
      });
      setProfile({
        uid: user.uid,
        displayName,
        bio: cleanBio,
        isSeller: true,
        storeName: cleanStoreName,
      });
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
          defaultAmazonTag: privateInfo?.defaultAmazonTag || '',
          defaultDigistoreId: privateInfo?.defaultDigistoreId || '',
          payoutMethod: cleanMethod,
          payoutAccount: cleanPayoutAccount,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(privRef, {
          email: safeEmail,
          payoutMethod: cleanMethod,
          payoutAccount: cleanPayoutAccount,
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
      }));
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `users/${user.uid}/private/info`
      );
    }
  }

  async function saveOffer(input: OfferDraftInput): Promise<string> {
    assertCreatorAccess();
    if (!user) throw new Error('Creator sign-in required.');

    const cleanTitle = input.title.trim().slice(0, VALIDATION_LIMITS.OFFER_TITLE_MAX);
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
    const cleanSummary = input.summary.trim().slice(0, VALIDATION_LIMITS.SUMMARY_MAX);
    if (cleanSummary.length < VALIDATION_LIMITS.SUMMARY_MIN) {
      throw new Error('Summary verdict must be at least 10 characters.');
    }

    const cleanHighlights = input.highlights
      .map((item) => item.trim().slice(0, VALIDATION_LIMITS.HIGHLIGHT_ITEM_MAX))
      .filter((item) => item.length >= 1)
      .slice(0, VALIDATION_LIMITS.HIGHLIGHTS_MAX_COUNT);

    const authorName = await ensureParentUserProfileExists(user);
    const replacingSeedId =
      input.id && input.id.startsWith('seed_') ? input.id : null;
    const isUpdate = Boolean(input.id && !input.id.startsWith('seed_'));
    const offerId = isUpdate && input.id ? input.id : generateSafeDocId('offer');
    const path = `offers/${offerId}`;

    try {
      if (isUpdate) {
        await updateDoc(doc(db, 'offers', offerId), {
          authorName,
          title: cleanTitle,
          kind: input.kind,
          platform: input.platform,
          category: cleanCategory,
          priceLabel: cleanPrice,
          commissionNote: cleanCommission,
          affiliateUrl: cleanUrl,
          imageKey: cleanImageKey,
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
          platform: input.platform,
          category: cleanCategory,
          priceLabel: cleanPrice,
          commissionNote: cleanCommission,
          affiliateUrl: cleanUrl,
          imageKey: cleanImageKey,
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
    if (!user) throw new Error('Creator sign-in required.');

    const cleanTitle = input.title.trim().slice(0, VALIDATION_LIMITS.POST_TITLE_MAX);
    if (cleanTitle.length < VALIDATION_LIMITS.POST_TITLE_MIN) {
      throw new Error('Headline must be at least 4 characters.');
    }

    const cleanSubtitle = input.subtitle
      .trim()
      .slice(0, VALIDATION_LIMITS.POST_SUBTITLE_MAX);
    if (cleanSubtitle.length < VALIDATION_LIMITS.POST_SUBTITLE_MIN) {
      throw new Error('Article subtitle must be at least 8 characters.');
    }

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

    const cleanAttachedIds = Array.from(new Set(input.attachedOfferIds))
      .filter((oid) => VALIDATION_LIMITS.ID_REGEX.test(oid) && oid.length <= 128)
      .slice(0, VALIDATION_LIMITS.POST_ATTACHED_OFFERS_MAX);

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
    const isUpdate = Boolean(input.id && !input.id.startsWith('seed_'));
    const postId = isUpdate && input.id ? input.id : generateSafeDocId('post');
    const path = `posts/${postId}`;

    try {
      if (isUpdate) {
        await updateDoc(doc(db, 'posts', postId), {
          authorName,
          title: cleanTitle,
          subtitle: cleanSubtitle,
          slug: cleanSlug,
          category: input.category,
          readTimeMinutes: cleanReadMinutes,
          coverImageKey: cleanCover,
          content: cleanContent,
          theme: cleanTheme,
          attachedOfferIds: cleanAttachedIds,
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
          category: input.category,
          readTimeMinutes: cleanReadMinutes,
          coverImageKey: cleanCover,
          content: cleanContent,
          theme: cleanTheme,
          attachedOfferIds: cleanAttachedIds,
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

  async function updatePostStatus(postId: string, status: PublishStatus) {
    assertCreatorAccess();
    if (postId.startsWith('seed_')) {
      if (status !== 'published') {
        await hideSeedItem(postId);
      }
      return;
    }
    const path = `posts/${postId}`;
    const publishedLabel = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
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
    assertVerifiedSeller();
    if (!user) throw new Error('Sign-in required.');

    const replacingSeedId =
      input.id && input.id.startsWith('seed_') ? input.id : null;
    if (replacingSeedId && !isCreatorAdmin) {
      throw new Error('Only the Website Owner can edit house starter editions.');
    }

    const isUpdate = Boolean(input.id && !input.id.startsWith('seed_'));
    if (isUpdate && input.id) {
      const existing = allAccessibleDirectProductsMap[input.id];
      if (existing && existing.sellerId !== user.uid && !isCreatorAdmin) {
        throw new Error('You can only edit products published by your own seller account.');
      }
    }

    const cleanTitle = input.title.trim().slice(0, VALIDATION_LIMITS.OFFER_TITLE_MAX);
    if (cleanTitle.length < VALIDATION_LIMITS.OFFER_TITLE_MIN) {
      throw new Error('Product title must be at least 2 characters.');
    }

    const cleanSubtitle = input.subtitle
      .trim()
      .slice(0, VALIDATION_LIMITS.PRODUCT_SUBTITLE_MAX);
    if (cleanSubtitle.length < VALIDATION_LIMITS.PRODUCT_SUBTITLE_MIN) {
      throw new Error('Product subtitle must be at least 4 characters.');
    }

    const cleanCategory = (input.category.trim() || 'Creator Editions').slice(
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
    const cleanSummary = input.summary
      .trim()
      .slice(0, VALIDATION_LIMITS.PRODUCT_SUMMARY_MAX);
    if (cleanSummary.length < VALIDATION_LIMITS.SUMMARY_MIN) {
      throw new Error('Product summary must be at least 10 characters.');
    }

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

    const resolvedSellerName = await ensureParentUserProfileExists(user);
    const existingProd =
      isUpdate && input.id ? allAccessibleDirectProductsMap[input.id] : undefined;
    const sellerName =
      existingProd && existingProd.sellerId !== user.uid
        ? existingProd.sellerName
        : resolvedSellerName;

    const productId = isUpdate && input.id ? input.id : generateSafeDocId('prod');
    const path = `directProducts/${productId}`;

    try {
      if (isUpdate) {
        await updateDoc(doc(db, 'directProducts', productId), {
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
          summary: cleanSummary,
          highlights: cleanHighlights,
          deliveryNote: cleanDeliveryNote,
          featured: Boolean(input.featured),
          status: input.status,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'directProducts', productId), {
          sellerId: user.uid,
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
          summary: cleanSummary,
          highlights: cleanHighlights,
          deliveryNote: cleanDeliveryNote,
          featured: Boolean(input.featured),
          status: input.status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

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

  async function updateDirectProductStatus(
    productId: string,
    status: PublishStatus,
    stockCount?: number
  ) {
    assertVerifiedSeller();
    if (productId.startsWith('seed_')) {
      assertCreatorAccess();
      if (status !== 'published') {
        await hideSeedItem(productId);
      }
      return;
    }
    const existingProd = allAccessibleDirectProductsMap[productId];
    if (existingProd && existingProd.sellerId !== user?.uid && !isCreatorAdmin) {
      throw new Error('You can only update your own published products.');
    }
    const nextStock =
      typeof stockCount === 'number'
        ? Math.max(0, Math.min(100000, Math.round(stockCount)))
        : existingProd?.stockCount ?? 10;
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
    assertVerifiedSeller();
    if (productId.startsWith('seed_')) {
      assertCreatorAccess();
      await hideSeedItem(productId);
      return;
    }
    const existingProd = allAccessibleDirectProductsMap[productId];
    if (existingProd && existingProd.sellerId !== user?.uid && !isCreatorAdmin) {
      throw new Error('You can only delete products published by your own seller account.');
    }
    const path = `directProducts/${productId}`;
    try {
      await deleteDoc(doc(db, 'directProducts', productId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }

  async function saveCampaign(input: CampaignDraftInput): Promise<string> {
    assertCreatorAccess();
    if (!user) throw new Error('Creator sign-in required.');

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
    const isUpdate = Boolean(input.id && !input.id.startsWith('seed_'));
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
          channel: input.channel,
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
          channel: input.channel,
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
    if (!user || !user.emailVerified) {
      throw new Error('Please sign in with Google to place your direct order.');
    }
    if (!siteConfig.storeCheckoutEnabled) {
      throw new Error(
        'Direct Store checkout is temporarily paused by the website owner. Please check back shortly.'
      );
    }
    if (cartItems.length === 0) {
      throw new Error('Your shopping bag is empty.');
    }

    const resolvedLines = cartItems
      .map((item) => {
        const product = allAccessibleDirectProductsMap[item.productId];
        return product ? { product, quantity: item.quantity } : null;
      })
      .filter(
        (line): line is { product: DirectProduct; quantity: number } => Boolean(line)
      );

    if (resolvedLines.length === 0) {
      throw new Error('Selected products are no longer available.');
    }

    const cleanBuyerName = input.buyerName
      .trim()
      .slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX);
    if (cleanBuyerName.length < 2) {
      throw new Error('Enter your full name (at least 2 characters).');
    }

    const cleanBuyerEmail = (input.buyerEmail.trim() || user.email || '').slice(
      0,
      254
    );
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

    await ensureParentUserProfileExists(user);

    // Group cart items per Creator Seller so each creator receives an isolated order & net payout ledger!
    const groupedBySeller = new Map<
      string,
      { sellerName: string; lines: { product: DirectProduct; quantity: number }[] }
    >();
    for (const line of resolvedLines) {
      const sId = line.product.sellerId || 'editorial_desk';
      const sName = line.product.sellerName || 'Pickra Studio';
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
          ? 'Instant digital edition unlocked. Access your files anytime in My Purchases.'
          : `Order received by ${group.sellerName}. Preparing tracked dispatch.`;

      const path = `directOrders/${orderId}`;
      try {
        await setDoc(doc(db, 'directOrders', orderId), {
          buyerId: user.uid,
          sellerId,
          sellerName: group.sellerName.slice(0, 80),
          orderNumber,
          buyerName: cleanBuyerName,
          buyerEmail: cleanBuyerEmail,
          shippingAddress: groupHasPhysical ? cleanAddress : '',
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
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
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
        buyerId: user.uid,
        sellerId,
        sellerName: group.sellerName.slice(0, 80),
        orderNumber,
        buyerName: cleanBuyerName,
        buyerEmail: cleanBuyerEmail,
        shippingAddress: groupHasPhysical ? cleanAddress : '',
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
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
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
    assertVerifiedSeller();
    const targetOrder = sellerOrders.find((o) => o.id === orderId);
    if (targetOrder && targetOrder.sellerId !== user?.uid && !isCreatorAdmin) {
      throw new Error('Only the product seller or Website Owner can update fulfillment.');
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
    assertVerifiedSeller();
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

  async function cancelBuyerOrder(orderId: string) {
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
          showStarterSeeds: Boolean(input.showStarterSeeds),
          hiddenSeedIds: cleanHiddenSeedIds,
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
          showStarterSeeds: Boolean(input.showStarterSeeds),
          hiddenSeedIds: cleanHiddenSeedIds,
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

    const offerIdMap: Record<string, string> = {};
    for (const seedOffer of SEED_OFFERS) {
      const createdId = await saveOffer({
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
      offerIdMap[seedOffer.id] = createdId;
    }

    const productIdMap: Record<string, string> = {};
    for (const seedProd of SEED_DIRECT_PRODUCTS) {
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
      let remappedContent = seedPost.content;
      for (const [oldId, newId] of Object.entries(offerIdMap)) {
        remappedContent = remappedContent
          .split(`[[offer:${oldId}]]`)
          .join(`[[offer:${newId}]]`);
      }
      for (const [oldPid, newPid] of Object.entries(productIdMap)) {
        remappedContent = remappedContent
          .split(`[[product:${oldPid}]]`)
          .join(`[[product:${newPid}]]`);
      }
      const remappedAttached = seedPost.attachedOfferIds.map(
        (oldId) => offerIdMap[oldId] || oldId
      );
      await savePost({
        title: seedPost.title,
        subtitle: seedPost.subtitle,
        slug: seedPost.slug,
        category: seedPost.category,
        readTimeMinutes: seedPost.readTimeMinutes,
        coverImageKey: seedPost.coverImageKey,
        content: remappedContent,
        theme: seedPost.theme || 'classic',
        attachedOfferIds: remappedAttached,
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
      platform: 'Pickra Direct',
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
        isBootstrappedCreator,
        isCreatorAdmin,
        adminRoleReady,
        adminRegistry,
        siteConfig,
        hasSavedSiteConfig: Boolean(firestoreSiteConfig),
        profile,
        privateInfo,
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
        mySellerProducts: ownSellerProducts,
        studioDirectProducts,
        allAccessibleDirectProductsMap,
        publishedCampaigns,
        studioCampaigns,
        myPurchases,
        mySellerOrders,
        sellerOrders,
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
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        applyPromoCode,
        clearPromoCode,
        signInWithGoogle,
        signOutUser,
        registerOrUpdateSellerAccount,
        saveOffer,
        updateOfferStatus,
        deleteOffer,
        savePost,
        updatePostStatus,
        deletePost,
        saveDirectProduct,
        updateDirectProductStatus,
        deleteDirectProduct,
        saveCampaign,
        updateCampaignStatus,
        deleteCampaign,
        placeDirectOrder,
        updateDirectOrderFulfillment,
        updateOrderPayoutDetails,
        markSellerOrderPaidOut,
        cancelBuyerOrder,
        saveProfileAndAffiliateTags,
        saveSiteConfig,
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
