import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  DollarSign,
  Edit3,
  LogIn,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Store,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  CampaignDraftInput,
  DirectProductDraftInput,
  useFirebaseApp,
} from '../context/FirebaseContext';
import { formatPriceCents, toSafePromoCode } from '../firebase';
import {
  CampaignChannel,
  DirectProduct,
  DirectProductKind,
  MarketingCampaign,
  OrderFulfillmentStatus,
  PublishStatus,
  SellerPayoutMethod,
} from '../types';
import { DirectProductCard } from './DirectProductCard';
import { ImageUploadPicker } from './ImageUploadPicker';
import { ResilientImage } from './ResilientImage';

export type StoreSubView = 'catalog' | 'sell' | 'purchases';

interface DirectStorefrontProps {
  initialSubView?: StoreSubView;
}

const PAYOUT_METHODS: { value: SellerPayoutMethod; label: string }[] = [
  { value: 'Stripe', label: 'Stripe Express / Connect' },
  { value: 'PayPal', label: 'PayPal Business / Email' },
  { value: 'Wise', label: 'Wise Multi-Currency' },
  { value: 'BankTransfer', label: 'Direct Bank / Wire (IBAN / ACH)' },
];

const ORDER_STATUSES: OrderFulfillmentStatus[] = [
  'paid',
  'processing',
  'shipped',
  'fulfilled',
  'cancelled',
];

const CAMPAIGN_CHANNELS: CampaignChannel[] = [
  'Storefront Banner',
  'Blog Callout',
  'Social & Email',
  'Flash Bundle',
];

