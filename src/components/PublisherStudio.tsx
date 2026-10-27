import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Camera,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Link2,
  Lock,
  LogIn,
  LogOut,
  Megaphone,
  Package,
  PenSquare,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  CampaignDraftInput,
  DirectProductDraftInput,
  OfferDraftInput,
  SiteConfigInput,
  useFirebaseApp,
} from '../context/FirebaseContext';
import {
  compressImageFileToDataUrl,
  downloadCsvFile,
  formatPriceCents,
  readCompactVideoFileToDataUrl,
  readDigitalProductFileToDataUrl,
  toSafePromoCode,
} from '../firebase';
import {
  AffiliateOffer,
  AffiliatePlatform,
  ALL_AFFILIATE_PLATFORMS,
  AnalyticsEventType,
  AnnouncementTargetSection,
  BlogPost,
  CampaignChannel,
  DirectProduct,
  DirectProductKind,
  MarketingCampaign,
  OfferKind,
  OrderFulfillmentStatus,
  PayoutSettlementStatus,
  PublishStatus,
  SERVICE_AFFILIATE_PLATFORMS,
} from '../types';
import { AuthPanel } from './AuthModal';
import { ImageUploadPicker } from './ImageUploadPicker';
import { VideoEmbedFigure } from './EditorialRichBlocks';
import { EditableDropdownSelect } from './EditableDropdownSelect';

interface PublisherStudioProps {
  onOpenPublishedPost: (post: BlogPost) => void;
  onOpenBlockEditor: (post?: BlogPost | null) => void;
  onOpenDirectStore?: () => void;
}

type BackendView =
  | 'overview'
  | 'posts'
  | 'store'
  | 'campaigns'
  | 'orders'
  | 'offers'
  | 'settings';

const PLATFORMS: AffiliatePlatform[] = ALL_AFFILIATE_PLATFORMS;

const CAMPAIGN_CHANNELS: CampaignChannel[] = [
  'Storefront Banner',
  'Blog Callout',
  'Social & Email',
  'Flash Bundle',
];

const ORDER_STATUSES: OrderFulfillmentStatus[] = [
  'paid',
  'processing',
  'shipped',
  'fulfilled',
  'cancelled',
];

const PUBLISH_STATUSES: PublishStatus[] = ['published', 'draft', 'archived'];

const EVENT_TYPE_LABELS: Record<AnalyticsEventType, string> = {
  post_view: 'Article Read',
  affiliate_click: 'Partner Click',
  product_view: 'Store View',
  bag_add: 'Added to Bag',
  promo_apply: 'Promo Applied',
  order_placed: 'Direct Order',
};

