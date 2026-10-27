import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  LogOut,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Store,
  Tag,
  Trash2,
  Upload,
  UserPlus,
  Video,
  X,
} from 'lucide-react';
import {
  CampaignDraftInput,
  DirectProductDraftInput,
  useFirebaseApp,
} from '../context/FirebaseContext';
import {
  formatPriceCents,
  readCompactVideoFileToDataUrl,
  readDigitalProductFileToDataUrl,
  toSafePromoCode,
  triggerDigitalAssetDownload,
} from '../firebase';
import {
  CampaignChannel,
  DirectProduct,
  DirectProductKind,
  formatPayoutSummary,
  MarketingCampaign,
  OrderFulfillmentStatus,
  parsePayoutAccounts,
  PublishStatus,
  SavedPayoutAccount,
  SELLER_PAYOUT_METHOD_OPTIONS,
  SellerPayoutMethod,
} from '../types';
import { AuthPanel } from './AuthModal';
import { DirectProductCard } from './DirectProductCard';
import { InlineFormattedText, VideoEmbedFigure } from './EditorialRichBlocks';
import { ImageUploadPicker } from './ImageUploadPicker';
import { ResilientImage } from './ResilientImage';

export type StoreSubView = 'catalog' | 'sell' | 'purchases';

interface DirectStorefrontProps {
  initialSubView?: StoreSubView;
}