export const DirectStorefront: React.FC<DirectStorefrontProps> = ({
  initialSubView = 'catalog',
}) => {
  const {
    user,
    isCreatorAdmin,
    profile,
    privateInfo,
    publishedDirectProducts,
    mySellerProducts,
    publishedCampaigns,
    myPurchases,
    mySellerOrders,
    cartCount,
    cartTotalCents,
    appliedCampaign,
    setIsCartOpen,
    addToCart,
    applyPromoCode,
    signInWithGoogle,
    registerOrUpdateSellerAccount,
    saveDirectProduct,
    updateDirectProductStatus,
    deleteDirectProduct,
    saveCampaign,
    deleteCampaign,
    updateDirectOrderFulfillment,
    updateOrderPayoutDetails,
    cancelBuyerOrder,
    siteConfig,
    recordProductView,
  } = useFirebaseApp();

  const [subView, setSubView] = useState<StoreSubView>(initialSubView);
  const [kindFilter, setKindFilter] = useState<'all' | 'physical' | 'digital'>(
    'all'
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCampaignIndex, setActiveCampaignIndex] = useState(0);
  const [copiedCampaignId, setCopiedCampaignId] = useState<string | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Quick-view product modal
  const [selectedProduct, setSelectedProduct] = useState<DirectProduct | null>(
    null
  );
  const [detailQty, setDetailQty] = useState(1);
  const [busyCancelId, setBusyCancelId] = useState<string | null>(null);

  // Inline two-step confirm state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Creator Seller Account & Payout Setup Form
  const [sellerStoreName, setSellerStoreName] = useState('');
  const [sellerBio, setSellerBio] = useState('');
  const [sellerPayoutMethod, setSellerPayoutMethod] =
    useState<SellerPayoutMethod>('Stripe');
  const [sellerPayoutAccount, setSellerPayoutAccount] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  // Creator Product Add / Edit Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | undefined>(
    undefined
  );
  const [prodTitle, setProdTitle] = useState('');
  const [prodSubtitle, setProdSubtitle] = useState('');
  const [prodKind, setProdKind] = useState<DirectProductKind>('physical');
  const [prodCategory, setProdCategory] = useState('Creator Editions');
  const [prodSku, setProdSku] = useState('PK-CR-01');
  const [prodPriceUsd, setProdPriceUsd] = useState('68.00');
  const [prodCompareUsd, setProdCompareUsd] = useState('');
  const [prodStock, setProdStock] = useState('25');
  const [prodBadge, setProdBadge] = useState('Creator Edition');
  const [prodImageKey, setProdImageKey] = useState('edition');
  const [prodDeliveryNote, setProdDeliveryNote] = useState(
    'Ships in 48 hours with courier tracking'
  );
  const [prodSummary, setProdSummary] = useState('');
  const [prodHighlightsText, setProdHighlightsText] = useState('');
  const [prodFeatured, setProdFeatured] = useState(false);
  const [prodStatus, setProdStatus] = useState<PublishStatus>('published');
  const [savingProduct, setSavingProduct] = useState(false);

  // Promo Campaign Add / Edit Modal (for Website Owner directly on Store page)
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<
    string | undefined
  >(undefined);
  const [campTitle, setCampTitle] = useState('');
  const [campDescription, setCampDescription] = useState('');
  const [campPromoCode, setCampPromoCode] = useState('PICKRA15');
  const [campDiscountPercent, setCampDiscountPercent] = useState('15');
  const [campMinOrderUsd, setCampMinOrderUsd] = useState('0');
  const [campChannel, setCampChannel] =
    useState<CampaignChannel>('Storefront Banner');
  const [campFeaturedProductId, setCampFeaturedProductId] = useState('');
  const [campCtaLabel, setCampCtaLabel] = useState('Apply 15% Code');
  const [campExpiresLabel, setCampExpiresLabel] = useState(
    'Limited release offer'
  );
  const [campStatus, setCampStatus] = useState<PublishStatus>('published');
  const [savingCampaign, setSavingCampaign] = useState(false);

  // Seller stock & fulfillment drafts
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [sellerOrderDrafts, setSellerOrderDrafts] = useState<
    Record<
      string,
      { status: OrderFulfillmentStatus; note: string; payoutDetails: string }
    >
  >({});
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  useEffect(() => {
    setSubView(initialSubView);
  }, [initialSubView]);

  useEffect(() => {
    if (profile) {
      setSellerStoreName(
        profile.storeName || profile.displayName || user?.displayName || ''
      );
      setSellerBio(profile.bio || '');
    } else if (user) {
      setSellerStoreName(user.displayName || '');
    }
    if (privateInfo) {
      if (privateInfo.payoutMethod && privateInfo.payoutMethod !== 'None') {
        setSellerPayoutMethod(privateInfo.payoutMethod);
      }
      setSellerPayoutAccount(privateInfo.payoutAccount || '');
    }
  }, [profile, privateInfo, user]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of publishedDirectProducts) {
      if (p.category) set.add(p.category);
    }
    return ['All', ...Array.from(set)];
  }, [publishedDirectProducts]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return publishedDirectProducts.filter((prod) => {
      if (kindFilter !== 'all' && prod.kind !== kindFilter) return false;
      if (categoryFilter !== 'All' && prod.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        prod.title.toLowerCase().includes(q) ||
        prod.subtitle.toLowerCase().includes(q) ||
        prod.summary.toLowerCase().includes(q) ||
        prod.category.toLowerCase().includes(q) ||
        prod.sku.toLowerCase().includes(q) ||
        (prod.sellerName || '').toLowerCase().includes(q)
      );
    });
  }, [publishedDirectProducts, kindFilter, categoryFilter, searchQuery]);

  const spotlightCampaign =
    publishedCampaigns[activeCampaignIndex] || publishedCampaigns[0] || null;

  // Creator Earnings & Payout Ledger Metrics
  const sellerEarnings = useMemo(() => {
    let grossCents = 0;
    let netEarningsCents = 0;
    let pendingPayoutCents = 0;
    let paidOutCents = 0;

    for (const ord of mySellerOrders) {
      if (ord.status === 'cancelled') continue;
      grossCents += ord.totalCents;
      const net =
        typeof ord.sellerPayoutCents === 'number'
          ? ord.sellerPayoutCents
          : Math.round(ord.totalCents * 0.9);
      netEarningsCents += net;
      if (ord.payoutStatus === 'paid_out') {
        paidOutCents += net;
      } else if (ord.payoutStatus === 'pending') {
        pendingPayoutCents += net;
      }
    }

    return {
      grossCents,
      netEarningsCents,
      pendingPayoutCents,
      paidOutCents,
    };
  }, [mySellerOrders]);

  function canManageProduct(product: DirectProduct): boolean {
    if (isCreatorAdmin) return true;
    if (!user) return false;
    return product.sellerId === user.uid;
  }

  function openNewProductModal() {
    if (!user) {
      setSubView('sell');
      return;
    }
    setEditingProductId(undefined);
    setProdTitle('');
    setProdSubtitle('');
    setProdKind('physical');
    setProdCategory('Creator Editions');
    setProdSku(`PK-${Math.floor(100 + Math.random() * 900)}`);
    setProdPriceUsd('68.00');
    setProdCompareUsd('');
    setProdStock('25');
    setProdBadge(
      profile?.storeName ? `By ${profile.storeName}` : 'Creator Edition'
    );
    setProdImageKey('edition');
    setProdDeliveryNote('Ships in 48 hours with courier tracking');
    setProdSummary('');
    setProdHighlightsText('');
    setProdFeatured(false);
    setProdStatus('published');
    setIsProductModalOpen(true);
  }

  function openEditProductModal(prod: DirectProduct) {
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
    setProdDeliveryNote(prod.deliveryNote);
    setProdSummary(prod.summary);
    setProdHighlightsText(prod.highlights.join('\n'));
    setProdFeatured(prod.featured);
    setProdStatus(prod.status);
    setIsProductModalOpen(true);
  }

  async function handleSaveProductSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingProduct(true);
    setFeedback(null);
    try {
      const parsedPrice = Number.parseFloat(prodPriceUsd);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 1) {
        throw new Error('Product price must be at least $1.00 USD.');
      }
      const priceCents = Math.round(parsedPrice * 100);
      const parsedCompare = prodCompareUsd.trim()
        ? Number.parseFloat(prodCompareUsd)
        : 0;
      const compareAtCents =
        Number.isFinite(parsedCompare) && parsedCompare > 0
          ? Math.round(parsedCompare * 100)
          : 0;
      const stockCount = Math.max(
        0,
        Number.parseInt(prodStock || '0', 10) || 0
      );
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
        imageKey: prodImageKey || 'edition',
        summary: prodSummary,
        highlights,
        deliveryNote: prodDeliveryNote,
        featured: prodFeatured,
        status: prodStatus,
      };

      await saveDirectProduct(input);
      setIsProductModalOpen(false);
      setFeedback({
        tone: 'ok',
        text: editingProductId
          ? 'Store product updated.'
          : 'Product published to the Pickra Store.',
      });
    } catch (err) {
      setFeedback({
        tone: 'err',
        text:
          err instanceof Error ? err.message : 'Unable to save store product.',
      });
    } finally {
      setSavingProduct(false);
    }
  }

  function openNewCampaignModal() {
    setEditingCampaignId(undefined);
    setCampTitle('');
    setCampDescription('');
    setCampPromoCode('PICKRA15');
    setCampDiscountPercent('15');
    setCampMinOrderUsd('0');
    setCampChannel('Storefront Banner');
    setCampFeaturedProductId('');
    setCampCtaLabel('Apply 15% Code');
    setCampExpiresLabel('Limited release offer');
    setCampStatus('published');
    setIsCampaignModalOpen(true);
  }

  function openEditCampaignModal(camp: MarketingCampaign) {
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
    setIsCampaignModalOpen(true);
  }

  async function handleSaveCampaignSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingCampaign(true);
    setFeedback(null);
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

      const payload: CampaignDraftInput = {
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
      await saveCampaign(payload);
      setIsCampaignModalOpen(false);
      setFeedback({
        tone: 'ok',
        text: editingCampaignId
          ? 'Promotional campaign updated.'
          : 'Promotional campaign launched on Store.',
      });
    } catch (err) {
      setFeedback({
        tone: 'err',
        text: err instanceof Error ? err.message : 'Unable to save campaign.',
      });
    } finally {
      setSavingCampaign(false);
    }
  }

  async function handleSaveSellerAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingAccount(true);
    setFeedback(null);
    try {
      await registerOrUpdateSellerAccount({
        storeName: sellerStoreName,
        bio: sellerBio,
        payoutMethod: sellerPayoutMethod,
        payoutAccount: sellerPayoutAccount,
      });
      setFeedback({
        tone: 'ok',
        text: 'Creator Seller Account and payout destination saved. You are ready to publish products and receive 90% net payouts on every sale.',
      });
    } catch (err) {
      setFeedback({
        tone: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Unable to save creator seller account.',
      });
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleSellerOrderUpdate(orderId: string) {
    const target = mySellerOrders.find((o) => o.id === orderId);
    if (!target) return;
    const draft = sellerOrderDrafts[orderId] || {
      status: target.status,
      note: target.fulfillmentNote,
      payoutDetails: target.sellerPayoutDetails || '',
    };
    setBusyOrderId(orderId);
    setFeedback(null);
    try {
      await updateDirectOrderFulfillment(orderId, draft.status, draft.note);
      if (
        draft.payoutDetails.trim() &&
        draft.payoutDetails.trim() !== (target.sellerPayoutDetails || '')
      ) {
        await updateOrderPayoutDetails(orderId, draft.payoutDetails.trim());
      }
      setFeedback({
        tone: 'ok',
        text: `Order ${target.orderNumber} fulfillment updated.`,
      });
    } catch (err) {
      setFeedback({
        tone: 'err',
        text:
          err instanceof Error ? err.message : 'Unable to update seller order.',
      });
    } finally {
      setBusyOrderId(null);
    }
  }

  function handleActivateCampaign(
    promoCode: string,
    featuredProductId: string
  ) {
    const res = applyPromoCode(promoCode);
    setBannerNotice(res.message);
    if (featuredProductId) {
      const target = publishedDirectProducts.find(
        (p) => p.id === featuredProductId
      );
      if (target) {
        recordProductView(target);
        setSelectedProduct(target);
        setDetailQty(1);
      }
    }
  }

  async function handleCopyShareLink(campaignId: string, promoCode: string) {
    const url = `${window.location.origin}${window.location.pathname}?section=store&promo=${encodeURIComponent(
      promoCode
    )}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCampaignId(campaignId);
      window.setTimeout(() => setCopiedCampaignId(null), 1800);
    } catch {
      setBannerNotice(`Shareable promo code: ${promoCode}`);
    }
  }

  async function handleCancelOrder(orderId: string) {
    setBusyCancelId(orderId);
    try {
      await cancelBuyerOrder(orderId);
    } finally {
      setBusyCancelId(null);
    }
  }

  return (
    <section className="max-w-[1200px] mx-auto px-5 sm:px-8 py-10 sm:py-14">
      {/* Storefront Masthead & Creator Marketplace Sub-Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-stone-200">
        <div className="max-w-3xl">
          <div className="text-xs text-stone-500">
            Pickra Store · Multi-Creator Marketplace · Physical &amp; Digital
            Products
          </div>
          <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-medium text-stone-900">
            Creators&apos; Store — Physical Editions &amp; Instant Digital Kits
          </h1>
          <p className="mt-3 text-base text-stone-600 leading-relaxed">
            Shop physical goods and instant digital downloads sold directly on
            Pickra—or open your own Creator Seller Account to publish products
            and get paid whenever your work sells.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#F3EFE8] rounded-lg">
            <button
              type="button"
              onClick={() => setSubView('catalog')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                subView === 'catalog'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Store Catalog ({publishedDirectProducts.length})
            </button>
            <button
              type="button"
              onClick={() => setSubView('sell')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                subView === 'sell'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Sell on Pickra
              {user ? ` (${mySellerProducts.length})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setSubView('purchases')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                subView === 'purchases'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              My Purchases ({myPurchases.length})
            </button>
          </div>

          <button
            type="button"
            onClick={openNewProductModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>
              Bag ({cartCount})
              {cartCount > 0 ? ` · ${formatPriceCents(cartTotalCents)}` : ''}
            </span>
          </button>
        </div>
      </div>

      {!siteConfig.storeCheckoutEnabled && (
        <div className="mt-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
          Direct Store checkout is temporarily paused for inventory maintenance.
          You can still browse specifications and save items to your bag.
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className={`mt-6 px-4 py-3 rounded-xl border text-xs flex items-center justify-between gap-4 ${
            feedback.tone === 'ok'
              ? 'bg-stone-100 border-stone-300 text-stone-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="font-medium underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =================================================================
          SUB-VIEW 1: PUBLIC STORE CATALOG (WITH INLINE ADD / EDIT / DELETE)
         ================================================================= */}
      {subView === 'catalog' && (
        <>
          {/* Marketing Campaign Spotlight */}
          {spotlightCampaign ? (
            <div className="mt-8 bg-[#F5F2EB] border border-stone-200/90 rounded-2xl p-6 sm:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                    <span className="font-semibold text-[#9A3412]">
                      {spotlightCampaign.channel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-semibold text-stone-900">
                      Code: {spotlightCampaign.promoCode}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{spotlightCampaign.discountPercent}% Off</span>
                    <span aria-hidden="true">·</span>
                    <span>{spotlightCampaign.expiresLabel}</span>
                  </div>

                  <h2 className="mt-2 font-serif text-xl sm:text-2xl font-medium text-stone-900 leading-snug">
                    {spotlightCampaign.title}
                  </h2>

                  <p className="mt-2 text-sm text-stone-600 leading-relaxed">
                    {spotlightCampaign.description}
                  </p>

                  {bannerNotice && (
                    <p className="mt-3 text-xs font-medium text-emerald-800">
                      {bannerNotice}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      handleActivateCampaign(
                        spotlightCampaign.promoCode,
                        spotlightCampaign.featuredProductId
                      )
                    }
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>
                      {appliedCampaign?.promoCode ===
                      spotlightCampaign.promoCode
                        ? `${spotlightCampaign.promoCode} Applied`
                        : spotlightCampaign.ctaLabel}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void handleCopyShareLink(
                        spotlightCampaign.id,
                        spotlightCampaign.promoCode
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-stone-800 bg-white border border-stone-300 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedCampaignId === spotlightCampaign.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Promo Link</span>
                      </>
                    )}
                  </button>

                  {isCreatorAdmin && (
                    <div className="inline-flex items-center gap-2 pl-2 border-l border-stone-300 text-xs">
                      <button
                        type="button"
                        onClick={openNewCampaignModal}
                        className="font-medium text-stone-700 hover:text-stone-900 cursor-pointer whitespace-nowrap"
                      >
                        + Add Promo
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openEditCampaignModal(spotlightCampaign)
                        }
                        className="font-medium text-stone-700 hover:text-[#9A3412] cursor-pointer whitespace-nowrap"
                      >
                        Edit
                      </button>
                      {confirmDeleteId === spotlightCampaign.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              void deleteCampaign(spotlightCampaign.id);
                              setConfirmDeleteId(null);
                              setActiveCampaignIndex(0);
                            }}
                            className="font-semibold text-red-700 hover:underline cursor-pointer whitespace-nowrap"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-stone-500 cursor-pointer whitespace-nowrap"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDeleteId(spotlightCampaign.id)
                          }
                          className="text-stone-500 hover:text-red-700 cursor-pointer whitespace-nowrap"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {publishedCampaigns.length > 1 && (
                <div className="mt-5 pt-4 border-t border-stone-200/80 flex flex-wrap items-center gap-4 text-xs text-stone-500">
                  <span>Active campaigns:</span>
                  {publishedCampaigns.map((camp, idx) => (
                    <button
                      key={camp.id}
                      type="button"
                      onClick={() => {
                        setActiveCampaignIndex(idx);
                        setBannerNotice(null);
                      }}
                      className={`font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        idx === activeCampaignIndex
                          ? 'text-[#9A3412] underline underline-offset-4'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {camp.promoCode} ({camp.discountPercent}% off)
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            isCreatorAdmin && (
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={openNewCampaignModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-800 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#9A3412]" />
                  <span>Add Promotional Campaign</span>
                </button>
              </div>
            )
          )}

          {/* Creator Marketplace Callout Bar */}
          <div className="mt-6 px-5 py-4 bg-white border border-stone-200/90 rounded-xl flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-stone-600">
              <strong className="text-stone-900">
                Are you an independent creator or maker?
              </strong>{' '}
              Create a free Pickra Seller Account, publish physical or digital
              products, and earn 90% net payouts on every sale.
            </div>
            <button
              type="button"
              onClick={() => setSubView('sell')}
              className="text-xs font-semibold text-[#9A3412] hover:text-stone-900 underline underline-offset-4 cursor-pointer whitespace-nowrap shrink-0"
            >
              {profile?.isSeller
                ? 'Open Your Seller Dashboard & Payouts →'
                : 'Start Selling on Pickra →'}
            </button>
          </div>

          {/* Filter & Search Bar */}
          <div className="mt-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-stone-200">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-1 p-1 bg-[#F3EFE8] rounded-lg">
                {(
                  [
                    ['all', 'All Store Goods'],
                    ['physical', 'Physical Products'],
                    ['digital', 'Digital Downloads'],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setKindFilter(val)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      kindFilter === val
                        ? 'bg-white text-stone-900 shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <select
                aria-label="Filter direct store by department"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 text-xs font-medium bg-white border border-stone-200 rounded-lg text-stone-700 focus:outline-none focus:border-[#9A3412]"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'All' ? 'All Collections' : cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, creators, SKUs..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-[#9A3412]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear store search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Direct Product Grid */}
          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-stone-600">
                No store products match your filter criteria.
              </p>
              <button
                type="button"
                onClick={() => {
                  setKindFilter('all');
                  setCategoryFilter('All');
                  setSearchQuery('');
                }}
                className="mt-4 px-4 py-2 text-xs font-semibold text-stone-800 bg-[#F3EFE8] rounded-lg cursor-pointer"
              >
                Reset Store Filters
              </button>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => {
                const editable = canManageProduct(product);
                return (
                  <DirectProductCard
                    key={product.id}
                    product={product}
                    onInspectProduct={(p) => {
                      recordProductView(p);
                      setSelectedProduct(p);
                      setDetailQty(1);
                    }}
                    onEdit={editable ? openEditProductModal : undefined}
                    onDelete={
                      editable
                        ? (targetProd) => {
                            void deleteDirectProduct(targetProd.id);
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* =================================================================
          SUB-VIEW 2: SELL ON PICKRA — CREATOR MARKETPLACE & PAYOUTS
         ================================================================= */}
      {subView === 'sell' && (
        <div className="mt-8 space-y-8">
          {!user ? (
            <div className="bg-white border border-stone-200/90 rounded-2xl p-8 sm:p-10 space-y-6">
              <div className="max-w-2xl">
                <div className="text-xs font-medium text-[#9A3412]">
                  Creator Commerce Program · Physical &amp; Digital Products
                </div>
                <h2 className="mt-2 font-serif text-2xl sm:text-3xl font-medium text-stone-900">
                  Create your Pickra Seller Account, publish products, and get
                  paid on every sale
                </h2>
                <p className="mt-3 text-sm text-stone-600 leading-relaxed">
                  Independent creators, designers, and hardware makers can open
                  a storefront on Pickra in under a minute. Upload photos of
                  your physical goods or digital downloads, set your pricing,
                  and receive automatic 90% net payouts to your preferred
                  payment account when customers buy your work.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-stone-200/80">
                <div>
                  <h3 className="text-sm font-semibold text-stone-900">
                    01. Create Account &amp; Payout Profile
                  </h3>
                  <p className="mt-1.5 text-xs text-stone-600 leading-relaxed">
                    Sign in with Google, set your creator store name, and add
                    your Stripe, PayPal, Wise, or bank payout destination.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-stone-900">
                    02. Publish Physical or Digital Goods
                  </h3>
                  <p className="mt-1.5 text-xs text-stone-600 leading-relaxed">
                    Upload product photography, configure stock or instant
                    digital download delivery notes, and edit or remove items
                    anytime.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-stone-900">
                    03. Earn 90% Net Creator Payouts
                  </h3>
                  <p className="mt-1.5 text-xs text-stone-600 leading-relaxed">
                    Every sale records your 90% net payout in your live ledger
                    (10% Pickra marketplace fee) with transparent settlement
                    tracking.
                  </p>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="inline-flex items-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Create Creator Account / Sign In with Google</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Creator Earnings & Payout Summary Strip */}
              <div className="bg-white border border-stone-200/90 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-200/80">
                <div className="p-5">
                  <div className="text-xs text-stone-500">
                    Gross Creator Sales
                  </div>
                  <div className="mt-1.5 font-mono text-2xl font-semibold text-stone-900 tabular-nums">
                    {formatPriceCents(sellerEarnings.grossCents)}
                  </div>
                  <div className="mt-1 text-[11px] text-stone-500 font-mono tabular-nums">
                    {
                      mySellerOrders.filter((o) => o.status !== 'cancelled')
                        .length
                    }{' '}
                    completed sales
                  </div>
                </div>

                <div className="p-5">
                  <div className="text-xs text-stone-500">
                    Net Creator Earnings (90%)
                  </div>
                  <div className="mt-1.5 font-mono text-2xl font-semibold text-stone-900 tabular-nums">
                    {formatPriceCents(sellerEarnings.netEarningsCents)}
                  </div>
                  <div className="mt-1 text-[11px] text-stone-500">
                    After 10% platform fee
                  </div>
                </div>

                <div className="p-5">
                  <div className="text-xs text-stone-500">Pending Payout</div>
                  <div className="mt-1.5 font-mono text-2xl font-semibold text-[#9A3412] tabular-nums">
                    {formatPriceCents(sellerEarnings.pendingPayoutCents)}
                  </div>
                  <div className="mt-1 text-[11px] text-stone-500">
                    Scheduled to {privateInfo?.payoutMethod || 'payout account'}
                  </div>
                </div>

                <div className="p-5">
                  <div className="text-xs text-stone-500">Paid Out</div>
                  <div className="mt-1.5 font-mono text-2xl font-semibold text-emerald-800 tabular-nums">
                    {formatPriceCents(sellerEarnings.paidOutCents)}
                  </div>
                  <div className="mt-1 text-[11px] text-stone-500">
                    Settled creator disbursements
                  </div>
                </div>
              </div>

              {/* 12-Col Split: Seller Account & Payout Setup (5) + Creator Products List (7) */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                <form
                  onSubmit={(e) => void handleSaveSellerAccountSubmit(e)}
                  className="xl:col-span-5 bg-white border border-stone-200/90 rounded-xl p-6 space-y-4"
                >
                  <div className="pb-3.5 border-b border-stone-200/80 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-medium text-[#9A3412]">
                        {profile?.isSeller
                          ? 'Verified Seller Account Active'
                          : 'Step 1 · Seller Onboarding'}
                      </div>
                      <h2 className="mt-0.5 font-serif text-lg font-medium text-stone-900">
                        Creator Store &amp; Payout Settings
                      </h2>
                    </div>
                    <Store className="w-4 h-4 text-[#9A3412] shrink-0" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Creator / Storefront Name
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={80}
                      value={sellerStoreName}
                      onChange={(e) => setSellerStoreName(e.target.value)}
                      placeholder="e.g., Atelier Kibo Studio"
                      className="w-full px-3 py-2 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Creator Bio (Optional)
                    </label>
                    <textarea
                      rows={2}
                      maxLength={300}
                      value={sellerBio}
                      onChange={(e) => setSellerBio(e.target.value)}
                      placeholder="Independent industrial designer & digital systems maker..."
                      className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Payout Method
                      </label>
                      <select
                        value={sellerPayoutMethod}
                        onChange={(e) =>
                          setSellerPayoutMethod(
                            e.target.value as SellerPayoutMethod
                          )
                        }
                        className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                      >
                        {PAYOUT_METHODS.map((pm) => (
                          <option key={pm.value} value={pm.value}>
                            {pm.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Payout Account / Email / IBAN
                      </label>
                      <input
                        type="text"
                        required
                        minLength={3}
                        maxLength={160}
                        value={sellerPayoutAccount}
                        onChange={(e) => setSellerPayoutAccount(e.target.value)}
                        placeholder="payouts@yourstudio.com or acct_..."
                        className="w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    Your payout destination is stored privately in your isolated
                    account vault and attached solely to incoming orders so
                    payouts can be settled accurately when your products sell.
                  </p>

                  <button
                    type="submit"
                    disabled={savingAccount}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] disabled:bg-stone-300 rounded-lg transition-colors cursor-pointer"
                  >
                    {savingAccount
                      ? 'Saving Creator Account...'
                      : profile?.isSeller
                      ? 'Update Seller & Payout Profile'
                      : 'Activate Creator Seller Account'}
                  </button>
                </form>

                {/* Creator Published Products Management */}
                <div className="xl:col-span-7 bg-white border border-stone-200/90 rounded-xl overflow-hidden">
                  <div className="p-6 border-b border-stone-200/80 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="font-serif text-lg font-medium text-stone-900">
                        Your Published Store Products ({mySellerProducts.length}
                        )
                      </h2>
                      <p className="text-xs text-stone-500">
                        Add, edit, adjust stock, or remove your physical and
                        digital products at any time.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={openNewProductModal}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Publish New Product</span>
                    </button>
                  </div>

                  {mySellerProducts.length === 0 ? (
                    <div className="py-12 px-6 text-center space-y-3">
                      <p className="text-sm text-stone-600">
                        You haven&apos;t published any products under your
                        creator account yet.
                      </p>
                      <button
                        type="button"
                        onClick={openNewProductModal}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Publish Your First Product</span>
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-stone-200/80 px-6">
                      {mySellerProducts.map((prod) => {
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
                                <span className="capitalize">{prod.kind}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono font-semibold text-stone-900 tabular-nums">
                                  {formatPriceCents(prod.priceCents)}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="capitalize text-[#9A3412]">
                                  {prod.status}
                                </span>
                              </div>
                              <h3 className="mt-1 text-sm font-semibold text-stone-900">
                                {prod.title}
                              </h3>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
                              <div className="inline-flex items-center gap-1">
                                <label
                                  htmlFor={`seller-stock-${prod.id}`}
                                  className="text-[11px] text-stone-500"
                                >
                                  Stock:
                                </label>
                                <input
                                  id={`seller-stock-${prod.id}`}
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
                                <option value="published">published</option>
                                <option value="draft">draft</option>
                                <option value="archived">archived</option>
                              </select>

                              <button
                                type="button"
                                onClick={() => openEditProductModal(prod)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 font-medium text-stone-800 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg cursor-pointer whitespace-nowrap"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>

                              {confirmDeleteId === prod.id ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void deleteDirectProduct(prod.id);
                                      setConfirmDeleteId(null);
                                    }}
                                    className="font-semibold text-red-700 hover:underline cursor-pointer"
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
                  )}
                </div>
              </div>

              {/* Creator Sales, Fulfillment & Payout Ledger */}
              <div className="bg-white border border-stone-200/90 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-stone-200/80 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-lg font-medium text-stone-900">
                      Creator Sales, Fulfillment &amp; Payout Ledger (
                      {mySellerOrders.length})
                    </h2>
                    <p className="text-xs text-stone-500">
                      Track incoming customer orders for your products, dispatch
                      fulfillment updates, and monitor your 90% net creator
                      payouts.
                    </p>
                  </div>
                  <DollarSign className="w-4 h-4 text-[#9A3412] shrink-0" />
                </div>

                {mySellerOrders.length === 0 ? (
                  <div className="py-12 px-6 text-center text-xs text-stone-500">
                    When customers buy any of your published products, the order
                    and your net payout balance appear here automatically.
                  </div>
                ) : (
                  <div className="divide-y divide-stone-200/80 px-6">
                    {mySellerOrders.map((order) => {
                      const netPayout =
                        typeof order.sellerPayoutCents === 'number'
                          ? order.sellerPayoutCents
                          : Math.round(order.totalCents * 0.9);
                      const fee =
                        typeof order.platformFeeCents === 'number'
                          ? order.platformFeeCents
                          : order.totalCents - netPayout;
                      const draft = sellerOrderDrafts[order.id] || {
                        status: order.status,
                        note: order.fulfillmentNote,
                        payoutDetails: order.sellerPayoutDetails || '',
                      };

                      return (
                        <div
                          key={order.id}
                          className="py-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
                        >
                          <div className="lg:col-span-7 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                              <span className="font-mono font-semibold text-stone-900">
                                {order.orderNumber}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="capitalize font-medium text-[#9A3412]">
                                Order: {order.status}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                Gross {formatPriceCents(order.totalCents)}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono font-semibold text-stone-900 tabular-nums">
                                Your Payout: {formatPriceCents(netPayout)}
                              </span>
                              <span className="text-stone-400 font-mono tabular-nums">
                                (Fee {formatPriceCents(fee)})
                              </span>
                            </div>

                            <h3 className="text-sm font-semibold text-stone-900">
                              {order.itemsSummary}
                            </h3>

                            <div className="text-xs text-stone-600">
                              Customer: <strong>{order.buyerName}</strong> (
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

                            <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
                              <span className="text-stone-500">
                                Payout Settlement:
                              </span>
                              {order.payoutStatus === 'paid_out' ? (
                                <span className="font-semibold text-emerald-800">
                                  Paid Out
                                  {order.payoutNote
                                    ? ` · Ref: ${order.payoutNote}`
                                    : ''}
                                </span>
                              ) : order.payoutStatus === 'not_applicable' ? (
                                <span className="text-stone-700 font-medium">
                                  Owner Direct Sale (100% Retained)
                                </span>
                              ) : (
                                <span className="font-semibold text-[#9A3412]">
                                  Pending Payout
                                  {order.sellerPayoutDetails
                                    ? ` → ${order.sellerPayoutDetails}`
                                    : ''}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="lg:col-span-5 space-y-2.5">
                            <div className="flex items-center gap-2">
                              <select
                                aria-label="Order fulfillment status"
                                value={draft.status}
                                onChange={(e) =>
                                  setSellerOrderDrafts((prev) => ({
                                    ...prev,
                                    [order.id]: {
                                      ...draft,
                                      status: e.target
                                        .value as OrderFulfillmentStatus,
                                    },
                                  }))
                                }
                                className="flex-1 px-3 py-2 text-xs font-medium bg-[#FBF9F5] border border-stone-300 rounded-lg capitalize"
                              >
                                {ORDER_STATUSES.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                disabled={busyOrderId === order.id}
                                onClick={() =>
                                  void handleSellerOrderUpdate(order.id)
                                }
                                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                              >
                                {busyOrderId === order.id
                                  ? 'Saving...'
                                  : 'Save Update'}
                              </button>
                            </div>

                            <input
                              type="text"
                              maxLength={300}
                              value={draft.note}
                              onChange={(e) =>
                                setSellerOrderDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    ...draft,
                                    note: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Courier tracking URL or digital download instructions..."
                              className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                            />

                            {order.payoutStatus === 'pending' && (
                              <input
                                type="text"
                                maxLength={240}
                                value={draft.payoutDetails}
                                onChange={(e) =>
                                  setSellerOrderDrafts((prev) => ({
                                    ...prev,
                                    [order.id]: {
                                      ...draft,
                                      payoutDetails: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="Payout destination (e.g., PayPal: you@domain.com)"
                                className="w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* =================================================================
          SUB-VIEW 3: CUSTOMER PURCHASES & DIGITAL DOWNLOADS
         ================================================================= */}
      {subView === 'purchases' && (
        <div className="mt-8">
          {!user ? (
            <div className="p-8 bg-white border border-stone-200 rounded-2xl max-w-xl">
              <Package className="w-6 h-6 text-[#9A3412]" />
              <h2 className="mt-3 font-serif text-2xl font-medium text-stone-900">
                Sign in to view your Pickra orders
              </h2>
              <p className="mt-2 text-sm text-stone-600 leading-relaxed">
                Access order receipts, live courier dispatch updates, and
                instant digital downloads tied to your verified account.
              </p>
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In with Google</span>
              </button>
            </div>
          ) : myPurchases.length === 0 ? (
            <div className="p-10 bg-white border border-stone-200 rounded-2xl text-center">
              <Package className="w-7 h-7 text-stone-300 mx-auto" />
              <h2 className="mt-3 font-serif text-xl font-medium text-stone-900">
                No direct purchases yet
              </h2>
              <p className="mt-1.5 text-sm text-stone-600">
                Orders placed through the Pickra Store appear here immediately.
              </p>
              <button
                type="button"
                onClick={() => setSubView('catalog')}
                className="mt-5 px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg cursor-pointer"
              >
                Browse Store Catalog
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myPurchases.map((order) => (
                <div
                  key={order.id}
                  className="p-6 bg-white border border-stone-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                      <span className="font-mono font-semibold text-stone-900">
                        {order.orderNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize font-medium text-[#9A3412]">
                        Status: {order.status}
                      </span>
                      {order.sellerName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Seller: {order.sellerName}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>
                        {new Date(order.createdAtMs).toLocaleDateString(
                          'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          }
                        )}
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

                    <h3 className="text-base font-semibold text-stone-900">
                      {order.itemsSummary}
                    </h3>

                    {order.fulfillmentNote && (
                      <p className="text-xs text-stone-600 leading-relaxed">
                        {order.fulfillmentNote}
                      </p>
                    )}

                    {order.shippingAddress && (
                      <p className="text-xs text-stone-500">
                        Ship to: {order.shippingAddress}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 shrink-0">
                    <div className="text-right">
                      <span className="block text-[11px] text-stone-500">
                        Order Total
                      </span>
                      <span className="font-mono text-base font-semibold text-stone-900 tabular-nums">
                        {formatPriceCents(order.totalCents)}
                      </span>
                    </div>

                    {order.status === 'paid' && (
                      <button
                        type="button"
                        disabled={busyCancelId === order.id}
                        onClick={() => void handleCancelOrder(order.id)}
                        className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-red-700 border border-stone-200 hover:border-red-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {busyCancelId === order.id
                          ? 'Cancelling...'
                          : 'Cancel Order'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================
          MODAL 1: PRODUCT SPECIFICATION QUICK-VIEW
         ================================================================= */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6 bg-stone-950/45 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-label={selectedProduct.title}
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#FBF9F5] border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-stone-200">
              <div className="text-xs text-stone-500">
                By {selectedProduct.sellerName || 'Pickra Studio'} ·{' '}
                {selectedProduct.category} · SKU{' '}
                <span className="font-mono text-stone-800">
                  {selectedProduct.sku}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {canManageProduct(selectedProduct) && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedProduct;
                      setSelectedProduct(null);
                      openEditProductModal(target);
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-stone-700 hover:text-[#9A3412] bg-[#F3EFE8] rounded-md cursor-pointer"
                  >
                    Edit Product
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  aria-label="Close product details"
                  className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-200/60 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              <div className="md:col-span-6 aspect-[4/3] rounded-xl overflow-hidden bg-[#F3EFE8] border border-stone-200/80">
                <ResilientImage
                  imageKey={selectedProduct.imageKey}
                  alt={selectedProduct.title}
                  fallbackLabel={selectedProduct.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="md:col-span-6 space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                  <span className="font-semibold text-[#9A3412]">
                    {selectedProduct.kind === 'digital'
                      ? 'Instant Digital Download'
                      : 'Physical Creator Product'}
                  </span>
                  {selectedProduct.badgeLabel && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-stone-800 font-medium">
                        {selectedProduct.badgeLabel}
                      </span>
                    </>
                  )}
                </div>

                <h2 className="font-serif text-2xl font-medium text-stone-900 leading-snug">
                  {selectedProduct.title}
                </h2>

                <div className="flex items-baseline gap-2.5">
                  <span className="font-mono text-xl font-semibold text-stone-900 tabular-nums">
                    {formatPriceCents(selectedProduct.priceCents)}
                  </span>
                  {selectedProduct.compareAtCents >
                    selectedProduct.priceCents && (
                    <span className="font-mono text-sm text-stone-400 line-through tabular-nums">
                      {formatPriceCents(selectedProduct.compareAtCents)}
                    </span>
                  )}
                </div>

                <p className="text-sm text-stone-600 leading-relaxed">
                  {selectedProduct.summary}
                </p>

                {selectedProduct.highlights.length > 0 && (
                  <ul className="space-y-2 pt-2">
                    {selectedProduct.highlights.map((pt, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-stone-700 leading-relaxed"
                      >
                        <Check className="w-3.5 h-3.5 text-[#9A3412] shrink-0 mt-0.5" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="p-3.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-600">
                  {selectedProduct.deliveryNote}
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <select
                    aria-label="Select quantity"
                    value={detailQty}
                    onChange={(e) => setDetailQty(Number(e.target.value))}
                    className="px-3 py-2.5 text-xs font-mono bg-white border border-stone-300 rounded-lg text-stone-900"
                  >
                    {[1, 2, 3, 4, 5]
                      .filter(
                        (n) => n <= Math.max(1, selectedProduct.stockCount)
                      )
                      .map((n) => (
                        <option key={n} value={n}>
                          Qty {n}
                        </option>
                      ))}
                  </select>

                  <button
                    type="button"
                    disabled={selectedProduct.stockCount <= 0}
                    onClick={() => {
                      addToCart(selectedProduct.id, detailQty, true);
                      setSelectedProduct(null);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] disabled:bg-stone-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>
                      {selectedProduct.stockCount <= 0
                        ? 'Out of Stock'
                        : `Add to Bag · ${formatPriceCents(
                            selectedProduct.priceCents * detailQty
                          )}`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================
          MODAL 2: ADD / EDIT CREATOR PRODUCT COMPOSER
         ================================================================= */}
      {isProductModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-950/50 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-label={
            editingProductId ? 'Edit Store Product' : 'Publish Store Product'
          }
          onClick={() => setIsProductModalOpen(false)}
        >
          <form
            onSubmit={(e) => void handleSaveProductSubmit(e)}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-stone-200">
              <div>
                <div className="text-xs text-[#9A3412] font-medium">
                  Pickra Creator Marketplace
                </div>
                <h2 className="font-serif text-xl font-medium text-stone-900">
                  {editingProductId
                    ? 'Edit Store Product'
                    : 'Publish Physical or Digital Product'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  placeholder="e.g., Solid Brass Desk Pen or Notion OS"
                  className="w-full px-3 py-2 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Short Subtitle
                </label>
                <input
                  type="text"
                  required
                  minLength={4}
                  maxLength={220}
                  value={prodSubtitle}
                  onChange={(e) => setProdSubtitle(e.target.value)}
                  placeholder="One-line product hook..."
                  className="w-full px-3 py-2 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Product Format
                </label>
                <select
                  value={prodKind}
                  onChange={(e) => {
                    const next = e.target.value as DirectProductKind;
                    setProdKind(next);
                    if (next === 'digital') {
                      setProdDeliveryNote(
                        'Instant digital download unlocked immediately after checkout'
                      );
                      setProdStock('999');
                    } else {
                      setProdDeliveryNote(
                        'Ships in 48 hours with courier tracking'
                      );
                    }
                  }}
                  className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                >
                  <option value="physical">Physical Product</option>
                  <option value="digital">Digital Download</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  value={prodCategory}
                  onChange={(e) => setProdCategory(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
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
                  Compare At ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={prodCompareUsd}
                  onChange={(e) => setProdCompareUsd(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-2.5 py-2 text-xs font-mono tabular-nums bg-[#FBF9F5] border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Stock Count
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

            <ImageUploadPicker
              label="Product Photo (Upload from Device, Paste URL, or Studio Preset)"
              value={prodImageKey}
              onChange={setProdImageKey}
              previewAspectClass="aspect-[16/9]"
              compact
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Delivery / Download Promise
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

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Visibility
                </label>
                <select
                  value={prodStatus}
                  onChange={(e) =>
                    setProdStatus(e.target.value as PublishStatus)
                  }
                  className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                >
                  <option value="published">Published on Store</option>
                  <option value="draft">Draft (Hidden)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Product Description &amp; Specifications
              </label>
              <textarea
                rows={3}
                required
                minLength={10}
                maxLength={500}
                value={prodSummary}
                onChange={(e) => setProdSummary(e.target.value)}
                placeholder="Describe materials, dimensions, or included digital files..."
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
                  'Precision machined hardware\nIncludes lifetime updates'
                }
                className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
              />
            </div>

            {isCreatorAdmin && (
              <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prodFeatured}
                  onChange={(e) => setProdFeatured(e.target.checked)}
                  className="accent-[#9A3412]"
                />
                <span>Feature on Blog homepage Store showcase</span>
              </label>
            )}

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProduct}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] disabled:bg-stone-300 rounded-lg transition-colors cursor-pointer"
              >
                {savingProduct
                  ? 'Saving...'
                  : editingProductId
                  ? 'Save Changes'
                  : 'Publish Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================
          MODAL 3: ADD / EDIT PROMO CAMPAIGN (WEBSITE OWNER)
         ================================================================= */}
      {isCampaignModalOpen && isCreatorAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-950/50 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-label="Manage Promo Campaign"
          onClick={() => setIsCampaignModalOpen(false)}
        >
          <form
            onSubmit={(e) => void handleSaveCampaignSubmit(e)}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-stone-200">
              <h2 className="font-serif text-xl font-medium text-stone-900">
                {editingCampaignId
                  ? 'Edit Store Promo Campaign'
                  : 'Add Store Promo Campaign'}
              </h2>
              <button
                type="button"
                onClick={() => setIsCampaignModalOpen(false)}
                className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
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
                className="w-full px-3 py-2 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Description
              </label>
              <textarea
                rows={2}
                required
                minLength={8}
                maxLength={280}
                value={campDescription}
                onChange={(e) => setCampDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
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
                  Discount %
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="90"
                  value={campDiscountPercent}
                  onChange={(e) => setCampDiscountPercent(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-mono bg-[#FBF9F5] border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Min Order $
                </label>
                <input
                  type="number"
                  min="0"
                  value={campMinOrderUsd}
                  onChange={(e) => setCampMinOrderUsd(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-mono bg-[#FBF9F5] border border-stone-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Channel
                </label>
                <select
                  value={campChannel}
                  onChange={(e) =>
                    setCampChannel(e.target.value as CampaignChannel)
                  }
                  className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                >
                  {CAMPAIGN_CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  CTA Button Label
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
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setIsCampaignModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-stone-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingCampaign}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg cursor-pointer"
              >
                {savingCampaign ? 'Saving...' : 'Save Campaign'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
