export type OfferKind = 'physical' | 'digital' | 'service';

export type DirectProductKind = 'physical' | 'digital';

export type AffiliatePlatform =
  | 'Amazon'
  | 'Digistore24'
  | 'Upwork'
  | 'Fiverr'
  | 'Gumroad'
  | 'ClickBank'
  | 'CJ Affiliate'
  | 'ShareASale'
  | 'Impact'
  | 'eBay'
  | 'Etsy'
  | 'AliExpress'
  | 'Toptal'
  | '99designs'
  | 'Contra'
  | 'PeoplePerHour'
  | 'Custom';

export const PRODUCT_AFFILIATE_PLATFORMS: AffiliatePlatform[] = [
  'Amazon',
  'Digistore24',
  'ClickBank',
  'Gumroad',
  'CJ Affiliate',
  'ShareASale',
  'Impact',
  'eBay',
  'Etsy',
  'AliExpress',
  'Custom',
];

export const SERVICE_AFFILIATE_PLATFORMS: AffiliatePlatform[] = [
  'Fiverr',
  'Upwork',
  'Toptal',
  '99designs',
  'Contra',
  'PeoplePerHour',
  'Custom',
];

export const ALL_AFFILIATE_PLATFORMS: AffiliatePlatform[] = [
  'Amazon',
  'Digistore24',
  'Fiverr',
  'Upwork',
  'ClickBank',
  'Gumroad',
  'CJ Affiliate',
  'ShareASale',
  'Impact',
  'eBay',
  'Etsy',
  'AliExpress',
  'Toptal',
  '99designs',
  'Contra',
  'PeoplePerHour',
  'Custom',
];

export type PublishStatus = 'draft' | 'published' | 'archived';

export type PostCategory =
  | 'Hardware & Gear'
  | 'Digital Systems'
  | 'Freelance Talent'
  | 'Field Guides';

export type BlogColorTheme =
  | 'classic'
  | 'midnight'
  | 'sage'
  | 'terracotta'
  | 'slate';

export type CalloutColorTheme =
  | 'amber'
  | 'sage'
  | 'terracotta'
  | 'slate'
  | 'midnight';

export interface BlogThemeConfig {
  id: BlogColorTheme;
  label: string;
  swatchHex: string;
  canvasClass: string;
  surfaceClass: string;
  textClass: string;
  mutedClass: string;
  borderClass: string;
  isDark: boolean;
}

export const BLOG_THEME_PALETTES: Record<BlogColorTheme, BlogThemeConfig> = {
  classic: {
    id: 'classic',
    label: 'Warm Paper',
    swatchHex: '#FAF8F5',
    canvasClass: 'bg-[#FAF8F5]',
    surfaceClass: 'bg-white',
    textClass: 'text-[#1C1917]',
    mutedClass: 'text-stone-600',
    borderClass: 'border-stone-200/90',
    isDark: false,
  },
  sage: {
    id: 'sage',
    label: 'Botanical Sage',
    swatchHex: '#F1F5F2',
    canvasClass: 'bg-[#F1F5F2]',
    surfaceClass: 'bg-white',
    textClass: 'text-[#16231B]',
    mutedClass: 'text-[#44584C]',
    borderClass: 'border-[#D1DEC8]',
    isDark: false,
  },
  terracotta: {
    id: 'terracotta',
    label: 'Clay & Linen',
    swatchHex: '#FBF4EE',
    canvasClass: 'bg-[#FBF4EE]',
    surfaceClass: 'bg-white',
    textClass: 'text-[#291811]',
    mutedClass: 'text-[#6E4F41]',
    borderClass: 'border-[#EAD6C7]',
    isDark: false,
  },
  slate: {
    id: 'slate',
    label: 'Nordic Slate',
    swatchHex: '#F3F6F9',
    canvasClass: 'bg-[#F3F6F9]',
    surfaceClass: 'bg-white',
    textClass: 'text-[#0F172A]',
    mutedClass: 'text-slate-600',
    borderClass: 'border-slate-200',
    isDark: false,
  },
  midnight: {
    id: 'midnight',
    label: 'Midnight Ink',
    swatchHex: '#15171A',
    canvasClass: 'bg-[#15171A]',
    surfaceClass: 'bg-[#1E2126]',
    textClass: 'text-stone-100',
    mutedClass: 'text-stone-400',
    borderClass: 'border-stone-800',
    isDark: true,
  },
};

export type CampaignChannel =
  | 'Storefront Banner'
  | 'Blog Callout'
  | 'Social & Email'
  | 'Flash Bundle';

export type OrderFulfillmentStatus =
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'fulfilled'
  | 'cancelled';

export type SellerPayoutMethod =
  | 'None'
  | 'Stripe'
  | 'PayPal'
  | 'Wise'
  | 'BankTransfer';

export type PayoutSettlementStatus =
  | 'pending'
  | 'paid_out'
  | 'not_applicable';

export type AnalyticsEventType =
  | 'post_view'
  | 'affiliate_click'
  | 'product_view'
  | 'bag_add'
  | 'promo_apply'
  | 'order_placed';

export type AnalyticsChannel =
  | 'journal'
  | 'blog'
  | 'store'
  | 'affiliate'
  | 'services'
  | 'campaigns';

export type AnnouncementTargetSection =
  | 'store'
  | 'journal'
  | 'blog'
  | 'products'
  | 'services';

export interface AffiliateOffer {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  kind: OfferKind;
  platform: AffiliatePlatform;
  category: string;
  priceLabel: string;
  commissionNote: string;
  affiliateUrl: string;
  imageKey: string;
  summary: string;
  highlights: string[];
  status: PublishStatus;
  isSeed?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface BlogPost {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  subtitle: string;
  slug: string;
  category: PostCategory;
  readTimeMinutes: number;
  coverImageKey: string;
  content: string;
  theme?: BlogColorTheme;
  attachedOfferIds: string[];
  disclosureText: string;
  featured: boolean;
  status: PublishStatus;
  publishedLabel: string;
  isSeed?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface DirectProduct {
  id: string;
  sellerId: string;
  sellerName: string;
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
  isSeed?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface MarketingCampaign {
  id: string;
  authorId: string;
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
  isSeed?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface DirectOrder {
  id: string;
  buyerId: string;
  sellerId: string;
  sellerName?: string;
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  shippingAddress: string;
  productIds: string[];
  itemsSummary: string;
  itemCount: number;
  fulfillmentType: 'physical' | 'digital' | 'mixed';
  promoCode: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  platformFeeCents?: number;
  sellerPayoutCents?: number;
  payoutStatus?: PayoutSettlementStatus;
  sellerPayoutDetails?: string;
  payoutNote?: string;
  fulfillmentNote: string;
  status: OrderFulfillmentStatus;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface SiteConfig {
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
  updatedBy: string;
  updatedAtMs: number;
}

export interface AnalyticsEvent {
  id: string;
  actorId: string;
  actorScope: 'customer' | 'creator';
  targetOwnerId: string;
  eventType: AnalyticsEventType;
  channel: AnalyticsChannel;
  targetId: string;
  targetTitle: string;
  platform: string;
  valueCents: number;
  createdAtMs: number;
}

export interface AdminRecord {
  uid: string;
  grantedBy: string;
  createdAtMs: number;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  bio: string;
  isSeller?: boolean;
  storeName?: string;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  defaultAmazonTag: string;
  defaultDigistoreId: string;
  payoutMethod?: SellerPayoutMethod;
  payoutAccount?: string;
}

export type ActiveSection =
  | 'blog'
  | 'journal'
  | 'store'
  | 'products'
  | 'services'
  | 'write'
  | 'studio';