const DIGITAL_FORMAT_PRESETS = [
  'HTTPS Link',
  'PDF Document',
  'ZIP Archive',
  'Excel / Spreadsheet',
  'eBook (EPUB / MOBI / PDF)',
  'HTML File / Web Tool',
  'Digital Tool / Script',
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
    allAccessibleDirectProductsMap,
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
    openAuthModal,
    signOutUser,
    registerOrUpdateSellerAccount,
    saveUserPaymentMethods,
    saveDirectProduct,
    updateDirectProductStatus,
    deleteDirectProduct,
    saveCampaign,
    deleteCampaign,
    updateDirectOrderFulfillment,
    updateOrderPayoutDetails,
    cancelBuyerOrder,
    removeLocalPurchaseRecord,
    deleteDirectOrder,
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
    useState<SellerPayoutMethod>('Telebirr');
  const [sellerPayoutAccount, setSellerPayoutAccount] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  // Multi-Account Payment Details Manager State (Add / Edit / Set Primary / Remove)
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<SellerPayoutMethod>('Telebirr');
  const [payProviderLabel, setPayProviderLabel] = useState('Telebirr');
  const [payAccountHolder, setPayAccountHolder] = useState('');
  const [payAccountNumber, setPayAccountNumber] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [confirmRemovePaymentId, setConfirmRemovePaymentId] = useState<
    string | null
  >(null);

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
  const [prodVideoUrl, setProdVideoUrl] = useState('');
  const [uploadingProdVideo, setUploadingProdVideo] = useState(false);
  const [prodDigitalFileUrl, setProdDigitalFileUrl] = useState('');
  const [prodDigitalFileName, setProdDigitalFileName] = useState('');
  const [prodDigitalFileType, setProdDigitalFileType] = useState('');
  const [uploadingDigitalFile, setUploadingDigitalFile] = useState(false);
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

  const savedPayoutAccounts = useMemo(
    () =>
      parsePayoutAccounts(
        privateInfo?.payoutAccounts,
        privateInfo?.payoutMethod,
        privateInfo?.payoutAccount,
        profile?.storeName || profile?.displayName || user?.displayName || ''
      ),
    [privateInfo, profile, user]
  );

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
      openAuthModal('signup', true);
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
    setProdVideoUrl('');
    setProdDigitalFileUrl('');
    setProdDigitalFileName('');
    setProdDigitalFileType('');
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
    setProdVideoUrl(prod.videoUrl || '');
    setProdDigitalFileUrl(prod.digitalFileUrl || '');
    setProdDigitalFileName(prod.digitalFileName || '');
    setProdDigitalFileType(prod.digitalFileType || '');
    setProdDeliveryNote(prod.deliveryNote);
    setProdSummary(prod.summary);
    setProdHighlightsText(prod.highlights.join('\n'));
    setProdFeatured(prod.featured);
    setProdStatus(prod.status);
    setIsProductModalOpen(true);
  }

  async function handleProdVideoFileUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProdVideo(true);
    setFeedback(null);
    try {
      const dataUrl = await readCompactVideoFileToDataUrl(file);
      setProdVideoUrl(dataUrl);
    } catch (err) {
      setFeedback({
        tone: 'err',
        text: err instanceof Error ? err.message : 'Unable to upload video.',
      });
    } finally {
      setUploadingProdVideo(false);
      e.target.value = '';
    }
  }

  async function handleDigitalAssetFileUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDigitalFile(true);
    setFeedback(null);
    try {
      const uploaded = await readDigitalProductFileToDataUrl(file);
      setProdDigitalFileUrl(uploaded.dataUrl);
      setProdDigitalFileName(uploaded.fileName);
      setProdDigitalFileType(uploaded.fileTypeLabel);
    } catch (err) {
      setFeedback({
        tone: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Unable to attach digital product file.',
      });
    } finally {
      setUploadingDigitalFile(false);
      e.target.value = '';
    }
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
        videoUrl: prodVideoUrl.trim(),
        digitalFileUrl: prodKind === 'digital' ? prodDigitalFileUrl.trim() : '',
        digitalFileName:
          prodKind === 'digital' ? prodDigitalFileName.trim() : '',
        digitalFileType:
          prodKind === 'digital'
            ? prodDigitalFileType.trim() ||
              (prodDigitalFileUrl.startsWith('https://') ? 'HTTPS Link' : '')
            : '',
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
      const primary = savedPayoutAccounts[0];
      await registerOrUpdateSellerAccount({
        storeName: sellerStoreName,
        bio: sellerBio,
        payoutMethod: primary?.method || sellerPayoutMethod,
        payoutAccount: primary
          ? formatPayoutSummary(primary)
          : sellerPayoutAccount,
      });
      setFeedback({
        tone: 'ok',
        text: 'Creator storefront profile saved. You can publish physical & digital products and manage your payment accounts below.',
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

  function openAddPaymentForm() {
    setEditingPaymentId(null);
    setPayMethod('Telebirr');
    setPayProviderLabel('Telebirr');
    setPayAccountHolder(
      profile?.storeName || profile?.displayName || user?.displayName || ''
    );
    setPayAccountNumber('');
    setIsPaymentFormOpen(true);
  }

  function openEditPaymentForm(acc: SavedPayoutAccount) {
    setEditingPaymentId(acc.id);
    setPayMethod(acc.method);
    setPayProviderLabel(acc.providerLabel);
    setPayAccountHolder(acc.accountHolder);
    setPayAccountNumber(acc.accountNumber);
    setIsPaymentFormOpen(true);
  }

  async function handleSavePaymentMethodSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payAccountNumber.trim()) return;
    setSavingPayment(true);
    setFeedback(null);
    try {
      const defaultOpt = SELLER_PAYOUT_METHOD_OPTIONS.find(
        (m) => m.value === payMethod
      );
      const entry: SavedPayoutAccount = {
        id:
          editingPaymentId ||
          `pm_${Date.now().toString(36)}_${Math.random()
            .toString(36)
            .slice(2, 6)}`,
        method: payMethod,
        providerLabel:
          payProviderLabel.trim() || defaultOpt?.label || payMethod,
        accountHolder:
          payAccountHolder.trim() ||
          profile?.storeName ||
          profile?.displayName ||
          'Account Holder',
        accountNumber: payAccountNumber.trim(),
      };

      const nextList = editingPaymentId
        ? savedPayoutAccounts.map((a) => (a.id === editingPaymentId ? entry : a))
        : [...savedPayoutAccounts, entry].slice(0, 8);

      await saveUserPaymentMethods(nextList, nextList[0]?.id);
      setIsPaymentFormOpen(false);
      setEditingPaymentId(null);
      setFeedback({
        tone: 'ok',
        text: editingPaymentId
          ? 'Payment account updated.'
          : 'Payment account saved to your private payout vault.',
      });
    } catch (err) {
      setFeedback({
        tone: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Unable to save payment details.',
      });
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleSetPrimaryPaymentMethod(accountId: string) {
    setSavingPayment(true);
    setFeedback(null);
    try {
      await saveUserPaymentMethods(savedPayoutAccounts, accountId);
      setFeedback({
        tone: 'ok',
        text: 'Primary payout destination updated.',
      });
    } catch (err) {
      setFeedback({
        tone: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Unable to update primary payment method.',
      });
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleRemovePaymentMethod(accountId: string) {
    setSavingPayment(true);
    setFeedback(null);
    try {
      const nextList = savedPayoutAccounts.filter((a) => a.id !== accountId);
      await saveUserPaymentMethods(nextList, nextList[0]?.id);
      setConfirmRemovePaymentId(null);
      setFeedback({
        tone: 'ok',
        text: 'Payment account removed.',
      });
    } catch (err) {
      setFeedback({
        tone: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Unable to remove payment account.',
      });
    } finally {
      setSavingPayment(false);
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
              My Dashboard &amp; Sell
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

          {!user ? (
            <button
              type="button"
              onClick={() => openAuthModal('signup', true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-900 bg-white border border-stone-300 hover:bg-[#F3EFE8] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5 text-[#9A3412]" />
              <span>Create Account / Sign In</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-700">
              <span className="max-w-[140px] truncate font-medium text-stone-900">
                {profile?.storeName ||
                  profile?.displayName ||
                  user.email?.split('@')[0] ||
                  'Account'}
              </span>
              <span aria-hidden="true" className="text-stone-300">
                ·
              </span>
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="inline-flex items-center gap-1 text-stone-500 hover:text-[#9A3412] cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3 h-3" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7 bg-white border border-stone-200/90 rounded-2xl p-8 sm:p-10 space-y-6">
                <div>
                  <div className="text-xs font-medium text-[#9A3412]">
                    Creator Commerce Program · Physical &amp; Digital Products
                  </div>
                  <h2 className="mt-2 font-serif text-2xl sm:text-3xl font-medium text-stone-900">
                    Create your Pickra Seller Account, publish products, and get
                    paid on every sale
                  </h2>
                  <p className="mt-3 text-sm text-stone-600 leading-relaxed">
                    Independent creators, designers, and hardware makers can
                    open a storefront on Pickra in under a minute. Register with
                    your Email &amp; Password or Google account, upload photos
                    of your physical goods or digital downloads, set your
                    pricing, and receive automatic 90% net payouts when
                    customers buy your work.
                  </p>
                </div>

                <div className="space-y-5 pt-6 border-t border-stone-200/80">
                  <div>
                    <h3 className="text-sm font-semibold text-stone-900">
                      01. Create Account &amp; Payout Profile
                    </h3>
                    <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                      Create an account with Email &amp; Password or Google, set
                      your creator store name, and add your Stripe, PayPal,
                      Wise, or bank payout destination.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-stone-900">
                      02. Publish Physical or Digital Goods
                    </h3>
                    <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                      Upload product photography, configure stock or instant
                      digital download delivery notes, and edit or remove items
                      anytime.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-stone-900">
                      03. Earn 90% Net Creator Payouts
                    </h3>
                    <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                      Every sale records your 90% net payout in your live ledger
                      (10% Pickra marketplace fee) with transparent settlement
                      tracking.
                    </p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5">
                <AuthPanel
                  defaultMode="signup"
                  defaultAsSeller={true}
                  heading="Create Creator Account"
                  subheading="Register your seller account with Email & Password or Google to start publishing products immediately."
                />
              </div>
            </div>
          ) : (
            <>
              <div className="px-5 py-3.5 bg-white border border-stone-200/90 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-stone-600">
                  Signed in as{' '}
                  <strong className="text-stone-900">
                    {profile?.storeName || profile?.displayName || user.email}
                  </strong>
                  {user.email ? (
                    <span className="font-mono text-stone-500">
                      {' '}
                      ({user.email})
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={openNewProductModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Publish New Product</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void signOutUser()}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 cursor-pointer whitespace-nowrap"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>

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

              {/* 12-Col Split: User Profile & Payment Methods (5) + Published Products List (7) */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                <div className="xl:col-span-5 space-y-6">
                  {/* Payment Details & Payout Accounts Manager (Telebirr, Bank, CBE Birr, Stripe, PayPal, etc.) */}
                  <div className="bg-white border border-stone-200/90 rounded-xl p-6 space-y-4">
                    <div className="pb-3.5 border-b border-stone-200/80 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-medium text-[#9A3412]">
                          Private Payout Vault · Bank, Telebirr &amp; Global
                        </div>
                        <h2 className="mt-0.5 font-serif text-lg font-medium text-stone-900">
                          Payment Details &amp; Payout Accounts
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={openAddPaymentForm}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Account</span>
                      </button>
                    </div>

                    {savedPayoutAccounts.length === 0 ? (
                      <div className="py-5 px-4 bg-[#FBF9F5] border border-dashed border-stone-300 rounded-lg text-center space-y-2">
                        <CreditCard className="w-5 h-5 text-stone-400 mx-auto" />
                        <p className="text-xs text-stone-600">
                          Add your Telebirr, Bank Account (CBE, Awash, IBAN),
                          CBE Birr, Mobile Money, PayPal, or Stripe payout
                          details to receive 90% net earnings on sales.
                        </p>
                        <button
                          type="button"
                          onClick={openAddPaymentForm}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#9A3412] hover:underline cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Payment Details</span>
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-stone-200/80">
                        {savedPayoutAccounts.map((acc, idx) => (
                          <div
                            key={acc.id}
                            className="py-3 first:pt-0 last:pb-0 flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <div className="flex flex-wrap items-center gap-1.5 font-semibold text-stone-900">
                                <span>{acc.providerLabel || acc.method}</span>
                                {idx === 0 && (
                                  <span className="text-[11px] font-medium text-[#9A3412]">
                                    · Primary
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2.5 text-[11px]">
                                {idx > 0 && (
                                  <button
                                    type="button"
                                    disabled={savingPayment}
                                    onClick={() =>
                                      void handleSetPrimaryPaymentMethod(acc.id)
                                    }
                                    className="font-medium text-stone-600 hover:text-[#9A3412] cursor-pointer whitespace-nowrap"
                                  >
                                    Set Primary
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openEditPaymentForm(acc)}
                                  className="font-medium text-stone-700 hover:text-stone-900 cursor-pointer"
                                >
                                  Edit
                                </button>
                                {confirmRemovePaymentId === acc.id ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={savingPayment}
                                      onClick={() =>
                                        void handleRemovePaymentMethod(acc.id)
                                      }
                                      className="font-semibold text-red-700 hover:underline cursor-pointer"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setConfirmRemovePaymentId(null)
                                      }
                                      className="text-stone-500 cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConfirmRemovePaymentId(acc.id)
                                    }
                                    className="text-stone-500 hover:text-red-700 cursor-pointer"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-stone-600">
                              {acc.accountHolder ? (
                                <span>{acc.accountHolder} · </span>
                              ) : null}
                              <span className="font-mono text-stone-900">
                                {acc.accountNumber}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {isPaymentFormOpen && (
                      <form
                        onSubmit={(e) => void handleSavePaymentMethodSubmit(e)}
                        className="pt-3 border-t border-stone-200 space-y-3"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-stone-900">
                          <span>
                            {editingPaymentId
                              ? 'Edit Payment Account'
                              : 'Add Payment / Bank / Telebirr Account'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsPaymentFormOpen(false);
                              setEditingPaymentId(null);
                            }}
                            className="text-stone-400 hover:text-stone-700 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-medium text-stone-600 mb-1">
                              Payment Type
                            </label>
                            <select
                              value={payMethod}
                              onChange={(e) => {
                                const next = e.target
                                  .value as SellerPayoutMethod;
                                setPayMethod(next);
                                const found =
                                  SELLER_PAYOUT_METHOD_OPTIONS.find(
                                    (m) => m.value === next
                                  );
                                setPayProviderLabel(
                                  next === 'BankTransfer'
                                    ? 'Commercial Bank of Ethiopia (CBE)'
                                    : found?.label || next
                                );
                              }}
                              className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                            >
                              {SELLER_PAYOUT_METHOD_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-stone-600 mb-1">
                              Bank / Provider Name
                            </label>
                            <input
                              type="text"
                              required
                              maxLength={60}
                              value={payProviderLabel}
                              onChange={(e) =>
                                setPayProviderLabel(e.target.value)
                              }
                              placeholder="e.g., Telebirr, CBE, Awash Bank, PayPal"
                              className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-medium text-stone-600 mb-1">
                              Account Holder Name
                            </label>
                            <input
                              type="text"
                              required
                              maxLength={60}
                              value={payAccountHolder}
                              onChange={(e) =>
                                setPayAccountHolder(e.target.value)
                              }
                              placeholder="Full name on account"
                              className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-stone-600 mb-1">
                              Phone / Account # / Email / IBAN
                            </label>
                            <input
                              type="text"
                              required
                              minLength={3}
                              maxLength={100}
                              value={payAccountNumber}
                              onChange={(e) =>
                                setPayAccountNumber(e.target.value)
                              }
                              placeholder={
                                SELLER_PAYOUT_METHOD_OPTIONS.find(
                                  (m) => m.value === payMethod
                                )?.placeholder || '+251 9... or 1000...'
                              }
                              className="w-full px-2.5 py-2 text-xs font-mono bg-[#FBF9F5] border border-stone-300 rounded-lg"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsPaymentFormOpen(false);
                              setEditingPaymentId(null);
                            }}
                            className="px-3 py-1.5 text-xs text-stone-600 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={savingPayment}
                            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg cursor-pointer"
                          >
                            {savingPayment
                              ? 'Saving...'
                              : editingPaymentId
                              ? 'Update Payment'
                              : 'Save Payment Account'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* Storefront Profile Form */}
                  <form
                    onSubmit={(e) => void handleSaveSellerAccountSubmit(e)}
                    className="bg-white border border-stone-200/90 rounded-xl p-6 space-y-4"
                  >
                    <div className="pb-3.5 border-b border-stone-200/80 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-medium text-[#9A3412]">
                          {profile?.isSeller
                            ? 'Creator Storefront Active'
                            : 'Seller Storefront Setup'}
                        </div>
                        <h2 className="mt-0.5 font-serif text-lg font-medium text-stone-900">
                          Storefront Identity &amp; Bio
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
                        placeholder="Independent designer, digital tool builder, or maker..."
                        className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                      />
                    </div>

                    {savedPayoutAccounts.length === 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1">
                            Quick Payout Method
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
                            {SELLER_PAYOUT_METHOD_OPTIONS.map((pm) => (
                              <option key={pm.value} value={pm.value}>
                                {pm.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1">
                            Account / Phone / IBAN
                          </label>
                          <input
                            type="text"
                            required
                            minLength={3}
                            maxLength={160}
                            value={sellerPayoutAccount}
                            onChange={(e) =>
                              setSellerPayoutAccount(e.target.value)
                            }
                            placeholder="+251 9... or 1000... or email"
                            className="w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={savingAccount}
                      className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] disabled:bg-stone-300 rounded-lg transition-colors cursor-pointer"
                    >
                      {savingAccount
                        ? 'Saving Storefront...'
                        : profile?.isSeller
                        ? 'Update Storefront Profile'
                        : 'Activate Creator Storefront'}
                    </button>
                  </form>
                </div>

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
          SUB-VIEW 3: CUSTOMER PURCHASES & INSTANT DIGITAL DOWNLOADS (GUEST + ACCOUNT)
         ================================================================= */}
      {subView === 'purchases' && (
        <div className="mt-8 space-y-6">
          {myPurchases.length === 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7 p-10 bg-white border border-stone-200 rounded-2xl text-center">
                <Package className="w-7 h-7 text-stone-300 mx-auto" />
                <h2 className="mt-3 font-serif text-xl font-medium text-stone-900">
                  No direct purchases on this device yet
                </h2>
                <p className="mt-1.5 text-sm text-stone-600 max-w-md mx-auto">
                  You can shop and buy physical or digital products directly
                  without creating an account. Purchased digital files and
                  order receipts appear here immediately.
                </p>
                <button
                  type="button"
                  onClick={() => setSubView('catalog')}
                  className="mt-5 px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg cursor-pointer"
                >
                  Browse Store Catalog
                </button>
              </div>

              {!user && (
                <div className="lg:col-span-5">
                  <AuthPanel
                    defaultMode="signin"
                    defaultAsSeller={false}
                    heading="Have an account? Sign in"
                    subheading="Optional: sign in with Google or Email to sync order history across devices."
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {!user && (
                <div className="px-4 py-3 bg-[#F5F2EB] border border-stone-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-stone-700">
                  <span>
                    Showing guest checkout receipts saved on this browser. You
                    can download your digital purchases anytime below.
                  </span>
                  <button
                    type="button"
                    onClick={() => openAuthModal('signin', false)}
                    className="font-semibold text-[#9A3412] hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Sign in to sync across devices →
                  </button>
                </div>
              )}

              {myPurchases.map((order) => {
                const digitalDeliverables = (order.productIds || [])
                  .map((pid) => allAccessibleDirectProductsMap[pid])
                  .filter(
                    (p): p is DirectProduct =>
                      Boolean(p && p.kind === 'digital' && p.digitalFileUrl)
                  );
                const isGuestLocalOrder = order.id.startsWith('guest_');

                return (
                  <div
                    key={order.id}
                    className="p-6 bg-white border border-stone-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-6"
                  >
                    <div className="space-y-2 max-w-2xl">
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

                      {digitalDeliverables.length > 0 &&
                        order.status !== 'cancelled' && (
                          <div className="pt-2 flex flex-wrap items-center gap-2">
                            {digitalDeliverables.map((prod) =>
                              prod.digitalFileUrl?.startsWith('https://') ? (
                                <a
                                  key={prod.id}
                                  href={prod.digitalFileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors whitespace-nowrap"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>
                                    Open {prod.digitalFileName || prod.title}
                                  </span>
                                </a>
                              ) : (
                                <button
                                  key={prod.id}
                                  type="button"
                                  onClick={() =>
                                    triggerDigitalAssetDownload(
                                      prod.digitalFileUrl || '',
                                      prod.digitalFileName || prod.title
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>
                                    Download{' '}
                                    {prod.digitalFileName || prod.title}
                                  </span>
                                </button>
                              )
                            )}
                          </div>
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

                      <div className="flex flex-wrap items-center gap-2">
                        {order.status === 'paid' && !isGuestLocalOrder && (
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

                        {(isGuestLocalOrder || isCreatorAdmin) &&
                          (confirmDeleteId === order.id ? (
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isGuestLocalOrder) {
                                    removeLocalPurchaseRecord(order.id);
                                  } else {
                                    void deleteDirectOrder(order.id);
                                  }
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
                              onClick={() => setConfirmDeleteId(order.id)}
                              className="p-1.5 text-stone-400 hover:text-red-700 cursor-pointer"
                              aria-label="Remove order receipt"
                              title="Remove order receipt"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                );
              })}
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
              <div className="md:col-span-6 space-y-4">
                <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[#F3EFE8] border border-stone-200/80">
                  <ResilientImage
                    imageKey={selectedProduct.imageKey}
                    alt={selectedProduct.title}
                    fallbackLabel={selectedProduct.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                {selectedProduct.videoUrl && (
                  <VideoEmbedFigure url={selectedProduct.videoUrl} compact />
                )}
              </div>

              <div className="md:col-span-6 space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                  <span className="font-semibold text-[#9A3412]">
                    {selectedProduct.kind === 'digital'
                      ? `Instant Digital Download${
                          selectedProduct.digitalFileType
                            ? ` · ${selectedProduct.digitalFileType}`
                            : ''
                        }`
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

                <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">
                  <InlineFormattedText text={selectedProduct.summary} />
                </p>

                {selectedProduct.kind === 'digital' &&
                  (selectedProduct.digitalFileName ||
                    selectedProduct.digitalFileType) && (
                    <div className="text-xs text-stone-600">
                      Included Digital Asset:{' '}
                      <strong className="text-stone-900">
                        {selectedProduct.digitalFileName ||
                          selectedProduct.digitalFileType}
                      </strong>
                      {selectedProduct.digitalFileType &&
                      selectedProduct.digitalFileName
                        ? ` (${selectedProduct.digitalFileType})`
                        : ''}
                    </div>
                  )}

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

            {/* Optional Product Video Attachment (URL or Compact Video Upload) */}
            <div className="p-3.5 bg-[#FBF9F5] border border-stone-200 rounded-xl space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-stone-800 inline-flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-[#9A3412]" />
                  <span>Product Demo Video (Optional — URL or Upload)</span>
                </span>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-[#1C1917] hover:bg-[#9A3412] rounded cursor-pointer whitespace-nowrap">
                    <Upload className="w-3 h-3" />
                    <span>
                      {uploadingProdVideo ? 'Uploading...' : 'Upload Video'}
                    </span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      onChange={(e) => void handleProdVideoFileUpload(e)}
                      className="hidden"
                    />
                  </label>
                  {prodVideoUrl && (
                    <button
                      type="button"
                      onClick={() => setProdVideoUrl('')}
                      className="text-[11px] font-medium text-stone-500 hover:text-red-700 cursor-pointer"
                    >
                      Remove Video
                    </button>
                  )}
                </div>
              </div>

              <input
                type="text"
                value={
                  prodVideoUrl.startsWith('data:video/')
                    ? ''
                    : prodVideoUrl
                }
                onChange={(e) => setProdVideoUrl(e.target.value)}
                placeholder={
                  prodVideoUrl.startsWith('data:video/')
                    ? 'Uploaded video clip attached'
                    : 'https://www.youtube.com/watch?v=... or https://vimeo.com/... or .mp4'
                }
                className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
              />

              {prodVideoUrl && (
                <VideoEmbedFigure url={prodVideoUrl} compact />
              )}
            </div>

            {/* Digital Deliverable Upload / Link (Shown when Digital Download is selected) */}
            {prodKind === 'digital' && (
              <div className="p-4 bg-[#F5F2EB] border border-stone-300/90 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-stone-900 inline-flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#9A3412]" />
                      <span>
                        Digital Product Upload / Download Link (PDF, ZIP, Excel,
                        eBook, HTML, Digital Tools, Link)
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      Upload the deliverable file directly (PDF, ZIP, XLSX/CSV,
                      EPUB/MOBI, HTML, JSON/JS/PY, DOCX/PPTX) or paste a direct
                      access link (Google Drive, Dropbox, OneDrive, GitHub, Web
                      Tool).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg cursor-pointer whitespace-nowrap">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploadingDigitalFile
                          ? 'Uploading File...'
                          : 'Upload Digital File'}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.zip,.xlsx,.xls,.csv,.epub,.mobi,.html,.htm,.json,.js,.ts,.py,.txt,.md,.xml,.svg,.docx,.pptx"
                        onChange={(e) => void handleDigitalAssetFileUpload(e)}
                        className="hidden"
                      />
                    </label>
                    {prodDigitalFileUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setProdDigitalFileUrl('');
                          setProdDigitalFileName('');
                          setProdDigitalFileType('');
                        }}
                        className="text-xs font-medium text-stone-600 hover:text-red-700 cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {prodDigitalFileUrl.startsWith('data:') ? (
                  <div className="px-3 py-2 bg-white border border-stone-200 rounded-lg flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-stone-900">
                      Attached File: {prodDigitalFileName || 'Digital Asset'}{' '}
                      {prodDigitalFileType ? `(${prodDigitalFileType})` : ''}
                    </span>
                    <span className="text-emerald-800 font-semibold shrink-0">
                      Ready for Instant Download
                    </span>
                  </div>
                ) : (
                  <input
                    type="url"
                    value={prodDigitalFileUrl}
                    onChange={(e) => {
                      setProdDigitalFileUrl(e.target.value);
                      if (!prodDigitalFileType && e.target.value.trim()) {
                        setProdDigitalFileType('HTTPS Link');
                      }
                    }}
                    placeholder="Or paste HTTPS product link (https://drive.google.com/..., Dropbox, Web App, etc.)"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-600 mb-1">
                      Asset Format / Type
                    </label>
                    <select
                      value={prodDigitalFileType}
                      onChange={(e) => setProdDigitalFileType(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                    >
                      <option value="">Select format (optional)...</option>
                      {DIGITAL_FORMAT_PRESETS.map((fmt) => (
                        <option key={fmt} value={fmt}>
                          {fmt}
                        </option>
                      ))}
                      {prodDigitalFileType &&
                        !DIGITAL_FORMAT_PRESETS.includes(
                          prodDigitalFileType
                        ) && (
                          <option value={prodDigitalFileType}>
                            {prodDigitalFileType}
                          </option>
                        )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-stone-600 mb-1">
                      Deliverable Filename / Label
                    </label>
                    <input
                      type="text"
                      maxLength={140}
                      value={prodDigitalFileName}
                      onChange={(e) => setProdDigitalFileName(e.target.value)}
                      placeholder="e.g., Grade9_Math_Tool.html or Workbook.pdf"
                      className="w-full px-2.5 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}

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
                maxLength={1500}
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
