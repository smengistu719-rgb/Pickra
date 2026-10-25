export type OfferKind = 'physical' | 'digital' | 'service';

export type AffiliatePlatform =
  | 'Amazon'
  | 'Digistore24'
  | 'Upwork'
  | 'Fiverr'
  | 'Gumroad'
  | 'ClickBank'
  | 'Custom';

export type PublishStatus = 'draft' | 'published' | 'archived';

export type PostCategory =
  | 'Hardware & Gear'
  | 'Digital Systems'
  | 'Freelance Talent'
  | 'Field Guides';

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
  attachedOfferIds: string[];
  disclosureText: string;
  featured: boolean;
  status: PublishStatus;
  publishedLabel: string;
  isSeed?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  bio: string;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  defaultAmazonTag: string;
  defaultDigistoreId: string;
}

export type ActiveSection = 'journal' | 'products' | 'services' | 'write' | 'studio';