function formatShortTimestamp(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const PublisherStudio: React.FC<PublisherStudioProps> = ({
  onOpenPublishedPost,
  onOpenBlockEditor,
  onOpenDirectStore,
}) => {
  const {
    user,
    isBootstrappedCreator,
    isCreatorAdmin,
    adminRoleReady,
    adminRegistry,
    siteConfig,
    profile,
    privateInfo,
    studioPosts,
    publishedPosts,
    studioOffers,
    publishedOffers,
    studioDirectProducts,
    publishedDirectProducts,
    studioCampaigns,
    publishedCampaigns,
    sellerOrders,
    clickCounts,
    postViewCounts,
    productBagCounts,
    analyticsEvents,
    hasFirestoreContent,
    openAuthModal,
    signInWithGoogle,
    resendOwnerVerificationEmail,
    refreshAuthUser,
    signOutUser,
    saveOffer,
    updateOfferStatus,
    updateOfferImage,
    deleteOffer,
    updatePostStatus,
    updatePostCoverImage,
    deletePost,
    saveDirectProduct,
    updateDirectProductStatus,
    updateDirectProductImage,
    deleteDirectProduct,
    saveCampaign,
    updateCampaignStatus,
    deleteCampaign,
    updateDirectOrderFulfillment,
    markSellerOrderPaidOut,
    deleteDirectOrder,
    saveProfileAndAffiliateTags,
    saveSiteConfig,
    grantCoAdmin,
    revokeCoAdmin,
    importStarterCatalog,
    deleteAnalyticsEvent,
    dropdownOptions,
    addDropdownOption,
    renameDropdownOption,
    deleteDropdownOption,
  } = useFirebaseApp();

  const [activeView, setActiveView] = useState<BackendView>('overview');
  const [feedbackBanner, setFeedbackBanner] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  // Confirm delete inline state (avoids window.confirm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedCampaignId, setCopiedCampaignId] = useState<string | null>(null);
  const [copiedOwnUid, setCopiedOwnUid] = useState(false);

  // Search & Filter states across Backend data views
  const [telemetryTypeFilter, setTelemetryTypeFilter] = useState<
    'all' | AnalyticsEventType
  >('all');
  const [telemetrySearch, setTelemetrySearch] = useState('');

  const [postStatusFilter, setPostStatusFilter] = useState<
    'all' | PublishStatus
  >('all');
  const [postSearch, setPostSearch] = useState('');

  const [orderStatusFilter, setOrderStatusFilter] = useState<
    'all' | OrderFulfillmentStatus
  >('all');
  const [orderSearch, setOrderSearch] = useState('');

  const [offerPlatformFilter, setOfferPlatformFilter] = useState<
    'All' | AffiliatePlatform
  >('All');
  const [offerSearch, setOfferSearch] = useState('');

  // Inline stock adjustment drafts per DirectProduct ID
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});

  // Direct Store Product Composer State
  const [editingProductId, setEditingProductId] = useState<string | undefined>(
    undefined
  );
  const [prodTitle, setProdTitle] = useState('');
  const [prodSubtitle, setProdSubtitle] = useState('');
  const [prodKind, setProdKind] = useState<DirectProductKind>('physical');
  const [prodCategory, setProdCategory] = useState('Studio Editions');
  const [prodSku, setProdSku] = useState('PK-ED-01');
  const [prodPriceUsd, setProdPriceUsd] = useState('78.00');
  const [prodCompareUsd, setProdCompareUsd] = useState('98.00');
  const [prodStock, setProdStock] = useState('25');
  const [prodBadge, setProdBadge] = useState('First-Party Edition');
  const [prodImageKey, setProdImageKey] = useState('edition');
  const [prodCustomImageUrl, setProdCustomImageUrl] = useState('');
  const [prodVideoUrl, setProdVideoUrl] = useState('');
  const [prodDigitalFileUrl, setProdDigitalFileUrl] = useState('');
  const [prodDigitalFileName, setProdDigitalFileName] = useState('');
  const [prodDigitalFileType, setProdDigitalFileType] = useState('');
  const [prodDeliveryNote, setProdDeliveryNote] = useState(
    'Ships in 48 hours from Pickra Studio'
  );
  const [prodSummary, setProdSummary] = useState('');
  const [prodHighlightsText, setProdHighlightsText] = useState('');
  const [prodFeatured, setProdFeatured] = useState(true);
  const [prodStatus, setProdStatus] = useState<PublishStatus>('published');

  // Marketing Campaign & Promo Composer State
  const [editingCampaignId, setEditingCampaignId] = useState<
    string | undefined
  >(undefined);
  const [campTitle, setCampTitle] = useState('');
  const [campDescription, setCampDescription] = useState('');
  const [campPromoCode, setCampPromoCode] = useState('SPRING15');
  const [campDiscountPercent, setCampDiscountPercent] = useState('15');
  const [campMinOrderUsd, setCampMinOrderUsd] = useState('0');
  const [campChannel, setCampChannel] =
    useState<CampaignChannel>('Storefront Banner');
  const [campFeaturedProductId, setCampFeaturedProductId] = useState('');
  const [campCtaLabel, setCampCtaLabel] = useState('Apply 15% Code');
  const [campExpiresLabel, setCampExpiresLabel] = useState(
    'Limited seasonal release'
  );
  const [campStatus, setCampStatus] = useState<PublishStatus>('published');

  // Order Fulfillment & Creator Payout Draft Map
  const [orderDrafts, setOrderDrafts] = useState<
    Record<string, { status: OrderFulfillmentStatus; note: string }>
  >({});
  const [payoutDrafts, setPayoutDrafts] = useState<
    Record<
      string,
      { payoutStatus: PayoutSettlementStatus; payoutNote: string }
    >
  >({});

  // Affiliate Offer Composer State
  const [editingOfferId, setEditingOfferId] = useState<string | undefined>(
    undefined
  );
  const [offerTitle, setOfferTitle] = useState('');
  const [offerKind, setOfferKind] = useState<OfferKind>('physical');
  const [offerPlatform, setOfferPlatform] =
    useState<AffiliatePlatform>('Amazon');
  const [offerCategory, setOfferCategory] = useState('Studio Hardware');
  const [offerPrice, setOfferPrice] = useState('$199.00');
  const [offerCommission, setOfferCommission] = useState('');
  const [offerUrl, setOfferUrl] = useState('');
  const [offerImageKey, setOfferImageKey] = useState('audio');
  const [offerCustomImageUrl, setOfferCustomImageUrl] = useState('');
  const [offerVideoUrl, setOfferVideoUrl] = useState('');
  const [offerSummary, setOfferSummary] = useState('');
  const [offerHighlightsText, setOfferHighlightsText] = useState('');
  const [offerStatus, setOfferStatus] = useState<PublishStatus>('published');

  // Author Profile & Affiliate IDs State
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [amazonTag, setAmazonTag] = useState('');
  const [digistoreId, setDigistoreId] = useState('');

  // Global Site Configuration Form State (/siteConfig/main)
  const [cfgTagline, setCfgTagline] = useState('');
  const [cfgAnnouncementEnabled, setCfgAnnouncementEnabled] = useState(false);
  const [cfgAnnouncementText, setCfgAnnouncementText] = useState('');
  const [cfgAnnouncementCta, setCfgAnnouncementCta] = useState('');
  const [cfgAnnouncementTarget, setCfgAnnouncementTarget] =
    useState<AnnouncementTargetSection>('store');
  const [cfgFreeShipUsd, setCfgFreeShipUsd] = useState('95.00');
  const [cfgFlatShipUsd, setCfgFlatShipUsd] = useState('9.00');
  const [cfgDefaultDisclosure, setCfgDefaultDisclosure] = useState('');
  const [cfgCheckoutEnabled, setCfgCheckoutEnabled] = useState(true);
  const [cfgShowStarterSeeds, setCfgShowStarterSeeds] = useState(true);

  // Co-Admin Grant Input
  const [newCoAdminUid, setNewCoAdminUid] = useState('');

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setBio(profile.bio);
    }
    if (privateInfo) {
      setAmazonTag(privateInfo.defaultAmazonTag);
      setDigistoreId(privateInfo.defaultDigistoreId);
    }
  }, [profile, privateInfo]);

  useEffect(() => {
    setCfgTagline(siteConfig.siteTagline);
    setCfgAnnouncementEnabled(siteConfig.announcementEnabled);
    setCfgAnnouncementText(siteConfig.announcementText);
    setCfgAnnouncementCta(siteConfig.announcementCtaLabel);
    setCfgAnnouncementTarget(siteConfig.announcementTargetSection);
    setCfgFreeShipUsd((siteConfig.freeShippingThresholdCents / 100).toFixed(2));
    setCfgFlatShipUsd((siteConfig.flatShippingCents / 100).toFixed(2));
    setCfgDefaultDisclosure(siteConfig.defaultDisclosureText);
    setCfgCheckoutEnabled(siteConfig.storeCheckoutEnabled);
    setCfgShowStarterSeeds(siteConfig.showStarterSeeds);
  }, [siteConfig]);

  function notify(tone: 'ok' | 'err', text: string) {
    setFeedbackBanner({ tone, text });
  }

  // Manageable collections combining saved Firestore records + active starter seeds
  const allManageablePosts: BlogPost[] = useMemo(() => {
    const map = new Map<string, BlogPost>();
    for (const item of studioPosts) map.set(item.id, item);
    for (const item of publishedPosts) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    return Array.from(map.values());
  }, [studioPosts, publishedPosts]);

  const allManageableDirectProducts: DirectProduct[] = useMemo(() => {
    const map = new Map<string, DirectProduct>();
    for (const item of studioDirectProducts) map.set(item.id, item);
    for (const item of publishedDirectProducts) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    return Array.from(map.values());
  }, [studioDirectProducts, publishedDirectProducts]);

  const allManageableCampaigns: MarketingCampaign[] = useMemo(() => {
    const map = new Map<string, MarketingCampaign>();
    for (const item of studioCampaigns) map.set(item.id, item);
    for (const item of publishedCampaigns) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    return Array.from(map.values());
  }, [studioCampaigns, publishedCampaigns]);

  const allManageableOffers: AffiliateOffer[] = useMemo(() => {
    const map = new Map<string, AffiliateOffer>();
    for (const item of studioOffers) map.set(item.id, item);
    for (const item of publishedOffers) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    return Array.from(map.values());
  }, [studioOffers, publishedOffers]);

  // Real-time Backend Monitoring KPIs
  const monitorStats = useMemo(() => {
    let activeRevenueCents = 0;
    let totalDiscountsCents = 0;
    let pendingPayoutsCents = 0;
    let settledPayoutsCents = 0;
    let pendingOrdersCount = 0;
    let fulfilledCount = 0;
    const promoRedemptionMap: Record<string, number> = {};

    for (const ord of sellerOrders) {
      if (ord.status !== 'cancelled') {
        activeRevenueCents += ord.totalCents;
        totalDiscountsCents += ord.discountCents;
        const netCreatorShare =
          typeof ord.sellerPayoutCents === 'number'
            ? ord.sellerPayoutCents
            : Math.round(ord.totalCents * 0.9);
        if (ord.payoutStatus === 'pending') {
          pendingPayoutsCents += netCreatorShare;
        } else if (ord.payoutStatus === 'paid_out') {
          settledPayoutsCents += netCreatorShare;
        }
        if (ord.promoCode) {
          promoRedemptionMap[ord.promoCode] =
            (promoRedemptionMap[ord.promoCode] || 0) + 1;
        }
      }
      if (ord.status === 'paid' || ord.status === 'processing') {
        pendingOrdersCount += 1;
      }
      if (ord.status === 'fulfilled' || ord.status === 'shipped') {
        fulfilledCount += 1;
      }
    }

    const totalArticleViews = Object.values(postViewCounts).reduce(
      (acc, n) => acc + n,
      0
    );
    const totalOutboundClicks = Object.values(clickCounts).reduce(
      (acc, n) => acc + n,
      0
    );
    const totalBagAdds = Object.values(productBagCounts).reduce(
      (acc, n) => acc + n,
      0
    );

    const lowStockProducts = allManageableDirectProducts.filter(
      (p) => p.kind === 'physical' && p.stockCount <= 5
    );
    const draftPosts = allManageablePosts.filter((p) => p.status === 'draft');

    return {
      totalOrders: sellerOrders.length,
      activeRevenueCents,
      totalDiscountsCents,
      pendingPayoutsCents,
      settledPayoutsCents,
      pendingOrdersCount,
      fulfilledCount,
      totalArticleViews,
      totalOutboundClicks,
      totalBagAdds,
      lowStockProducts,
      draftPosts,
      promoRedemptionMap,
    };
  }, [
    sellerOrders,
    postViewCounts,
    clickCounts,
    productBagCounts,
    allManageableDirectProducts,
    allManageablePosts,
  ]);

  // Multi-Channel & Partner Network Performance Breakdown
  const channelMatrix = useMemo(() => {
    const rows: {
      channel: string;
      role: string;
      activeItems: number;
      interactionsLabel: string;
      interactionsCount: number;
      ordersOrConversions: string;
      revenueDisplay: string;
    }[] = [
      {
        channel: 'Pickra Direct Store',
        role: 'First-Party Commerce',
        activeItems: allManageableDirectProducts.filter(
          (p) => p.status === 'published'
        ).length,
        interactionsLabel: 'bag adds',
        interactionsCount: monitorStats.totalBagAdds,
        ordersOrConversions: `${
          sellerOrders.filter((o) => o.status !== 'cancelled').length
        } orders`,
        revenueDisplay: formatPriceCents(monitorStats.activeRevenueCents),
      },
    ];

    const mergedPlatforms = Array.from(
      new Set<AffiliatePlatform>([
        ...dropdownOptions.productPlatforms,
        ...dropdownOptions.servicePlatforms,
        ...PLATFORMS,
      ])
    );

    const corePlatforms = new Set<AffiliatePlatform>([
      'Amazon',
      'Digistore24',
      'Fiverr',
      'Upwork',
      'ClickBank',
      'Gumroad',
    ]);

    for (const plat of mergedPlatforms) {
      const platOffers = allManageableOffers.filter((o) => o.platform === plat);
      const publishedPlatCount = platOffers.filter(
        (o) => o.status === 'published'
      ).length;
      const platClicks = platOffers.reduce(
        (sum, o) => sum + (clickCounts[o.id] || 0),
        0
      );
      if (platOffers.length === 0 && !corePlatforms.has(plat)) continue;

      rows.push({
        channel: plat,
        role:
          (dropdownOptions.servicePlatforms.includes(plat) ||
            SERVICE_AFFILIATE_PLATFORMS.includes(plat)) &&
          plat !== 'Custom'
            ? 'Service Affiliate Network'
            : 'Product Affiliate Network',
        activeItems: publishedPlatCount,
        interactionsLabel: 'outbound clicks',
        interactionsCount: platClicks,
        ordersOrConversions:
          platClicks > 0 ? 'Partner tracked' : 'Awaiting traffic',
        revenueDisplay: 'External commission',
      });
    }

    return rows;
  }, [
    allManageableDirectProducts,
    allManageableOffers,
    clickCounts,
    dropdownOptions.productPlatforms,
    dropdownOptions.servicePlatforms,
    monitorStats.totalBagAdds,
    monitorStats.activeRevenueCents,
    sellerOrders,
  ]);

  // Filtered Views
  const filteredEvents = useMemo(() => {
    const q = telemetrySearch.trim().toLowerCase();
    return analyticsEvents.filter((evt) => {
      if (
        telemetryTypeFilter !== 'all' &&
        evt.eventType !== telemetryTypeFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        evt.targetTitle.toLowerCase().includes(q) ||
        evt.platform.toLowerCase().includes(q) ||
        evt.eventType.toLowerCase().includes(q) ||
        evt.channel.toLowerCase().includes(q)
      );
    });
  }, [analyticsEvents, telemetryTypeFilter, telemetrySearch]);

  const filteredPosts = useMemo(() => {
    const q = postSearch.trim().toLowerCase();
    return allManageablePosts.filter((post) => {
      if (postStatusFilter !== 'all' && post.status !== postStatusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        post.title.toLowerCase().includes(q) ||
        post.subtitle.toLowerCase().includes(q) ||
        post.category.toLowerCase().includes(q)
      );
    });
  }, [allManageablePosts, postStatusFilter, postSearch]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return sellerOrders.filter((ord) => {
      if (orderStatusFilter !== 'all' && ord.status !== orderStatusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        ord.orderNumber.toLowerCase().includes(q) ||
        ord.buyerName.toLowerCase().includes(q) ||
        ord.buyerEmail.toLowerCase().includes(q) ||
        ord.itemsSummary.toLowerCase().includes(q) ||
        ord.promoCode.toLowerCase().includes(q)
      );
    });
  }, [sellerOrders, orderStatusFilter, orderSearch]);

  const filteredOffers = useMemo(() => {
    const q = offerSearch.trim().toLowerCase();
    return allManageableOffers.filter((offer) => {
      if (
        offerPlatformFilter !== 'All' &&
        offer.platform !== offerPlatformFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        offer.title.toLowerCase().includes(q) ||
        offer.category.toLowerCase().includes(q) ||
        offer.platform.toLowerCase().includes(q) ||
        offer.priceLabel.toLowerCase().includes(q)
      );
    });
  }, [allManageableOffers, offerPlatformFilter, offerSearch]);

  // Direct Product Composer Helpers
  function resetProductComposer() {
    setEditingProductId(undefined);
    setProdTitle('');
    setProdSubtitle('');
    setProdKind('physical');
    setProdCategory('Studio Editions');
    setProdSku('PK-ED-01');
    setProdPriceUsd('78.00');
    setProdCompareUsd('');
    setProdStock('25');
    setProdBadge('First-Party Edition');
    setProdImageKey('edition');
    setProdCustomImageUrl('');
    setProdVideoUrl('');
    setProdDigitalFileUrl('');
    setProdDigitalFileName('');
    setProdDigitalFileType('');
    setProdDeliveryNote('Ships in 48 hours from Pickra Studio');
    setProdSummary('');
    setProdHighlightsText('');
    setProdFeatured(true);
    setProdStatus('published');
  }

  function loadDirectProductIntoComposer(prod: DirectProduct) {
    setEditingProductId(prod.id);
    setProdTitle(prod.title);
    setProdSubtitle(prod.subtitle);
    setProdKind(prod.kind);
    setProdCategory(prod.category);
    setProdSku(prod.sku);
    setProdPriceUsd((prod.priceCents / 100).toFixed(2));
    setProdCompareUsd(
      prod.compareAtCents > 0 ? (prod.compareAtCents / 100).toFixed(2) : ''
    );
    setProdStock(String(prod.stockCount));
    setProdBadge(prod.badgeLabel);
    setProdImageKey(prod.imageKey || 'edition');
    setProdCustomImageUrl('');
    setProdVideoUrl(prod.videoUrl || '');
    setProdDigitalFileUrl(prod.digitalFileUrl || '');
    setProdDigitalFileName(prod.digitalFileName || '');
    setProdDigitalFileType(prod.digitalFileType || '');
    setProdDeliveryNote(prod.deliveryNote);
    setProdSummary(prod.summary);
    setProdHighlightsText(prod.highlights.join('\n'));
    setProdFeatured(prod.featured);
    setProdStatus(prod.status);
  }

  async function handleSaveDirectProductSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedbackBanner(null);

    try {
      const parsedPrice = Number.parseFloat(prodPriceUsd);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 1) {
        throw new Error('Price must be at least $1.00 USD.');
      }
      const priceCents = Math.round(parsedPrice * 100);
      const parsedCompare = prodCompareUsd.trim()
        ? Number.parseFloat(prodCompareUsd)
        : 0;
      const compareAtCents =
        Number.isFinite(parsedCompare) && parsedCompare > 0
          ? Math.round(parsedCompare * 100)
          : 0;
      const stockCount = Math.max(0, Number.parseInt(prodStock || '0', 10) || 0);

      const resolvedImage =
        prodImageKey === 'custom' ? prodCustomImageUrl.trim() : prodImageKey;
      const highlights = prodHighlightsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 4);

      const input: DirectProductDraftInput = {
        id: editingProductId,
        title: prodTitle,
        subtitle: prodSubtitle.trim() || prodSummary.trim().slice(0, 140),
        kind: prodKind,
        category: prodCategory,
        sku: prodSku,
        priceCents,
        compareAtCents,
        stockCount,
        badgeLabel: prodBadge,
        imageKey: resolvedImage || 'edition',
        videoUrl: prodVideoUrl,
        digitalFileUrl: prodKind === 'digital' ? prodDigitalFileUrl : '',
        digitalFileName: prodKind === 'digital' ? prodDigitalFileName : '',
        digitalFileType: prodKind === 'digital' ? prodDigitalFileType : '',
        summary: prodSummary,
        highlights,
        deliveryNote: prodDeliveryNote,
        featured: prodFeatured,
        status: prodStatus,
      };

      await saveDirectProduct(input);
      resetProductComposer();
      notify('ok', 'Store product saved and synced to Pickra Storefront.');
    } catch (err) {
      notify(
        'err',
        err instanceof Error
          ? err.message
          : 'Unable to save Direct Store product.'
      );
    } finally {
      setBusy(false);
    }
  }

  // Marketing Campaign Composer Helpers
  function resetCampaignComposer() {
    setEditingCampaignId(undefined);
    setCampTitle('');
    setCampDescription('');
    setCampPromoCode('SPRING15');
    setCampDiscountPercent('15');
    setCampMinOrderUsd('0');
    setCampChannel('Storefront Banner');
    setCampFeaturedProductId('');
    setCampCtaLabel('Apply 15% Code');
    setCampExpiresLabel('Limited seasonal release');
    setCampStatus('published');
  }

  function loadCampaignIntoComposer(camp: MarketingCampaign) {
    setEditingCampaignId(camp.id);
    setCampTitle(camp.title);
    setCampDescription(camp.description);
    setCampPromoCode(camp.promoCode);
    setCampDiscountPercent(String(camp.discountPercent));
    setCampMinOrderUsd((camp.minOrderCents / 100).toFixed(0));
    setCampChannel(camp.channel);
    setCampFeaturedProductId(camp.featuredProductId);
    setCampCtaLabel(camp.ctaLabel);
    setCampExpiresLabel(camp.expiresLabel);
    setCampStatus(camp.status);
  }

  async function handleSaveCampaignSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedbackBanner(null);

    try {
      const discountPercent = Math.min(
        90,
        Math.max(1, Number.parseInt(campDiscountPercent || '10', 10) || 10)
      );
      const minOrderUsd = Number.parseFloat(campMinOrderUsd || '0');
      const minOrderCents =
        Number.isFinite(minOrderUsd) && minOrderUsd > 0
          ? Math.round(minOrderUsd * 100)
          : 0;

      const input: CampaignDraftInput = {
        id: editingCampaignId,
        title: campTitle,
        description: campDescription,
        promoCode: toSafePromoCode(campPromoCode),
        discountPercent,
        minOrderCents,
        channel: campChannel,
        featuredProductId: campFeaturedProductId,
        ctaLabel: campCtaLabel,
        expiresLabel: campExpiresLabel,
        status: campStatus,
      };

      await saveCampaign(input);
      resetCampaignComposer();
      notify('ok', 'Marketing campaign and promo code published to Storefront.');
    } catch (err) {
      notify(
        'err',
        err instanceof Error
          ? err.message
          : 'Unable to save marketing campaign.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyCampaignMarketingUrl(
    campaignId: string,
    promoCode: string
  ) {
    const shareUrl = `${window.location.origin}${window.location.pathname}?section=store&promo=${encodeURIComponent(
      promoCode
    )}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedCampaignId(campaignId);
      window.setTimeout(() => setCopiedCampaignId(null), 1800);
    } catch {
      notify('ok', `Shareable promo link: ${shareUrl}`);
    }
  }

  async function handleUpdateOrder(orderId: string) {
    const targetOrder = sellerOrders.find((o) => o.id === orderId);
    if (!targetOrder) return;
    const draft = orderDrafts[orderId] || {
      status: targetOrder.status,
      note: targetOrder.fulfillmentNote,
    };
    setBusy(true);
    setFeedbackBanner(null);
    try {
      await updateDirectOrderFulfillment(orderId, draft.status, draft.note);
      notify(
        'ok',
        `Order ${targetOrder.orderNumber} updated to "${draft.status}".`
      );
    } catch (err) {
      notify(
        'err',
        err instanceof Error
          ? err.message
          : 'Could not update order fulfillment.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateOrderPayout(orderId: string) {
    const targetOrder = sellerOrders.find((o) => o.id === orderId);
    if (!targetOrder) return;
    const draft = payoutDrafts[orderId] || {
      payoutStatus: targetOrder.payoutStatus || 'pending',
      payoutNote: targetOrder.payoutNote || '',
    };
    setBusy(true);
    setFeedbackBanner(null);
    try {
      await markSellerOrderPaidOut(
        orderId,
        draft.payoutStatus,
        draft.payoutNote
      );
      notify(
        'ok',
        `Creator payout for ${targetOrder.orderNumber} updated to "${draft.payoutStatus}".`
      );
    } catch (err) {
      notify(
        'err',
        err instanceof Error
          ? err.message
          : 'Could not update creator payout status.'
      );
    } finally {
      setBusy(false);
    }
  }

  // Affiliate Offer Composer Helpers
  function resetOfferComposer() {
    setEditingOfferId(undefined);
    setOfferTitle('');
    setOfferKind('physical');
    setOfferPlatform('Amazon');
    setOfferCategory('Studio Hardware');
    setOfferPrice('$199.00');
    setOfferCommission('');
    setOfferUrl('');
    setOfferImageKey('audio');
    setOfferCustomImageUrl('');
    setOfferVideoUrl('');
    setOfferSummary('');
    setOfferHighlightsText('');
    setOfferStatus('published');
  }

  function loadOfferIntoComposer(offer: AffiliateOffer) {
    setEditingOfferId(offer.id);
    setOfferTitle(offer.title);
    setOfferKind(offer.kind);
    setOfferPlatform(offer.platform);
    setOfferCategory(offer.category);
    setOfferPrice(offer.priceLabel);
    setOfferCommission(offer.commissionNote);
    setOfferUrl(offer.affiliateUrl);
    setOfferImageKey(offer.imageKey || 'audio');
    setOfferCustomImageUrl('');
    setOfferVideoUrl(offer.videoUrl || '');
    setOfferSummary(offer.summary);
    setOfferHighlightsText(offer.highlights.join('\n'));
    setOfferStatus(offer.status);
  }

  function applyDefaultAffiliateIdToUrl() {
    const trimmed = offerUrl.trim();
    if (!trimmed) {
      notify('err', 'Paste a product or service destination link first.');
      return;
    }

    try {
      const normalized = trimmed.startsWith('http')
        ? trimmed
        : `https://${trimmed}`;
      const parsed = new URL(normalized);

      if (offerPlatform === 'Amazon' && amazonTag.trim()) {
        parsed.searchParams.set('tag', amazonTag.trim());
        setOfferUrl(parsed.toString());
        notify('ok', `Appended Amazon Associate tag (${amazonTag.trim()}).`);
        return;
      }

      if (offerPlatform === 'Digistore24' && digistoreId.trim()) {
        parsed.searchParams.set('aff', digistoreId.trim());
        setOfferUrl(parsed.toString());
        notify(
          'ok',
          `Appended Digistore24 Affiliate ID (${digistoreId.trim()}).`
        );
        return;
      }

      notify(
        'err',
        'Configure your default Amazon Tag or Digistore24 ID under Site Settings & Access first.'
      );
    } catch {
      notify('err', 'Enter a valid URL before appending tracking parameters.');
    }
  }

  async function handleSaveOfferSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedbackBanner(null);

    try {
      const resolvedImage =
        offerImageKey === 'custom'
          ? offerCustomImageUrl.trim()
          : offerImageKey;
      const highlights = offerHighlightsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 4);

      const input: OfferDraftInput = {
        id: editingOfferId,
        title: offerTitle,
        kind: offerKind,
        platform: offerPlatform,
        category: offerCategory,
        priceLabel: offerPrice,
        commissionNote: offerCommission,
        affiliateUrl: offerUrl,
        imageKey: resolvedImage || 'audio',
        videoUrl: offerVideoUrl,
        summary: offerSummary,
        highlights,
        status: offerStatus,
      };

      await saveOffer(input);
      resetOfferComposer();
      notify('ok', 'Affiliate product or service saved to catalog.');
    } catch (err) {
      notify(
        'err',
        err instanceof Error ? err.message : 'Unable to save offering.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSiteConfigSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedbackBanner(null);
    try {
      const freeShipUsd = Number.parseFloat(cfgFreeShipUsd || '0');
      const flatShipUsd = Number.parseFloat(cfgFlatShipUsd || '0');
      const payload: SiteConfigInput = {
        siteTagline: cfgTagline,
        announcementEnabled: cfgAnnouncementEnabled,
        announcementText: cfgAnnouncementText,
        announcementCtaLabel: cfgAnnouncementCta,
        announcementTargetSection: cfgAnnouncementTarget,
        freeShippingThresholdCents:
          Number.isFinite(freeShipUsd) && freeShipUsd >= 0
            ? Math.round(freeShipUsd * 100)
            : 9500,
        flatShippingCents:
          Number.isFinite(flatShipUsd) && flatShipUsd >= 0
            ? Math.round(flatShipUsd * 100)
            : 900,
        defaultDisclosureText: cfgDefaultDisclosure,
        storeCheckoutEnabled: cfgCheckoutEnabled,
        showStarterSeeds: cfgShowStarterSeeds,
      };
      await saveSiteConfig(payload);
      notify('ok', 'Global Pickra site configuration saved and published live.');
    } catch (err) {
      notify(
        'err',
        err instanceof Error
          ? err.message
          : 'Failed to save global site settings.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveProfileSettings(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedbackBanner(null);
    try {
      await saveProfileAndAffiliateTags({
        displayName,
        bio,
        defaultAmazonTag: amazonTag,
        defaultDigistoreId: digistoreId,
      });
      notify(
        'ok',
        'Creator author profile and private affiliate tracking IDs updated.'
      );
    } catch (err) {
      notify(
        'err',
        err instanceof Error ? err.message : 'Failed to save profile settings.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGrantCoAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newCoAdminUid.trim()) return;
    setBusy(true);
    setFeedbackBanner(null);
    try {
      await grantCoAdmin(newCoAdminUid.trim());
      setNewCoAdminUid('');
      notify('ok', 'Co-Admin UID added to Creator Backend access registry.');
    } catch (err) {
      notify(
        'err',
        err instanceof Error ? err.message : 'Unable to grant Co-Admin access.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleImportSeeds() {
    setBusy(true);
    setFeedbackBanner(null);
    try {
      await importStarterCatalog();
      notify(
        'ok',
        'Starter stories, Direct Store products, promo campaigns, and affiliate links imported into your Firestore workspace.'
      );
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  // CSV Exports
  function handleExportTelemetryCsv() {
    downloadCsvFile(
      `pickra-telemetry-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Timestamp',
        'Event Type',
        'Channel',
        'Platform',
        'Target Title',
        'Value USD',
        'Actor Scope',
      ],
      filteredEvents.map((e) => [
        new Date(e.createdAtMs).toISOString(),
        e.eventType,
        e.channel,
        e.platform,
        e.targetTitle,
        (e.valueCents / 100).toFixed(2),
        e.actorScope,
      ])
    );
  }

  function handleExportOrdersCsv() {
    downloadCsvFile(
      `pickra-direct-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Order Number',
        'Created At',
        'Status',
        'Buyer Name',
        'Buyer Email',
        'Fulfillment Type',
        'Items',
        'Promo Code',
        'Subtotal USD',
        'Discount USD',
        'Shipping USD',
        'Total USD',
        'Shipping Address',
      ],
      filteredOrders.map((o) => [
        o.orderNumber,
        new Date(o.createdAtMs).toISOString(),
        o.status,
        o.buyerName,
        o.buyerEmail,
        o.fulfillmentType,
        o.itemsSummary,
        o.promoCode,
        (o.subtotalCents / 100).toFixed(2),
        (o.discountCents / 100).toFixed(2),
        (o.shippingCents / 100).toFixed(2),
        (o.totalCents / 100).toFixed(2),
        o.shippingAddress,
      ])
    );
  }

  function handleExportInventoryCsv() {
    downloadCsvFile(
      `pickra-store-inventory-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'SKU',
        'Title',
        'Format',
        'Category',
        'Status',
        'Price USD',
        'Stock Count',
        'Bag Additions',
      ],
      allManageableDirectProducts.map((p) => [
        p.sku,
        p.title,
        p.kind,
        p.category,
        p.isSeed ? 'starter-seed' : p.status,
        (p.priceCents / 100).toFixed(2),
        p.stockCount,
        productBagCounts[p.id] || 0,
      ])
    );
  }

  function handleExportAffiliateCsv() {
    downloadCsvFile(
      `pickra-affiliate-clicks-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Title',
        'Platform',
        'Kind',
        'Category',
        'Price Label',
        'Status',
        'Tracked Clicks',
        'Destination URL',
      ],
      filteredOffers.map((o) => [
        o.title,
        o.platform,
        o.kind,
        o.category,
        o.priceLabel,
        o.isSeed ? 'starter-seed' : o.status,
        clickCounts[o.id] || 0,
        o.affiliateUrl,
      ])
    );
  }

  // GATE 1: Signed-out Creator Authentication Prompt
  if (!user) {
    return (
      <section className="max-w-[1160px] mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 bg-white border border-stone-200/90 rounded-2xl p-8 sm:p-10 space-y-6">
            <div>
              <p className="text-xs font-medium text-[#9A3412]">
                Pickra Creator Backend · Management &amp; Monitoring Console
              </p>
              <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-medium text-stone-900">
                Manage and monitor your entire Pickra publication and store
              </h1>
              <p className="mt-4 text-sm sm:text-base text-stone-600 leading-relaxed">
                Sign in with your verified Website Owner account to monitor
                real-time traffic, outbound affiliate clicks, multi-creator
                store revenue, customer orders, creator payouts, promotional
                campaigns, and global site settings.
              </p>
            </div>

            <div className="space-y-5 pt-6 border-t border-stone-200/80">
              <div>
                <h3 className="text-sm font-semibold text-stone-900">
                  01. Live Traffic &amp; Revenue Monitor
                </h3>
                <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                  Track blog reads, Amazon/Digistore24/Upwork/Fiverr clicks, bag
                  additions, promo redemptions, and net store sales in real
                  time.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-stone-900">
                  02. Unified CMS, Store &amp; Creator Payouts
                </h3>
                <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                  Publish Medium-style rich blogs, manage physical and digital
                  SKUs, settle 90% creator payouts, and update customer order
                  tracking.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-stone-900">
                  03. Site-Wide Governance &amp; Access
                </h3>
                <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                  Control site-wide announcement banners, shipping thresholds,
                  checkout master switch, FTC disclosures, and Co-Admin
                  permissions.
                </p>
              </div>
            </div>

            {onOpenDirectStore && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenDirectStore}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-stone-800 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <ShoppingBag className="w-4 h-4 text-[#9A3412]" />
                  <span>Browse Public Storefront</span>
                </button>
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            <AuthPanel
              defaultMode="signin"
              defaultAsSeller={false}
              heading="Sign in to Creator Backend"
              subheading="Sign in with your verified owner account (Email & Password or Google) to manage all Pickra systems."
            />
          </div>
        </div>
      </section>
    );
  }

  // GATE 2: Role Verification Loading State
  if (!adminRoleReady) {
    return (
      <section className="max-w-[960px] mx-auto px-5 sm:px-8 py-16">
        <div className="bg-white border border-stone-200/90 rounded-xl p-8 space-y-4">
          <div className="h-4 w-48 bg-stone-200/70 rounded" />
          <div className="h-8 w-80 bg-stone-200/70 rounded" />
          <div className="h-24 w-full bg-[#F3EFE8] rounded-lg" />
        </div>
      </section>
    );
  }

  // GATE 3: Signed-in Non-Owner / Unverified Owner Screen
  if (!isCreatorAdmin) {
    const isUnverifiedOwnerEmail =
      user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() &&
      !user.emailVerified;

    return (
      <section className="max-w-[820px] mx-auto px-5 sm:px-8 py-14 sm:py-20">
        <div className="bg-white border border-stone-200/90 rounded-xl p-8 sm:p-10 space-y-5">
          <div className="flex items-center gap-2 text-xs font-medium text-[#9A3412]">
            <Lock className="w-3.5 h-3.5" />
            <span>
              {isUnverifiedOwnerEmail
                ? 'Verify Owner Email to Unlock Backend'
                : 'Restricted Creator Console'}
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-medium text-stone-900">
            {isUnverifiedOwnerEmail
              ? 'Confirm your owner email address to unlock full Backend control'
              : 'This management & monitoring console is restricted to the site creator'}
          </h1>
          <p className="text-sm text-stone-600 leading-relaxed">
            You are signed in as{' '}
            <span className="font-mono text-stone-900">{user.email}</span>.{' '}
            {isUnverifiedOwnerEmail
              ? 'For zero-trust security, owner privileges require a verified email token. Click the verification link sent to your inbox and press "Refresh Verification Status", or sign in directly with Google.'
              : 'Creator Seller and Customer accounts can publish products and get paid under Store -> Sell on Pickra, or track orders under Store -> My Purchases, while site-wide Backend governance is reserved for the website owner.'}
          </p>

          {feedbackBanner && (
            <div
              className={`px-4 py-3 rounded-lg border text-xs ${
                feedbackBanner.tone === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {feedbackBanner.text}
            </div>
          )}

          {isUnverifiedOwnerEmail && (
            <div className="p-4 bg-[#FBF9F5] border border-stone-200 rounded-xl flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  await refreshAuthUser();
                  setFeedbackBanner({
                    tone: 'ok',
                    text: 'Checked latest verification status from Firebase Auth.',
                  });
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg cursor-pointer"
              >
                I Verified My Email — Refresh Access
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await resendOwnerVerificationEmail();
                    setFeedbackBanner({
                      tone: 'ok',
                      text: `Verification link sent to ${user.email}.`,
                    });
                  } catch (err) {
                    setFeedbackBanner({
                      tone: 'err',
                      text:
                        err instanceof Error
                          ? err.message
                          : 'Could not resend verification email.',
                    });
                  }
                }}
                className="px-3.5 py-2 text-xs font-medium text-stone-800 bg-white border border-stone-300 hover:bg-stone-100 rounded-lg cursor-pointer"
              >
                Resend Verification Email
              </button>
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="px-3.5 py-2 text-xs font-medium text-stone-800 bg-white border border-stone-300 hover:bg-stone-100 rounded-lg cursor-pointer"
              >
                Verify Instantly with Google
              </button>
            </div>
          )}

          <div className="p-4 bg-[#FBF9F5] border border-stone-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-stone-500">
                Your Firebase UID (share with the owner if requesting Co-Admin
                access)
              </div>
              <div className="font-mono text-xs text-stone-900 truncate">
                {user.uid}
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(user.uid);
                  setCopiedOwnUid(true);
                  window.setTimeout(() => setCopiedOwnUid(false), 1800);
                } catch {
                  // ignore clipboard error
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-white border border-stone-300 hover:bg-stone-100 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
            >
              {copiedOwnUid ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  <span>UID Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy UID</span>
                </>
              )}
            </button>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                await signOutUser();
                openAuthModal('signin', false);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Switch Account / Sign Out</span>
            </button>

            {onOpenDirectStore && (
              <button
                type="button"
                onClick={onOpenDirectStore}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-stone-800 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>Go to Store &amp; Sell Products</span>
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  const navItems: {
    key: BackendView;
    label: string;
    countLabel?: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      key: 'overview',
      label: 'Live Monitor',
      countLabel: String(analyticsEvents.length),
      icon: Activity,
    },
    {
      key: 'posts',
      label: 'Editorial CMS',
      countLabel: String(allManageablePosts.length),
      icon: BookOpen,
    },
    {
      key: 'store',
      label: 'Direct Inventory',
      countLabel: String(allManageableDirectProducts.length),
      icon: ShoppingBag,
    },
    {
      key: 'campaigns',
      label: 'Promo Campaigns',
      countLabel: String(allManageableCampaigns.length),
      icon: Megaphone,
    },
    {
      key: 'orders',
      label: 'Customer Orders',
      countLabel: String(sellerOrders.length),
      icon: Package,
    },
    {
      key: 'offers',
      label: 'Affiliate Catalog',
      countLabel: String(allManageableOffers.length),
      icon: Link2,
    },
    {
      key: 'settings',
      label: 'Site & Access',
      icon: Settings,
    },
  ];

  const activeNavMeta =
    navItems.find((item) => item.key === activeView) || navItems[0];

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
        {/* Left Sidebar Navigation (256px desktop, horizontal scroll bar on mobile) */}
        <aside className="w-full lg:w-[256px] shrink-0 bg-white border border-stone-200/90 rounded-xl p-4 lg:sticky lg:top-20">
          <div className="pb-3.5 mb-3.5 border-b border-stone-200/80 hidden lg:block">
            <div className="text-[11px] font-medium text-[#9A3412]">
              {isBootstrappedCreator ? 'Owner Console' : 'Co-Admin Console'}
            </div>
            <div className="mt-0.5 text-sm font-semibold text-stone-900 truncate">
              {profile?.displayName || user.displayName || 'Pickra Creator'}
            </div>
            <div className="text-[11px] font-mono text-stone-500 truncate">
              {user.email}
            </div>
          </div>

          <nav
            aria-label="Creator Backend Sections"
            className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setActiveView(item.key);
                    setFeedbackBanner(null);
                  }}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#1C1917] text-white'
                      : 'text-stone-700 hover:bg-[#F3EFE8] hover:text-stone-900'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-stone-500'
                      }`}
                    />
                    <span>{item.label}</span>
                  </span>
                  {item.countLabel !== undefined && (
                    <span
                      className={`font-mono text-[11px] tabular-nums ${
                        isActive ? 'text-stone-300' : 'text-stone-400'
                      }`}
                    >
                      {item.countLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="hidden lg:block mt-5 pt-4 border-t border-stone-200/80 space-y-2">
            {!hasFirestoreContent && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleImportSeeds()}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-800 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Import Starter Data</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void signOutUser()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 border border-stone-200 hover:border-stone-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Backend Workspace Viewport */}
        <div className="min-w-0 flex-1 w-full space-y-6">
          {/* Contextual Top Header Bar */}
          <div className="bg-white border border-stone-200/90 rounded-xl px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span>Pickra Backend</span>
                <span aria-hidden="true">/</span>
                <span className="font-medium text-stone-900">
                  {activeNavMeta.label}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Checkout:{' '}
                  <strong
                    className={
                      siteConfig.storeCheckoutEnabled
                        ? 'text-emerald-700 font-medium'
                        : 'text-amber-700 font-medium'
                    }
                  >
                    {siteConfig.storeCheckoutEnabled ? 'Active' : 'Paused'}
                  </strong>
                </span>
              </div>
              <h1 className="mt-1 font-serif text-xl sm:text-2xl font-medium text-stone-900">
                {activeView === 'overview' &&
                  'Website Monitoring, Revenue & Channel Telemetry'}
                {activeView === 'posts' &&
                  'Editorial Blog Dispatches & Block Stories'}
                {activeView === 'store' &&
                  'Direct Store Products & Stock Control'}
                {activeView === 'campaigns' &&
                  'Promotional Campaigns & Discount Codes'}
                {activeView === 'orders' &&
                  'Direct Customer Orders & Fulfillment Queue'}
                {activeView === 'offers' &&
                  'Multi-Platform Affiliate Products & Services'}
                {activeView === 'settings' &&
                  'Global Site Settings, Access Control & Tracking IDs'}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {!hasFirestoreContent && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleImportSeeds()}
                  className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-800 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Import Starter Data</span>
                </button>
              )}

              {onOpenDirectStore && (
                <button
                  type="button"
                  onClick={onOpenDirectStore}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-800 bg-[#FBF9F5] border border-stone-200 hover:border-stone-400 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-[#9A3412]" />
                  <span>Public Storefront</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onOpenBlockEditor(null)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Write New Story</span>
              </button>
            </div>
          </div>

          {/* Feedback Banner */}
          {feedbackBanner && (
            <div
              role="status"
              className={`px-4 py-3 rounded-lg border text-xs flex items-center justify-between gap-4 ${
                feedbackBanner.tone === 'ok'
                  ? 'bg-stone-100 border-stone-300 text-stone-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <span>{feedbackBanner.text}</span>
              <button
                type="button"
                onClick={() => setFeedbackBanner(null)}
                className="text-xs font-medium underline cursor-pointer shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* =========================================================
              VIEW 1: OVERVIEW — LIVE WEBSITE MONITOR & COMMAND
             ========================================================= */}
          {activeView === 'overview' && (
            <div className="space-y-6">
              {/* 5-Column Tabular KPI Strip (Single elevation panel with vertical dividers) */}
              <div className="bg-white border border-stone-200/90 rounded-xl grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-stone-200/80">
                <div className="p-5">
                  <div className="text-xs text-stone-500">
                    Direct Net Revenue
                  </div>
                  <div className="mt-1.5 font-mono text-2xl font-semibold text-stone-900 tabular-nums">
                    {formatPriceCents(monitorStats.activeRevenueCents)}
                  </div>
                  <div className="mt-1 text-[11px] text-stone-500 font-mono tabular-nums">
                    {monitorStats.totalOrders} total orders ·{' '}
                    {monitorStats.fulfilledCount} shipped
                  </div>
                </div>

                <div className="p-5">
                  <div className="text-xs text-stone-500">
                    Pending Fulfillment
                  </div>
                  <div className="mt-1.5 font-mono text-2xl font-semibold text-stone-900 tabular-nums">
                    {monitorStats.pendingOrdersCount}
                  </div>
                  <div className="mt-1 text-[11px] text-stone-500">
                    {monitorStats.pendingOrdersCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setActiveView('orders')}
                        className="text-[#9A3412] hover:underline cursor-pointer"
                      >
                        Review open orders →
                      </button>
                    ) : (
                      'All paid orders dispatched'
                    )}
                  </div>
                </div>

                <div className="p-5">
                  <div className="text-xs text-stone-500">Article Reads</div>
                  <div className="mt-1.5 font-mono text-2xl font-semibold text-stone-900 tabular-nums">
                    {monitorStats.totalArticleViews}
                  </div>
                  <div className="mt-1 text-[11px] text-stone-500 font-mono tabular-nums">
                    {
                      allManageablePosts.filter((p) => p.status === 'published')
                        .length
                    }{' '}
                    live stories
                  </div>
                </div>

                <div className="p-5">
                  <div className="text-xs text-stone-500">
                    Affiliate Outbound Clicks
                  </div>
                  <div className="mt-1.5 font-mono text-2xl font-semibold text-stone-900 tabular-nums">
                    {monitorStats.totalOutboundClicks}
                  </div>
                  <div className="mt-1 text-[11px] text-stone-500 font-mono tabular-nums">
                    {
                      allManageableOffers.filter(
                        (o) => o.status === 'published'
                      ).length
                    }{' '}
                    partner links
                  </div>
                </div>

                <div className="p-5 col-span-2 sm:col-span-1">
                  <div className="text-xs text-stone-500">
                    Store Bag Additions
                  </div>
                  <div className="mt-1.5 font-mono text-2xl font-semibold text-stone-900 tabular-nums">
                    {monitorStats.totalBagAdds}
                  </div>
                  <div className="mt-1 text-[11px] text-stone-500 font-mono tabular-nums">
                    {
                      allManageableCampaigns.filter(
                        (c) => c.status === 'published'
                      ).length
                    }{' '}
                    active promos
                  </div>
                </div>
              </div>

              {/* 2-Column Split: Channel Performance Matrix + Operational Action Queue */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Channel & Partner Network Matrix */}
                <div className="xl:col-span-8 bg-white border border-stone-200/90 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-stone-200/80 flex items-center justify-between gap-4">
                    <div>
                      <h2 className="font-serif text-lg font-medium text-stone-900">
                        Commerce &amp; Partner Network Performance
                      </h2>
                      <p className="text-xs text-stone-500">
                        Unified monitoring across Pickra Direct Store, product affiliate networks, and freelance marketplaces.
                      </p>
                    </div>
                    <BarChart3 className="w-4 h-4 text-stone-400 shrink-0" />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-stone-200/80 text-[11px] font-medium text-stone-500 bg-[#FBF9F5]">
                          <th className="py-2.5 px-5">Platform / Channel</th>
                          <th className="py-2.5 px-4">Model</th>
                          <th className="py-2.5 px-4 text-right">
                            Live Listings
                          </th>
                          <th className="py-2.5 px-4 text-right">
                            Tracked Engagement
                          </th>
                          <th className="py-2.5 px-5 text-right">
                            Direct Volume
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200/70 text-xs">
                        {channelMatrix.map((row) => (
                          <tr
                            key={row.channel}
                            className="hover:bg-stone-50/80 transition-colors"
                          >
                            <td className="py-3 px-5 font-semibold text-stone-900">
                              {row.channel}
                            </td>
                            <td className="py-3 px-4 text-stone-600">
                              {row.role}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-800">
                              {row.activeItems}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-800">
                              {row.interactionsCount}{' '}
                              <span className="font-sans text-stone-500">
                                {row.interactionsLabel}
                              </span>
                            </td>
                            <td className="py-3 px-5 text-right font-mono tabular-nums text-stone-900">
                              {row.revenueDisplay}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Creator Action & Health Queue */}
                <div className="xl:col-span-4 bg-white border border-stone-200/90 rounded-xl p-6 space-y-4">
                  <div className="pb-3 border-b border-stone-200/80">
                    <h2 className="font-serif text-lg font-medium text-stone-900">
                      Creator Action Queue
                    </h2>
                    <p className="text-xs text-stone-500">
                      Operational items requiring your review.
                    </p>
                  </div>

                  <div className="divide-y divide-stone-200/80 text-xs">
                    <div className="py-3 first:pt-0 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-stone-900">
                          Unshipped Direct Orders
                        </div>
                        <div className="text-stone-500">
                          Paid or processing customer orders
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveView('orders')}
                        className="font-mono font-semibold text-[#9A3412] hover:underline tabular-nums cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {monitorStats.pendingOrdersCount} open →
                      </button>
                    </div>

                    <div className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-stone-900">
                          Low-Stock Physical SKUs
                        </div>
                        <div className="text-stone-500">
                          Editions with 5 or fewer units remaining
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveView('store')}
                        className="font-mono font-semibold text-stone-900 hover:text-[#9A3412] hover:underline tabular-nums cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {monitorStats.lowStockProducts.length} SKUs →
                      </button>
                    </div>

                    <div className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-stone-900">
                          Unpublished Story Drafts
                        </div>
                        <div className="text-stone-500">
                          Dispatches saved as working drafts
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveView('posts')}
                        className="font-mono font-semibold text-stone-900 hover:text-[#9A3412] hover:underline tabular-nums cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {monitorStats.draftPosts.length} drafts →
                      </button>
                    </div>

                    <div className="py-3 last:pb-0 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-stone-900">
                          Announcement Ribbon
                        </div>
                        <div className="text-stone-500">
                          Top-of-site promotional bar
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveView('settings')}
                        className="font-medium text-stone-700 hover:text-[#9A3412] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {siteConfig.announcementEnabled ? 'Enabled' : 'Off'} ·
                        Configure →
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Visitor & Conversion Telemetry Stream */}
              <div className="bg-white border border-stone-200/90 rounded-xl overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-stone-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-lg font-medium text-stone-900">
                      Real-Time Telemetry &amp; Conversion Log
                    </h2>
                    <p className="text-xs text-stone-500">
                      Authenticated visitor and customer interactions synced to Firestore, including article reads, partner clicks, bag additions, and direct orders.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <select
                      aria-label="Filter telemetry by event type"
                      value={telemetryTypeFilter}
                      onChange={(e) =>
                        setTelemetryTypeFilter(
                          e.target.value as 'all' | AnalyticsEventType
                        )
                      }
                      className="px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-200 rounded-lg text-stone-700 focus:outline-none focus:border-[#9A3412]"
                    >
                      <option value="all">All Event Types</option>
                      <option value="order_placed">Direct Orders</option>
                      <option value="affiliate_click">Partner Clicks</option>
                      <option value="post_view">Article Reads</option>
                      <option value="product_view">Store Views</option>
                      <option value="bag_add">Bag Additions</option>
                      <option value="promo_apply">Promo Activations</option>
                    </select>

                    <div className="relative w-full sm:w-56">
                      <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="search"
                        value={telemetrySearch}
                        onChange={(e) => setTelemetrySearch(e.target.value)}
                        placeholder="Search item or platform..."
                        className="w-full pl-8 pr-7 py-2 text-xs bg-[#FBF9F5] border border-stone-200 rounded-lg focus:outline-none focus:border-[#9A3412]"
                      />
                      {telemetrySearch && (
                        <button
                          type="button"
                          onClick={() => setTelemetrySearch('')}
                          aria-label="Clear search"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={filteredEvents.length === 0}
                      onClick={handleExportTelemetryCsv}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-800 bg-[#F3EFE8] hover:bg-stone-200 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                {filteredEvents.length === 0 ? (
                  <div className="py-12 px-6 text-center">
                    <p className="text-sm text-stone-600">
                      No matching telemetry events recorded yet.
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      Open any article, inspect a Direct Store edition, click a partner offer, or place a test order to see live events stream here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-stone-200/80 text-[11px] font-medium text-stone-500 bg-[#FBF9F5]">
                          <th className="py-2.5 px-5">Time</th>
                          <th className="py-2.5 px-4">Event</th>
                          <th className="py-2.5 px-4">Target Item</th>
                          <th className="py-2.5 px-4">Platform</th>
                          <th className="py-2.5 px-4">Actor</th>
                          <th className="py-2.5 px-4 text-right">Value</th>
                          <th className="py-2.5 px-5 text-right">Manage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200/70 text-xs">
                        {filteredEvents.slice(0, 60).map((evt) => (
                          <tr
                            key={evt.id}
                            className="hover:bg-stone-50/80 transition-colors"
                          >
                            <td className="py-2.5 px-5 font-mono text-[11px] text-stone-500 tabular-nums whitespace-nowrap">
                              {formatShortTimestamp(evt.createdAtMs)}
                            </td>
                            <td className="py-2.5 px-4 font-medium text-stone-900 whitespace-nowrap">
                              {EVENT_TYPE_LABELS[evt.eventType] ||
                                evt.eventType}
                            </td>
                            <td className="py-2.5 px-4 text-stone-800 max-w-xs truncate">
                              {evt.targetTitle}
                            </td>
                            <td className="py-2.5 px-4 text-stone-600 whitespace-nowrap">
                              {evt.platform}
                            </td>
                            <td className="py-2.5 px-4 text-stone-500 capitalize whitespace-nowrap">
                              {evt.actorScope}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-stone-900 whitespace-nowrap">
                              {evt.valueCents > 0
                                ? formatPriceCents(evt.valueCents)
                                : '—'}
                            </td>
                            <td className="py-2.5 px-5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  void deleteAnalyticsEvent(evt.id)
                                }
                                aria-label="Remove log entry"
                                className="text-stone-400 hover:text-red-700 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================
              VIEW 2: EDITORIAL CMS — STORIES & BLOCK EDITOR
             ========================================================= */}
          {activeView === 'posts' && (
            <div className="bg-white border border-stone-200/90 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-stone-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-xl font-medium text-stone-900">
                    Published Stories, Working Drafts &amp; Readership
                  </h2>
                  <p className="mt-1 text-xs text-stone-500">
                    Control publication status directly or open any dispatch in the Medium-style Block Editor to embed links, images, videos, Direct Store editions, and affiliate picks.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="inline-flex items-center gap-1 p-1 bg-[#F3EFE8] rounded-lg">
                    {(
                      [
                        ['all', 'All'],
                        ['published', 'Published'],
                        ['draft', 'Drafts'],
                        ['archived', 'Archived'],
                      ] as const
                    ).map(([st, label]) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setPostStatusFilter(st)}
                        className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          postStatusFilter === st
                            ? 'bg-white text-stone-900 shadow-xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={postSearch}
                      onChange={(e) => setPostSearch(e.target.value)}
                      placeholder="Search stories..."
                      className="w-full pl-8 pr-7 py-2 text-xs bg-[#FBF9F5] border border-stone-200 rounded-lg focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>
                </div>
              </div>

              {filteredPosts.length === 0 ? (
                <div className="py-14 px-6 text-center">
                  <p className="text-sm text-stone-600">
                    No stories match your current filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenBlockEditor(null)}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#9A3412] rounded-lg cursor-pointer"
                  >
                    <PenSquare className="w-3.5 h-3.5" />
                    <span>Write First Dispatch</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-stone-200/80 px-6">
                  {filteredPosts.map((post) => (
                    <div
                      key={post.id}
                      className="py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                          <span className="font-medium text-stone-800 capitalize">
                            {post.isSeed ? 'Starter Showcase' : post.status}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{post.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{post.publishedLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {postViewCounts[post.id] || 0} reads
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {post.attachedOfferIds.length} partner links
                          </span>
                        </div>

                        <h3 className="mt-1 font-serif text-lg font-medium text-stone-900 leading-snug">
                          {post.title}
                        </h3>
                        <p className="mt-1 text-xs text-stone-600 line-clamp-1">
                          {post.subtitle}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0 text-xs">
                        {!post.isSeed && (
                          <select
                            aria-label={`Change status for ${post.title}`}
                            value={post.status}
                            disabled={busy}
                            onChange={(e) =>
                              void updatePostStatus(
                                post.id,
                                e.target.value as PublishStatus
                              )
                            }
                            className="px-2.5 py-2 text-xs font-medium bg-[#FBF9F5] border border-stone-300 rounded-lg text-stone-800 capitalize focus:outline-none focus:border-[#9A3412]"
                          >
                            {PUBLISH_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        )}

                        <label className="inline-flex items-center gap-1 px-2.5 py-2 font-medium text-stone-700 bg-[#FBF9F5] hover:bg-stone-100 border border-stone-200 rounded-lg cursor-pointer whitespace-nowrap shrink-0">
                          <Camera className="w-3.5 h-3.5 text-[#9A3412]" />
                          <span>Photo</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              try {
                                const dataUrl =
                                  await compressImageFileToDataUrl(f);
                                await updatePostCoverImage(post.id, dataUrl);
                                notify('ok', 'Blog cover photo updated.');
                              } catch (err) {
                                notify(
                                  'err',
                                  err instanceof Error
                                    ? err.message
                                    : 'Failed to update cover photo.'
                                );
                              } finally {
                                e.target.value = '';
                              }
                            }}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => onOpenBlockEditor(post)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 font-medium text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <PenSquare className="w-3.5 h-3.5 text-[#9A3412]" />
                          <span>Edit Blog</span>
                        </button>

                        {post.status === 'published' && (
                          <button
                            type="button"
                            onClick={() => onOpenPublishedPost(post)}
                            className="inline-flex items-center gap-1 px-3 py-2 text-stone-600 hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <span>Read</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {confirmDeleteId === post.id ? (
                          <span className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                void deletePost(post.id);
                                setConfirmDeleteId(null);
                              }}
                              className="text-red-700 font-semibold hover:underline cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-stone-500 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(post.id)}
                            className="p-2 text-stone-400 hover:text-red-700 cursor-pointer"
                            aria-label={`Delete ${post.title}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              VIEW 3: DIRECT STORE CATALOG & STOCK MANAGEMENT
             ========================================================= */}
          {activeView === 'store' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left 5 cols: Direct Store Product Composer */}
              <form
                onSubmit={(e) => void handleSaveDirectProductSubmit(e)}
                className="xl:col-span-5 bg-white border border-stone-200/90 rounded-xl p-6 space-y-4"
              >
                <div className="pb-4 border-b border-stone-200/80 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="font-serif text-lg font-medium text-stone-900">
                      {editingProductId
                        ? 'Edit Direct Store SKU'
                        : 'Add Direct Store Product'}
                    </h2>
                    <p className="mt-0.5 text-xs text-stone-500">
                      First-party physical editions and instant digital toolkits.
                    </p>
                  </div>
                  {editingProductId && (
                    <button
                      type="button"
                      onClick={resetProductComposer}
                      className="text-xs font-medium text-stone-600 hover:text-stone-900 underline cursor-pointer shrink-0"
                    >
                      New Form
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Product Title
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={140}
                    value={prodTitle}
                    onChange={(e) => setProdTitle(e.target.value)}
                    placeholder="e.g., Pickra Archival Desk Tray"
                    className="w-full px-3 py-2 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Card Subtitle
                  </label>
                  <input
                    type="text"
                    required
                    minLength={4}
                    maxLength={220}
                    value={prodSubtitle}
                    onChange={(e) => setProdSubtitle(e.target.value)}
                    placeholder="Concise one-line product hook..."
                    className="w-full px-3 py-2 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Format
                    </label>
                    <select
                      value={prodKind}
                      onChange={(e) => {
                        const nextKind = e.target.value as DirectProductKind;
                        setProdKind(nextKind);
                        if (nextKind === 'digital') {
                          setProdDeliveryNote(
                            'Instant digital download unlocked immediately'
                          );
                          setProdStock('999');
                        } else {
                          setProdDeliveryNote(
                            'Ships in 48 hours from Pickra Studio'
                          );
                        }
                      }}
                      className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    >
                      <option value="physical">Physical</option>
                      <option value="digital">Digital</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Category
                    </label>
                    <EditableDropdownSelect
                      ariaLabel="Category"
                      value={prodCategory}
                      options={dropdownOptions.storeCategories}
                      onChange={setProdCategory}
                      onAddOption={(opt) =>
                        addDropdownOption('storeCategories', opt)
                      }
                      onRenameOption={(oldOpt, newOpt) =>
                        renameDropdownOption('storeCategories', oldOpt, newOpt)
                      }
                      onDeleteOption={(opt) =>
                        deleteDropdownOption('storeCategories', opt)
                      }
                      selectClassName="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                      placeholder="New category..."
                      compact
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      SKU
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={32}
                      value={prodSku}
                      onChange={(e) => setProdSku(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-mono uppercase bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Price (USD)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      value={prodPriceUsd}
                      onChange={(e) => setProdPriceUsd(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-mono tabular-nums bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Compare USD
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={prodCompareUsd}
                      onChange={(e) => setProdCompareUsd(e.target.value)}
                      placeholder="98.00"
                      className="w-full px-2.5 py-2 text-xs font-mono tabular-nums bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Stock
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100000"
                      value={prodStock}
                      onChange={(e) => setProdStock(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-mono tabular-nums bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Kicker Label
                    </label>
                    <input
                      type="text"
                      maxLength={40}
                      value={prodBadge}
                      onChange={(e) => setProdBadge(e.target.value)}
                      placeholder="Numbered Edition"
                      className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Delivery Promise
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={140}
                      value={prodDeliveryNote}
                      onChange={(e) => setProdDeliveryNote(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    />
                  </div>
                </div>

                <ImageUploadPicker
                  label="Product Photo (Upload from Device, Paste URL, or Studio Preset)"
                  value={prodImageKey}
                  onChange={setProdImageKey}
                  previewAspectClass="aspect-[16/9]"
                  compact
                />

                {/* Video Attachment */}
                <div className="p-3 bg-[#FBF9F5] border border-stone-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-stone-700 inline-flex items-center gap-1">
                      <Video className="w-3.5 h-3.5 text-[#9A3412]" />
                      <span>Product Video (Optional)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-[#1C1917] hover:bg-[#9A3412] rounded cursor-pointer">
                        <Upload className="w-3 h-3" />
                        <span>Upload Video</span>
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            try {
                              const url = await readCompactVideoFileToDataUrl(f);
                              setProdVideoUrl(url);
                            } catch (err) {
                              notify(
                                'err',
                                err instanceof Error
                                  ? err.message
                                  : 'Video upload failed.'
                              );
                            } finally {
                              e.target.value = '';
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                      {prodVideoUrl && (
                        <button
                          type="button"
                          onClick={() => setProdVideoUrl('')}
                          className="text-[11px] text-red-700 hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="url"
                    value={
                      prodVideoUrl.startsWith('data:video/') ? '' : prodVideoUrl
                    }
                    onChange={(e) => setProdVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or .mp4 URL"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded"
                  />
                  {prodVideoUrl && (
                    <VideoEmbedFigure url={prodVideoUrl} compact />
                  )}
                </div>

                {/* Digital Deliverable Upload / Link */}
                {prodKind === 'digital' && (
                  <div className="p-3 bg-[#FBF9F5] border border-stone-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-stone-700">
                        Digital Product Upload / Download Link
                      </span>
                      <label className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded cursor-pointer">
                        <Upload className="w-3 h-3" />
                        <span>Upload PDF / ZIP / Excel / HTML / eBook</span>
                        <input
                          type="file"
                          accept=".pdf,.zip,.xlsx,.xls,.csv,.epub,.mobi,.html,.htm,.json,.js,.ts,.py,.txt,.md,.xml,.svg,.docx,.pptx"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            try {
                              const res =
                                await readDigitalProductFileToDataUrl(f);
                              setProdDigitalFileUrl(res.dataUrl);
                              setProdDigitalFileName(res.fileName);
                              setProdDigitalFileType(res.fileTypeLabel);
                            } catch (err) {
                              notify(
                                'err',
                                err instanceof Error
                                  ? err.message
                                  : 'File upload failed.'
                              );
                            } finally {
                              e.target.value = '';
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <input
                      type="url"
                      value={
                        prodDigitalFileUrl.startsWith('data:')
                          ? ''
                          : prodDigitalFileUrl
                      }
                      onChange={(e) => {
                        setProdDigitalFileUrl(e.target.value);
                        if (!prodDigitalFileType) {
                          setProdDigitalFileType('External Download Link');
                        }
                      }}
                      placeholder={
                        prodDigitalFileUrl.startsWith('data:')
                          ? `Uploaded: ${prodDigitalFileName} (${prodDigitalFileType})`
                          : 'Or paste HTTPS download link (Google Drive, Dropbox, OneDrive...)'
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded"
                    />
                    {prodDigitalFileUrl && (
                      <div className="flex items-center justify-between text-[11px] text-stone-600">
                        <span className="truncate">
                          Active: {prodDigitalFileName || 'Direct Link'} (
                          {prodDigitalFileType || 'Digital Asset'})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setProdDigitalFileUrl('');
                            setProdDigitalFileName('');
                            setProdDigitalFileType('');
                          }}
                          className="text-red-700 hover:underline cursor-pointer shrink-0"
                        >
                          Remove File
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Status
                  </label>
                  <select
                    value={prodStatus}
                    onChange={(e) =>
                      setProdStatus(e.target.value as PublishStatus)
                    }
                    className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                  >
                    <option value="published">Published on Storefront</option>
                    <option value="draft">Draft (Hidden)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Specification Summary
                  </label>
                  <textarea
                    rows={3}
                    required
                    minLength={10}
                    maxLength={1500}
                    value={prodSummary}
                    onChange={(e) => setProdSummary(e.target.value)}
                    placeholder="Materials, dimensions, or included digital files..."
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Key Highlights (up to 4 lines)
                  </label>
                  <textarea
                    rows={3}
                    value={prodHighlightsText}
                    onChange={(e) => setProdHighlightsText(e.target.value)}
                    placeholder={
                      'Solid walnut & brass hardware\nShips in protective custom packaging'
                    }
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prodFeatured}
                    onChange={(e) => setProdFeatured(e.target.checked)}
                    className="rounded border-stone-300"
                  />
                  <span>Feature on Journal homepage showcase</span>
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] disabled:bg-stone-300 rounded-lg transition-colors cursor-pointer"
                >
                  {busy
                    ? 'Saving Product...'
                    : editingProductId
                    ? 'Update Direct Store Product'
                    : 'Publish Direct Store Product'}
                </button>
              </form>

              {/* Right 7 cols: Live Inventory & Stock Table */}
              <div className="xl:col-span-7 bg-white border border-stone-200/90 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-stone-200/80 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-serif text-lg font-medium text-stone-900">
                      Direct Store Inventory ({allManageableDirectProducts.length})
                    </h3>
                    <p className="text-xs text-stone-500">
                      Adjust live stock counts and visibility directly from the table.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportInventoryCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-800 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Export Inventory CSV</span>
                  </button>
                </div>

                <div className="divide-y divide-stone-200/80 px-6">
                  {allManageableDirectProducts.map((prod) => {
                    const draftStock =
                      stockDrafts[prod.id] !== undefined
                        ? stockDrafts[prod.id]
                        : String(prod.stockCount);
                    return (
                      <div
                        key={prod.id}
                        className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                            <span className="font-mono font-semibold text-stone-800">
                              {prod.sku}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">
                              {prod.isSeed ? 'Starter Edition' : prod.status}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {prod.kind === 'digital' ? 'Digital' : 'Physical'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono font-semibold text-stone-900 tabular-nums">
                              {formatPriceCents(prod.priceCents)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              By {prod.sellerName || 'Pickra Studio'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {productBagCounts[prod.id] || 0} bag adds
                            </span>
                          </div>

                          <h4 className="mt-1 text-sm font-semibold text-stone-900">
                            {prod.title}
                          </h4>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
                          {!prod.isSeed ? (
                            <>
                              <div className="inline-flex items-center gap-1">
                                <label
                                  htmlFor={`stock-${prod.id}`}
                                  className="text-[11px] text-stone-500"
                                >
                                  Stock:
                                </label>
                                <input
                                  id={`stock-${prod.id}`}
                                  type="number"
                                  min="0"
                                  max="100000"
                                  value={draftStock}
                                  onChange={(e) =>
                                    setStockDrafts((prev) => ({
                                      ...prev,
                                      [prod.id]: e.target.value,
                                    }))
                                  }
                                  onBlur={() => {
                                    const parsed = Math.max(
                                      0,
                                      Number.parseInt(draftStock || '0', 10) ||
                                        0
                                    );
                                    if (parsed !== prod.stockCount) {
                                      void updateDirectProductStatus(
                                        prod.id,
                                        prod.status,
                                        parsed
                                      );
                                    }
                                  }}
                                  className="w-16 px-2 py-1.5 text-xs font-mono tabular-nums bg-[#FBF9F5] border border-stone-300 rounded-lg text-right"
                                />
                              </div>

                              <select
                                aria-label={`Status for ${prod.title}`}
                                value={prod.status}
                                onChange={(e) =>
                                  void updateDirectProductStatus(
                                    prod.id,
                                    e.target.value as PublishStatus,
                                    prod.stockCount
                                  )
                                }
                                className="px-2.5 py-1.5 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg capitalize"
                              >
                                {PUBLISH_STATUSES.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                            </>
                          ) : (
                            <span className="font-mono text-xs text-stone-500 tabular-nums">
                              Stock: {prod.stockCount}
                            </span>
                          )}

                          <label className="inline-flex items-center gap-1 px-2.5 py-1.5 font-medium text-stone-700 bg-[#FBF9F5] hover:bg-stone-100 border border-stone-200 rounded-lg cursor-pointer whitespace-nowrap">
                            <Camera className="w-3.5 h-3.5 text-[#9A3412]" />
                            <span>Photo</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                try {
                                  const dataUrl =
                                    await compressImageFileToDataUrl(f);
                                  await updateDirectProductImage(prod.id, dataUrl);
                                  notify('ok', 'Product photo updated.');
                                } catch (err) {
                                  notify(
                                    'err',
                                    err instanceof Error
                                      ? err.message
                                      : 'Failed to update product photo.'
                                  );
                                } finally {
                                  e.target.value = '';
                                }
                              }}
                              className="hidden"
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => loadDirectProductIntoComposer(prod)}
                            className="px-3 py-1.5 font-medium text-stone-800 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            Edit
                          </button>

                          {confirmDeleteId === prod.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                void deleteDirectProduct(prod.id);
                                setConfirmDeleteId(null);
                              }}
                              className="text-red-700 font-semibold hover:underline cursor-pointer"
                            >
                              Confirm
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(prod.id)}
                              className="p-1.5 text-stone-400 hover:text-red-700 cursor-pointer"
                              aria-label={`Delete ${prod.title}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              VIEW 4: MARKETING CAMPAIGNS & PROMO CODES
             ========================================================= */}
          {activeView === 'campaigns' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left 5 cols: Promo Campaign Composer */}
              <form
                onSubmit={(e) => void handleSaveCampaignSubmit(e)}
                className="xl:col-span-5 bg-white border border-stone-200/90 rounded-xl p-6 space-y-4"
              >
                <div className="pb-4 border-b border-stone-200/80 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="font-serif text-lg font-medium text-stone-900">
                      {editingCampaignId
                        ? 'Edit Promo Campaign'
                        : 'Launch Promo Campaign'}
                    </h2>
                    <p className="mt-0.5 text-xs text-stone-500">
                      Create percentage promo codes and shareable auto-apply Storefront links.
                    </p>
                  </div>
                  {editingCampaignId && (
                    <button
                      type="button"
                      onClick={resetCampaignComposer}
                      className="text-xs font-medium text-stone-600 hover:text-stone-900 underline cursor-pointer shrink-0"
                    >
                      New Form
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Campaign Headline
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={120}
                    value={campTitle}
                    onChange={(e) => setCampTitle(e.target.value)}
                    placeholder="e.g., Spring Desk Upgrade — 15% Off Direct Editions"
                    className="w-full px-3 py-2 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Campaign Copy
                  </label>
                  <textarea
                    rows={2}
                    required
                    minLength={8}
                    maxLength={280}
                    value={campDescription}
                    onChange={(e) => setCampDescription(e.target.value)}
                    placeholder="Details on eligible editions, bundles, or seasonal window..."
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Promo Code
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={24}
                      value={campPromoCode}
                      onChange={(e) =>
                        setCampPromoCode(e.target.value.toUpperCase())
                      }
                      className="w-full px-2.5 py-2 text-xs font-mono uppercase bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Discount (%)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="90"
                      value={campDiscountPercent}
                      onChange={(e) => setCampDiscountPercent(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-mono tabular-nums bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Min Order ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={campMinOrderUsd}
                      onChange={(e) => setCampMinOrderUsd(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-mono tabular-nums bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Placement Channel
                    </label>
                    <EditableDropdownSelect
                      ariaLabel="Placement Channel"
                      value={campChannel}
                      options={
                        dropdownOptions.campaignChannels.length > 0
                          ? dropdownOptions.campaignChannels
                          : CAMPAIGN_CHANNELS
                      }
                      onChange={(val) => setCampChannel(val as CampaignChannel)}
                      onAddOption={(opt) =>
                        addDropdownOption('campaignChannels', opt)
                      }
                      onRenameOption={(oldOpt, newOpt) =>
                        renameDropdownOption('campaignChannels', oldOpt, newOpt)
                      }
                      onDeleteOption={(opt) =>
                        deleteDropdownOption('campaignChannels', opt)
                      }
                      selectClassName="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                      placeholder="New channel..."
                      compact
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Spotlight Product (Optional)
                    </label>
                    <select
                      value={campFeaturedProductId}
                      onChange={(e) => setCampFeaturedProductId(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    >
                      <option value="">Entire Direct Storefront</option>
                      {allManageableDirectProducts.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.title} ({formatPriceCents(prod.priceCents)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      CTA Label
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={40}
                      value={campCtaLabel}
                      onChange={(e) => setCampCtaLabel(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Urgency Note
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={60}
                      value={campExpiresLabel}
                      onChange={(e) => setCampExpiresLabel(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Status
                    </label>
                    <select
                      value={campStatus}
                      onChange={(e) =>
                        setCampStatus(e.target.value as PublishStatus)
                      }
                      className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    >
                      <option value="published">Active</option>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] disabled:bg-stone-300 rounded-lg transition-colors cursor-pointer"
                >
                  {busy
                    ? 'Saving Campaign...'
                    : editingCampaignId
                    ? 'Update Promo Campaign'
                    : 'Publish Promo Campaign'}
                </button>
              </form>

              {/* Right 7 cols: Active Campaigns & Redemption Monitor */}
              <div className="xl:col-span-7 bg-white border border-stone-200/90 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-stone-200/80">
                  <h3 className="font-serif text-lg font-medium text-stone-900">
                    Marketing Campaigns &amp; Promo Redemptions (
                    {allManageableCampaigns.length})
                  </h3>
                  <p className="text-xs text-stone-500">
                    Copy shareable promo URLs to attach inside blog stories, newsletters, or social bio links.
                  </p>
                </div>

                <div className="divide-y divide-stone-200/80 px-6">
                  {allManageableCampaigns.map((camp) => {
                    const redemptions =
                      monitorStats.promoRedemptionMap[camp.promoCode] || 0;
                    return (
                      <div key={camp.id} className="py-4 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-semibold text-[#9A3412]">
                              {camp.promoCode}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {camp.discountPercent}% Off
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{camp.channel}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums text-stone-800">
                              {redemptions} order{' '}
                              {redemptions === 1 ? 'redemption' : 'redemptions'}
                            </span>
                          </div>

                          {!camp.isSeed ? (
                            <select
                              aria-label={`Status for ${camp.promoCode}`}
                              value={camp.status}
                              onChange={(e) =>
                                void updateCampaignStatus(
                                  camp.id,
                                  e.target.value as PublishStatus
                                )
                              }
                              className="px-2 py-1 text-xs bg-[#FBF9F5] border border-stone-300 rounded-md capitalize"
                            >
                              {PUBLISH_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span>Starter Promo</span>
                          )}
                        </div>

                        <h4 className="text-sm font-semibold text-stone-900">
                          {camp.title}
                        </h4>
                        <p className="text-xs text-stone-600">
                          {camp.description}
                        </p>

                        <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              void copyCampaignMarketingUrl(
                                camp.id,
                                camp.promoCode
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            {copiedCampaignId === camp.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-700" />
                                <span>Promo Link Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Shareable Promo URL</span>
                              </>
                            )}
                          </button>

                          <div className="flex items-center gap-3 text-xs">
                            <button
                              type="button"
                              onClick={() => loadCampaignIntoComposer(camp)}
                              className="font-medium text-stone-700 hover:text-stone-900 underline cursor-pointer"
                            >
                              Edit
                            </button>

                            {confirmDeleteId === camp.id ? (
                              <button
                                type="button"
                                onClick={() => {
                                  void deleteCampaign(camp.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="text-red-700 font-semibold hover:underline cursor-pointer"
                              >
                                Confirm
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(camp.id)}
                                className="text-stone-400 hover:text-red-700 cursor-pointer"
                                aria-label={`Delete ${camp.title}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              VIEW 5: CUSTOMER ORDERS & FULFILLMENT LEDGER
             ========================================================= */}
          {activeView === 'orders' && (
            <div className="space-y-6">
              {/* Financial & Creator Payout Summary Bar */}
              <div className="bg-white border border-stone-200/90 rounded-xl grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-stone-200/80">
                <div className="p-5">
                  <div className="text-xs text-stone-500">Total Orders</div>
                  <div className="mt-1 font-mono text-2xl font-semibold text-stone-900 tabular-nums">
                    {monitorStats.totalOrders}
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-xs text-stone-500">
                    Gross Store Volume
                  </div>
                  <div className="mt-1 font-mono text-2xl font-semibold text-stone-900 tabular-nums">
                    {formatPriceCents(monitorStats.activeRevenueCents)}
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-xs text-stone-500">
                    Pending Creator Payouts
                  </div>
                  <div className="mt-1 font-mono text-2xl font-semibold text-[#9A3412] tabular-nums">
                    {formatPriceCents(monitorStats.pendingPayoutsCents)}
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-xs text-stone-500">
                    Settled Creator Payouts
                  </div>
                  <div className="mt-1 font-mono text-2xl font-semibold text-emerald-800 tabular-nums">
                    {formatPriceCents(monitorStats.settledPayoutsCents)}
                  </div>
                </div>
                <div className="p-5 col-span-2 sm:col-span-1">
                  <div className="text-xs text-stone-500">
                    Shipped / Fulfilled
                  </div>
                  <div className="mt-1 font-mono text-2xl font-semibold text-stone-900 tabular-nums">
                    {monitorStats.fulfilledCount}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-stone-200/90 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-stone-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-lg font-medium text-stone-900">
                      Customer Orders, Fulfillment &amp; Creator Payouts
                    </h2>
                    <p className="text-xs text-stone-500">
                      Monitor all marketplace orders, update courier tracking, and settle 90% net payouts to third-party creator sellers.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <select
                      aria-label="Filter orders by status"
                      value={orderStatusFilter}
                      onChange={(e) =>
                        setOrderStatusFilter(
                          e.target.value as 'all' | OrderFulfillmentStatus
                        )
                      }
                      className="px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-200 rounded-lg text-stone-700 capitalize"
                    >
                      <option value="all">All Statuses</option>
                      {ORDER_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>

                    <div className="relative w-full sm:w-56">
                      <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="search"
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        placeholder="Order #, buyer, seller..."
                        className="w-full pl-8 pr-7 py-2 text-xs bg-[#FBF9F5] border border-stone-200 rounded-lg focus:outline-none focus:border-[#9A3412]"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={filteredOrders.length === 0}
                      onClick={handleExportOrdersCsv}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-800 bg-[#F3EFE8] hover:bg-stone-200 disabled:opacity-50 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>Export Orders CSV</span>
                    </button>
                  </div>
                </div>

                {filteredOrders.length === 0 ? (
                  <div className="py-14 px-6 text-center">
                    <Package className="w-7 h-7 text-stone-300 mx-auto" />
                    <p className="mt-3 text-sm text-stone-600">
                      No matching direct store orders found.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-stone-200/80 px-6">
                    {filteredOrders.map((order) => {
                      const draft = orderDrafts[order.id] || {
                        status: order.status,
                        note: order.fulfillmentNote,
                      };
                      const pDraft = payoutDrafts[order.id] || {
                        payoutStatus: order.payoutStatus || 'pending',
                        payoutNote: order.payoutNote || '',
                      };
                      const netPayout =
                        typeof order.sellerPayoutCents === 'number'
                          ? order.sellerPayoutCents
                          : Math.round(order.totalCents * 0.9);
                      const platformFee =
                        typeof order.platformFeeCents === 'number'
                          ? order.platformFeeCents
                          : order.totalCents - netPayout;

                      return (
                        <div
                          key={order.id}
                          className="py-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
                        >
                          <div className="lg:col-span-6 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                              <span className="font-mono font-semibold text-stone-900">
                                {order.orderNumber}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="capitalize font-medium text-[#9A3412]">
                                {order.status}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                {formatShortTimestamp(order.createdAtMs)}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono font-semibold text-stone-900 tabular-nums">
                                {formatPriceCents(order.totalCents)}
                              </span>
                              {order.promoCode && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono text-emerald-800">
                                    Promo {order.promoCode}
                                  </span>
                                </>
                              )}
                            </div>

                            <h3 className="text-sm font-semibold text-stone-900">
                              {order.itemsSummary}
                            </h3>

                            <div className="text-xs text-stone-600">
                              Seller:{' '}
                              <strong>
                                {order.sellerName || 'Pickra Studio'}
                              </strong>{' '}
                              · Creator Share:{' '}
                              <span className="font-mono font-semibold text-stone-900 tabular-nums">
                                {formatPriceCents(netPayout)}
                              </span>{' '}
                              <span className="font-mono text-stone-500 tabular-nums">
                                (10% Fee: {formatPriceCents(platformFee)})
                              </span>
                            </div>

                            {order.sellerPayoutDetails && (
                              <div className="text-xs font-mono text-stone-600">
                                Payout Destination: {order.sellerPayoutDetails}
                              </div>
                            )}

                            <div className="text-xs text-stone-600">
                              Buyer: <strong>{order.buyerName}</strong> (
                              <span className="font-mono">
                                {order.buyerEmail}
                              </span>
                              )
                            </div>

                            {order.shippingAddress && (
                              <div className="text-xs text-stone-500">
                                Ship to: {order.shippingAddress}
                              </div>
                            )}

                            <div className="pt-1">
                              {confirmDeleteId === `ord_${order.id}` ? (
                                <span className="inline-flex items-center gap-2 text-xs">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void deleteDirectOrder(order.id);
                                      setConfirmDeleteId(null);
                                    }}
                                    className="font-semibold text-red-700 hover:underline cursor-pointer"
                                  >
                                    Confirm Remove Order
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="text-stone-500 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmDeleteId(`ord_${order.id}`)
                                  }
                                  className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-red-700 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete Order Record</span>
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="lg:col-span-6 space-y-3">
                            {/* Fulfillment Control */}
                            <div className="p-3 bg-[#FBF9F5] border border-stone-200/80 rounded-lg space-y-2">
                              <div className="text-[11px] font-medium text-stone-600">
                                Order Fulfillment &amp; Buyer Note
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  aria-label="Order fulfillment status"
                                  value={draft.status}
                                  onChange={(e) =>
                                    setOrderDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        status: e.target
                                          .value as OrderFulfillmentStatus,
                                        note: draft.note,
                                      },
                                    }))
                                  }
                                  className="flex-1 px-2.5 py-1.5 text-xs font-medium bg-white border border-stone-300 rounded-lg capitalize"
                                >
                                  {ORDER_STATUSES.map((st) => (
                                    <option key={st} value={st}>
                                      {st}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void handleUpdateOrder(order.id)
                                  }
                                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  Save Fulfillment
                                </button>
                              </div>

                              <input
                                type="text"
                                maxLength={300}
                                value={draft.note}
                                onChange={(e) =>
                                  setOrderDrafts((prev) => ({
                                    ...prev,
                                    [order.id]: {
                                      status: draft.status,
                                      note: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="Courier tracking link or buyer fulfillment note..."
                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                              />
                            </div>

                            {/* Creator Payout Settlement Control */}
                            <div className="p-3 bg-[#FBF9F5] border border-stone-200/80 rounded-lg space-y-2">
                              <div className="text-[11px] font-medium text-stone-600">
                                Creator Seller Payout Settlement
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  aria-label="Creator payout status"
                                  value={pDraft.payoutStatus}
                                  onChange={(e) =>
                                    setPayoutDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        payoutStatus: e.target
                                          .value as PayoutSettlementStatus,
                                        payoutNote: pDraft.payoutNote,
                                      },
                                    }))
                                  }
                                  className="flex-1 px-2.5 py-1.5 text-xs font-medium bg-white border border-stone-300 rounded-lg"
                                >
                                  <option value="pending">
                                    Pending Payout ({formatPriceCents(netPayout)})
                                  </option>
                                  <option value="paid_out">
                                    Paid Out to Creator
                                  </option>
                                  <option value="not_applicable">
                                    Owner Direct Sale (N/A)
                                  </option>
                                </select>

                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void handleUpdateOrderPayout(order.id)
                                  }
                                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  Settle Payout
                                </button>
                              </div>

                              <input
                                type="text"
                                maxLength={240}
                                value={pDraft.payoutNote}
                                onChange={(e) =>
                                  setPayoutDrafts((prev) => ({
                                    ...prev,
                                    [order.id]: {
                                      payoutStatus: pDraft.payoutStatus,
                                      payoutNote: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="Payout transaction reference (e.g., Stripe tr_... or PayPal TXN)..."
                                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================
              VIEW 6: AFFILIATE PRODUCTS & FREELANCE SERVICES CATALOG
             ========================================================= */}
          {activeView === 'offers' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left 5 cols: Multi-Platform Affiliate Composer */}
              <form
                onSubmit={(e) => void handleSaveOfferSubmit(e)}
                className="xl:col-span-5 bg-white border border-stone-200/90 rounded-xl p-6 space-y-4"
              >
                <div className="pb-4 border-b border-stone-200/80 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="font-serif text-lg font-medium text-stone-900">
                      {editingOfferId
                        ? 'Edit Affiliate Link'
                        : 'Add Affiliate Product or Service'}
                    </h2>
                    <p className="mt-0.5 text-xs text-stone-500">
                      Amazon, Digistore24, Gumroad, ClickBank, Upwork &amp; Fiverr.
                    </p>
                  </div>
                  {editingOfferId && (
                    <button
                      type="button"
                      onClick={resetOfferComposer}
                      className="text-xs font-medium text-stone-600 hover:text-stone-900 underline cursor-pointer shrink-0"
                    >
                      New Form
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Offering Title
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={140}
                    value={offerTitle}
                    onChange={(e) => setOfferTitle(e.target.value)}
                    placeholder="e.g., Keychron Q1 Max or Upwork SaaS Architect"
                    className="w-full px-3 py-2 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Type
                    </label>
                    <select
                      value={offerKind}
                      onChange={(e) =>
                        setOfferKind(e.target.value as OfferKind)
                      }
                      className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    >
                      <option value="physical">Physical</option>
                      <option value="digital">Digital</option>
                      <option value="service">Service</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Platform
                    </label>
                    <EditableDropdownSelect
                      ariaLabel="Platform"
                      value={offerPlatform}
                      options={
                        offerKind === 'service'
                          ? dropdownOptions.servicePlatforms
                          : dropdownOptions.productPlatforms
                      }
                      onChange={(val) =>
                        setOfferPlatform(val as AffiliatePlatform)
                      }
                      onAddOption={(opt) =>
                        addDropdownOption(
                          offerKind === 'service'
                            ? 'servicePlatforms'
                            : 'productPlatforms',
                          opt
                        )
                      }
                      onRenameOption={(oldOpt, newOpt) =>
                        renameDropdownOption(
                          offerKind === 'service'
                            ? 'servicePlatforms'
                            : 'productPlatforms',
                          oldOpt,
                          newOpt
                        )
                      }
                      onDeleteOption={(opt) =>
                        deleteDropdownOption(
                          offerKind === 'service'
                            ? 'servicePlatforms'
                            : 'productPlatforms',
                          opt
                        )
                      }
                      selectClassName="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                      placeholder="New platform..."
                      compact
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Price Label
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={40}
                      value={offerPrice}
                      onChange={(e) => setOfferPrice(e.target.value)}
                      placeholder="$149.00"
                      className="w-full px-2.5 py-2 text-xs font-mono bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Department / Category
                    </label>
                    <EditableDropdownSelect
                      ariaLabel="Department or Category"
                      value={offerCategory}
                      options={dropdownOptions.affiliateCategories}
                      onChange={setOfferCategory}
                      onAddOption={(opt) =>
                        addDropdownOption('affiliateCategories', opt)
                      }
                      onRenameOption={(oldOpt, newOpt) =>
                        renameDropdownOption(
                          'affiliateCategories',
                          oldOpt,
                          newOpt
                        )
                      }
                      onDeleteOption={(opt) =>
                        deleteDropdownOption('affiliateCategories', opt)
                      }
                      selectClassName="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                      placeholder="New category..."
                      compact
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Editorial Tagline (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      value={offerCommission}
                      onChange={(e) => setOfferCommission(e.target.value)}
                      placeholder="Prime Delivery · Top Rated"
                      className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="text-xs font-medium text-stone-700">
                      Affiliate Destination URL (HTTPS)
                    </label>
                    {(offerPlatform === 'Amazon' ||
                      offerPlatform === 'Digistore24') && (
                      <button
                        type="button"
                        onClick={applyDefaultAffiliateIdToUrl}
                        className="text-[11px] font-semibold text-[#9A3412] hover:underline cursor-pointer"
                      >
                        Append Saved {offerPlatform} ID
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    required
                    value={offerUrl}
                    onChange={(e) => setOfferUrl(e.target.value)}
                    placeholder="https://www.amazon.com/dp/..."
                    className="w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                <ImageUploadPicker
                  label="Visual / Thumbnail (Upload Photo, Paste URL, or Studio Preset)"
                  value={offerImageKey}
                  onChange={setOfferImageKey}
                  previewAspectClass="aspect-[16/9]"
                  compact
                />

                <div className="p-3 bg-[#FBF9F5] border border-stone-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-stone-700 inline-flex items-center gap-1">
                      <Video className="w-3.5 h-3.5 text-[#9A3412]" />
                      <span>Video Attachment (Optional)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-[#1C1917] hover:bg-[#9A3412] rounded cursor-pointer">
                        <Upload className="w-3 h-3" />
                        <span>Upload Video</span>
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            try {
                              const url = await readCompactVideoFileToDataUrl(f);
                              setOfferVideoUrl(url);
                            } catch (err) {
                              notify(
                                'err',
                                err instanceof Error
                                  ? err.message
                                  : 'Video upload failed.'
                              );
                            } finally {
                              e.target.value = '';
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                      {offerVideoUrl && (
                        <button
                          type="button"
                          onClick={() => setOfferVideoUrl('')}
                          className="text-[11px] text-red-700 hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="url"
                    value={
                      offerVideoUrl.startsWith('data:video/')
                        ? ''
                        : offerVideoUrl
                    }
                    onChange={(e) => setOfferVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or Vimeo / .mp4"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded"
                  />
                  {offerVideoUrl && (
                    <VideoEmbedFigure url={offerVideoUrl} compact />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Status
                  </label>
                  <select
                    value={offerStatus}
                    onChange={(e) =>
                      setOfferStatus(e.target.value as PublishStatus)
                    }
                    className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Description &amp; Affiliate Links (supports [Label](https://...) &amp; pasted URLs)
                  </label>
                  <textarea
                    rows={4}
                    required
                    minLength={10}
                    maxLength={2500}
                    value={offerSummary}
                    onChange={(e) => setOfferSummary(e.target.value)}
                    placeholder="Write description and paste digital/physical product or service affiliate links..."
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Key Highlights (up to 4 lines)
                  </label>
                  <textarea
                    rows={3}
                    value={offerHighlightsText}
                    onChange={(e) => setOfferHighlightsText(e.target.value)}
                    placeholder={
                      'CNC aluminum chassis\nTri-mode wireless connectivity'
                    }
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] disabled:bg-stone-300 rounded-lg transition-colors cursor-pointer"
                >
                  {busy
                    ? 'Saving Link...'
                    : editingOfferId
                    ? 'Update Affiliate Offering'
                    : 'Save to Affiliate Catalog'}
                </button>
              </form>

              {/* Right 7 cols: Affiliate Catalog & Outbound Click Monitor */}
              <div className="xl:col-span-7 bg-white border border-stone-200/90 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-serif text-lg font-medium text-stone-900">
                      Affiliate Links &amp; Outbound Clicks ({filteredOffers.length})
                    </h3>
                    <p className="text-xs text-stone-500">
                      Monitor partner click performance across products and freelance services.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportAffiliateCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-800 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Export Clicks CSV</span>
                  </button>
                </div>

                <div className="px-6 py-3 bg-[#FBF9F5] border-b border-stone-200/80 flex flex-wrap items-center justify-between gap-3">
                  <select
                    aria-label="Filter affiliate links by platform"
                    value={offerPlatformFilter}
                    onChange={(e) =>
                      setOfferPlatformFilter(
                        e.target.value as 'All' | AffiliatePlatform
                      )
                    }
                    className="px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg text-stone-700"
                  >
                    <option value="All">All Networks</option>
                    {Array.from(
                      new Set([
                        ...dropdownOptions.productPlatforms,
                        ...dropdownOptions.servicePlatforms,
                        ...PLATFORMS,
                      ])
                    ).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>

                  <div className="relative w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={offerSearch}
                      onChange={(e) => setOfferSearch(e.target.value)}
                      placeholder="Search partner offers..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>
                </div>

                <div className="divide-y divide-stone-200/80 px-6">
                  {filteredOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                          <span className="font-medium text-[#9A3412]">
                            {offer.platform}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{offer.kind}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-stone-800">
                            {offer.priceLabel}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-semibold text-stone-900 tabular-nums">
                            {clickCounts[offer.id] || 0} clicks
                          </span>
                        </div>
                        <h4 className="mt-1 text-sm font-semibold text-stone-900">
                          {offer.title}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0 text-xs">
                        {!offer.isSeed && (
                          <select
                            aria-label={`Status for ${offer.title}`}
                            value={offer.status}
                            onChange={(e) =>
                              void updateOfferStatus(
                                offer.id,
                                e.target.value as PublishStatus
                              )
                            }
                            className="px-2.5 py-1.5 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg capitalize"
                          >
                            {PUBLISH_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        )}

                        <label className="inline-flex items-center gap-1 px-2.5 py-1.5 font-medium text-stone-700 bg-[#FBF9F5] hover:bg-stone-100 border border-stone-200 rounded-lg cursor-pointer whitespace-nowrap">
                          <Camera className="w-3.5 h-3.5 text-[#9A3412]" />
                          <span>Photo</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              try {
                                const dataUrl =
                                  await compressImageFileToDataUrl(f);
                                await updateOfferImage(offer.id, dataUrl);
                                notify('ok', 'Affiliate offer photo updated.');
                              } catch (err) {
                                notify(
                                  'err',
                                  err instanceof Error
                                    ? err.message
                                    : 'Failed to update offer photo.'
                                );
                              } finally {
                                e.target.value = '';
                              }
                            }}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => loadOfferIntoComposer(offer)}
                          className="px-3 py-1.5 font-medium text-stone-800 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          Edit
                        </button>

                        {confirmDeleteId === offer.id ? (
                          <button
                            type="button"
                            onClick={() => {
                              void deleteOffer(offer.id);
                              setConfirmDeleteId(null);
                            }}
                            className="text-red-700 font-semibold hover:underline cursor-pointer"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(offer.id)}
                            className="p-1.5 text-stone-400 hover:text-red-700 cursor-pointer"
                            aria-label={`Delete ${offer.title}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              VIEW 7: GLOBAL SITE SETTINGS, ACCESS REGISTRY & AFFILIATE IDS
             ========================================================= */}
          {activeView === 'settings' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left 7 cols: Global Site Configuration (/siteConfig/main) */}
              <form
                onSubmit={(e) => void handleSaveSiteConfigSubmit(e)}
                className="xl:col-span-7 bg-white border border-stone-200/90 rounded-xl p-6 sm:p-8 space-y-5"
              >
                <div className="pb-4 border-b border-stone-200/80">
                  <h2 className="font-serif text-xl font-medium text-stone-900">
                    Global Website &amp; Commerce Configuration
                  </h2>
                  <p className="mt-1 text-xs text-stone-500">
                    Changes saved here update the live Pickra masthead, announcement ribbon, Direct Store shipping rules, and checkout master switch immediately for all visitors.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    Publication Tagline (Footer &amp; Operational Strip)
                  </label>
                  <input
                    type="text"
                    required
                    minLength={4}
                    maxLength={140}
                    value={cfgTagline}
                    onChange={(e) => setCfgTagline(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                <div className="pt-3 border-t border-stone-200/80 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold text-stone-900">
                        Site-Wide Announcement Ribbon
                      </div>
                      <div className="text-[11px] text-stone-500">
                        Display a top announcement bar above the Pickra navigation header.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={cfgAnnouncementEnabled}
                      onChange={(e) =>
                        setCfgAnnouncementEnabled(e.target.checked)
                      }
                      className="w-4 h-4 accent-[#9A3412] cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Announcement Message
                    </label>
                    <input
                      type="text"
                      maxLength={180}
                      value={cfgAnnouncementText}
                      onChange={(e) => setCfgAnnouncementText(e.target.value)}
                      placeholder="e.g., Spring Issue Live · Free shipping over $95 with code PICKRA15"
                      className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Ribbon CTA Label
                      </label>
                      <input
                        type="text"
                        maxLength={40}
                        value={cfgAnnouncementCta}
                        onChange={(e) => setCfgAnnouncementCta(e.target.value)}
                        placeholder="Shop Direct"
                        className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Ribbon Destination Section
                      </label>
                      <select
                        value={cfgAnnouncementTarget}
                        onChange={(e) =>
                          setCfgAnnouncementTarget(
                            e.target.value as AnnouncementTargetSection
                          )
                        }
                        className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                      >
                        <option value="blog">Blog</option>
                        <option value="store">Store (Creators&apos; Marketplace)</option>
                        <option value="products">Affiliate Products</option>
                        <option value="services">Affiliate Services</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-200/80 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Free Physical Shipping Threshold (USD)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        step="1"
                        value={cfgFreeShipUsd}
                        onChange={(e) => setCfgFreeShipUsd(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#FBF9F5] border border-stone-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Flat Physical Courier Fee (USD)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="500"
                        step="0.50"
                        value={cfgFlatShipUsd}
                        onChange={(e) => setCfgFlatShipUsd(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#FBF9F5] border border-stone-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 text-xs text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cfgCheckoutEnabled}
                      onChange={(e) => setCfgCheckoutEnabled(e.target.checked)}
                      className="mt-0.5 accent-[#9A3412]"
                    />
                    <span>
                      <strong>Enable Direct Store Checkout</strong> — uncheck to temporarily pause incoming orders during inventory audits (enforced in both UI and Firestore security rules).
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 text-xs text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cfgShowStarterSeeds}
                      onChange={(e) => setCfgShowStarterSeeds(e.target.checked)}
                      className="mt-0.5 accent-[#9A3412]"
                    />
                    <span>
                      <strong>Display Starter Editorial &amp; Store Showcase Items</strong> — uncheck when you want Pickra to display only your own saved Firestore posts, products, and links.
                    </span>
                  </label>
                </div>

                <div className="pt-3 border-t border-stone-200/80">
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    Default Editorial &amp; FTC Affiliate Disclosure
                  </label>
                  <textarea
                    rows={3}
                    required
                    minLength={10}
                    maxLength={400}
                    value={cfgDefaultDisclosure}
                    onChange={(e) => setCfgDefaultDisclosure(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] disabled:bg-stone-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  {busy ? 'Saving Site Config...' : 'Save Global Site Settings'}
                </button>
              </form>

              {/* Right 5 cols: Creator Profile + Private Affiliate IDs + Co-Admin Access Registry */}
              <div className="xl:col-span-5 space-y-6">
                <form
                  onSubmit={(e) => void handleSaveProfileSettings(e)}
                  className="bg-white border border-stone-200/90 rounded-xl p-6 space-y-4"
                >
                  <div className="pb-3 border-b border-stone-200/80">
                    <h3 className="font-serif text-lg font-medium text-stone-900">
                      Creator Profile &amp; Private Affiliate IDs
                    </h3>
                    <p className="mt-0.5 text-xs text-stone-500">
                      Partner tracking IDs are isolated in your private Firestore subcollection.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Public Byline Name
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={80}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Editorial Bio
                    </label>
                    <textarea
                      rows={2}
                      maxLength={300}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Amazon Associate Tag
                      </label>
                      <input
                        type="text"
                        maxLength={64}
                        value={amazonTag}
                        onChange={(e) => setAmazonTag(e.target.value)}
                        placeholder="pickra-20"
                        className="w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] border border-stone-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Digistore24 Affiliate ID
                      </label>
                      <input
                        type="text"
                        maxLength={64}
                        value={digistoreId}
                        onChange={(e) => setDigistoreId(e.target.value)}
                        placeholder="pickra_media"
                        className="w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] border border-stone-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] disabled:bg-stone-300 rounded-lg transition-colors cursor-pointer"
                  >
                    Save Profile &amp; Tracking IDs
                  </button>
                </form>

                {/* Co-Admin Access Control Registry */}
                <div className="bg-white border border-stone-200/90 rounded-xl p-6 space-y-4">
                  <div className="pb-3 border-b border-stone-200/80 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-serif text-lg font-medium text-stone-900">
                        Creator &amp; Co-Admin Access Registry
                      </h3>
                      <p className="mt-0.5 text-xs text-stone-500">
                        Manage who can access this Pickra Backend and publish content.
                      </p>
                    </div>
                    <ShieldCheck className="w-4 h-4 text-[#9A3412] shrink-0" />
                  </div>

                  <div className="text-xs text-stone-600 space-y-1">
                    <div>
                      Primary Owner:{' '}
                      <span className="font-mono text-stone-900">
                        {BOOTSTRAPPED_ADMIN_EMAIL}
                      </span>
                    </div>
                    <div>
                      Your UID:{' '}
                      <span className="font-mono text-stone-800">
                        {user.uid}
                      </span>
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => void handleGrantCoAdminSubmit(e)}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={newCoAdminUid}
                      onChange={(e) => setNewCoAdminUid(e.target.value)}
                      placeholder="Paste verified Firebase User UID..."
                      maxLength={128}
                      className="flex-1 px-3 py-2 text-xs font-mono bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                    />
                    <button
                      type="submit"
                      disabled={busy || !newCoAdminUid.trim()}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] disabled:bg-stone-300 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Grant Access
                    </button>
                  </form>

                  {adminRegistry.length > 0 && (
                    <div className="divide-y divide-stone-200/80 pt-2">
                      {adminRegistry.map((rec) => (
                        <div
                          key={rec.uid}
                          className="py-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-mono text-stone-900 truncate">
                              {rec.uid}
                            </div>
                            <div className="text-[11px] text-stone-500">
                              Added {formatShortTimestamp(rec.createdAtMs)}
                            </div>
                          </div>
                          {rec.uid !== user.uid && (
                            <button
                              type="button"
                              onClick={() => void revokeCoAdmin(rec.uid)}
                              className="text-red-700 hover:underline font-medium cursor-pointer shrink-0"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
