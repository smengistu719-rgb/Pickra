import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Edit3,
  Link2,
  LogIn,
  PenSquare,
  Plus,
  Search,
  ShoppingBag,
  Store,
  Tag,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  OfferDraftInput,
  FirebaseProvider,
  useFirebaseApp,
} from './context/FirebaseContext';
import {
  ActiveSection,
  AffiliateOffer,
  AffiliatePlatform,
  ALL_AFFILIATE_PLATFORMS,
  BLOG_THEME_PALETTES,
  BlogPost,
  OfferKind,
  PostCategory,
  PRODUCT_AFFILIATE_PLATFORMS,
  PublishStatus,
  SERVICE_AFFILIATE_PLATFORMS,
} from './types';
import {
  formatPriceCents,
  readCompactVideoFileToDataUrl,
} from './firebase';
import { ResilientImage } from './components/ResilientImage';
import { OfferCard } from './components/OfferCard';
import { DirectProductCard } from './components/DirectProductCard';
import { DirectStorefront, StoreSubView } from './components/DirectStorefront';
import { ShoppingBagDrawer } from './components/ShoppingBagDrawer';
import { ArticleReader } from './components/ArticleReader';
import { PublisherStudio } from './components/PublisherStudio';
import { MediumBlockEditor } from './components/MediumBlockEditor';
import { ImageUploadPicker } from './components/ImageUploadPicker';
import { VideoEmbedFigure } from './components/EditorialRichBlocks';
import { AuthModal, AuthPanel } from './components/AuthModal';

function resolveInitialSection(): ActiveSection {
  try {
    const params = new URLSearchParams(window.location.search);
    const sec = params.get('section');
    if (
      sec === 'blog' ||
      sec === 'journal' ||
      sec === 'store' ||
      sec === 'products' ||
      sec === 'services' ||
      sec === 'write' ||
      sec === 'studio'
    ) {
      return sec === 'journal' ? 'blog' : sec;
    }
    if (params.get('promo')) {
      return 'store';
    }
  } catch {
    // ignore URL parsing errors
  }
  return 'blog';
}

function PickraShell() {
  const {
    user,
    authReady,
    adminRoleReady,
    loadingData,
    isCreatorAdmin,
    profile,
    privateInfo,
    siteConfig,
    publishedPosts,
    publishedOffers,
    allAccessibleOffersMap,
    publishedDirectProducts,
    allAccessibleDirectProductsMap,
    publishedCampaigns,
    cartCount,
    cartTotalCents,
    setIsCartOpen,
    applyPromoCode,
    openAuthModal,
    signOutUser,
    saveOffer,
    deleteOffer,
    deletePost,
    deleteDirectProduct,
  } = useFirebaseApp();

  const canAccessCreatorAdmin = Boolean(
    user &&
      !user.isAnonymous &&
      (isCreatorAdmin ||
        user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase())
  );

  const [activeSection, setActiveSection] = useState<ActiveSection>(
    resolveInitialSection
  );
  const [storeSubView, setStoreSubView] = useState<StoreSubView>('catalog');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [storyBeingEdited, setStoryBeingEdited] = useState<BlogPost | null>(
    null
  );
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(
    null
  );

  // Blog filters
  const [blogCategory, setBlogCategory] = useState<'All' | PostCategory>('All');
  const [blogSearch, setBlogSearch] = useState('');

  // Blog homepage directory quick-filter
  const [homeOfferFilter, setHomeOfferFilter] = useState<
    'all' | 'physical' | 'digital' | 'service'
  >('all');

  // Products page filters
  const [productKindFilter, setProductKindFilter] = useState<
    'all' | 'physical' | 'digital'
  >('all');
  const [productPlatformFilter, setProductPlatformFilter] = useState<
    'All' | AffiliatePlatform
  >('All');
  const [productSearch, setProductSearch] = useState('');

  // Services page filters
  const [servicePlatformFilter, setServicePlatformFilter] = useState<
    'All' | AffiliatePlatform
  >('All');
  const [serviceSearch, setServiceSearch] = useState('');

  // Shared Affiliate Offer Add / Edit Modal (used on Products, Services & Blog pages)
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState<string | undefined>(
    undefined
  );
  const [offerTitle, setOfferTitle] = useState('');
  const [offerKind, setOfferKind] = useState<OfferKind>('physical');
  const [offerPlatform, setOfferPlatform] =
    useState<AffiliatePlatform>('Amazon');
  const [offerCategory, setOfferCategory] = useState('Studio Hardware');
  const [offerPrice, setOfferPrice] = useState('$149.00');
  const [offerCommission, setOfferCommission] = useState('');
  const [offerUrl, setOfferUrl] = useState('');
  const [offerImageKey, setOfferImageKey] = useState('audio');
  const [offerVideoUrl, setOfferVideoUrl] = useState('');
  const [uploadingOfferVideo, setUploadingOfferVideo] = useState(false);
  const [offerSummary, setOfferSummary] = useState('');
  const [showDescLinkHelper, setShowDescLinkHelper] = useState(false);
  const [descLinkLabel, setDescLinkLabel] = useState('');
  const [descLinkUrl, setDescLinkUrl] = useState('');
  const [offerHighlightsText, setOfferHighlightsText] = useState('');
  const [offerStatus, setOfferStatus] = useState<PublishStatus>('published');
  const [savingOffer, setSavingOffer] = useState(false);
  const [offerModalError, setOfferModalError] = useState<string | null>(null);

  const isBlogSection =
    activeSection === 'blog' || activeSection === 'journal';

  const selectedPost = useMemo(() => {
    if (!selectedPostId) return null;
    return publishedPosts.find((p) => p.id === selectedPostId) || null;
  }, [selectedPostId, publishedPosts]);

  const leadPost = publishedPosts[0] || null;
  const leadCampaign = publishedCampaigns[0] || null;

  const homeDirectEditions = useMemo(() => {
    const featured = publishedDirectProducts.filter((p) => p.featured);
    const source = featured.length >= 3 ? featured : publishedDirectProducts;
    return source.slice(0, 3);
  }, [publishedDirectProducts]);

  const filteredBlogPosts = useMemo(() => {
    const q = blogSearch.trim().toLowerCase();
    return publishedPosts.filter((post) => {
      if (blogCategory !== 'All' && post.category !== blogCategory) {
        return false;
      }
      if (!q) return true;
      return (
        post.title.toLowerCase().includes(q) ||
        post.subtitle.toLowerCase().includes(q) ||
        post.category.toLowerCase().includes(q) ||
        post.content.toLowerCase().includes(q)
      );
    });
  }, [publishedPosts, blogCategory, blogSearch]);

  const homeFeaturedOffers = useMemo(() => {
    const list =
      homeOfferFilter === 'all'
        ? publishedOffers
        : publishedOffers.filter((o) => o.kind === homeOfferFilter);
    return list.slice(0, 6);
  }, [publishedOffers, homeOfferFilter]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return publishedOffers.filter((offer) => {
      if (offer.kind === 'service') return false;
      if (productKindFilter !== 'all' && offer.kind !== productKindFilter) {
        return false;
      }
      if (
        productPlatformFilter !== 'All' &&
        offer.platform !== productPlatformFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        offer.title.toLowerCase().includes(q) ||
        offer.summary.toLowerCase().includes(q) ||
        offer.platform.toLowerCase().includes(q) ||
        offer.category.toLowerCase().includes(q)
      );
    });
  }, [publishedOffers, productKindFilter, productPlatformFilter, productSearch]);

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    return publishedOffers.filter((offer) => {
      if (offer.kind !== 'service') return false;
      if (
        servicePlatformFilter !== 'All' &&
        offer.platform !== servicePlatformFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        offer.title.toLowerCase().includes(q) ||
        offer.summary.toLowerCase().includes(q) ||
        offer.platform.toLowerCase().includes(q) ||
        offer.category.toLowerCase().includes(q)
      );
    });
  }, [publishedOffers, servicePlatformFilter, serviceSearch]);

  const relatedPostByOfferId = useMemo(() => {
    const map: Record<string, BlogPost> = {};
    for (const post of publishedPosts) {
      for (const oid of post.attachedOfferIds) {
        if (!map[oid]) {
          map[oid] = post;
        }
      }
    }
    return map;
  }, [publishedPosts]);

  useEffect(() => {
    if (!authReady || !adminRoleReady) return;
    if (activeSection === 'studio' && !canAccessCreatorAdmin) {
      setActiveSection('blog');
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('section') === 'studio') {
          url.searchParams.delete('section');
          window.history.replaceState({}, '', url.toString());
        }
      } catch {
        // ignore URL history errors
      }
    }
  }, [authReady, adminRoleReady, activeSection, canAccessCreatorAdmin]);

  function navigateToSection(
    section: ActiveSection,
    targetStoreSubView: StoreSubView = 'catalog'
  ) {
    setSelectedPostId(null);
    if (section === 'studio' && !canAccessCreatorAdmin) {
      setActiveSection('blog');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (section === 'write') {
      setStoryBeingEdited(null);
    }
    if (section === 'store') {
      setStoreSubView(targetStoreSubView);
    }
    setActiveSection(section === 'journal' ? 'blog' : section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openPost(post: BlogPost) {
    setSelectedPostId(post.id);
    setActiveSection('blog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openBlockEditorForPost(post?: BlogPost | null) {
    setStoryBeingEdited(post || null);
    setSelectedPostId(null);
    setActiveSection('write');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openNewAffiliateModal(defaultKind: OfferKind) {
    setEditingOfferId(undefined);
    setOfferTitle('');
    setOfferKind(defaultKind);
    setOfferPlatform(defaultKind === 'service' ? 'Fiverr' : 'Amazon');
    setOfferCategory(
      defaultKind === 'service' ? 'Specialist Services' : 'Featured Products'
    );
    setOfferPrice(defaultKind === 'service' ? 'From $120' : '$149.00');
    setOfferCommission('');
    setOfferUrl('');
    setOfferImageKey(defaultKind === 'service' ? 'freelance' : 'audio');
    setOfferVideoUrl('');
    setOfferSummary('');
    setShowDescLinkHelper(false);
    setDescLinkLabel('');
    setDescLinkUrl('');
    setOfferHighlightsText('');
    setOfferStatus('published');
    setOfferModalError(null);
    setIsOfferModalOpen(true);
  }

  function openEditAffiliateModal(offer: AffiliateOffer) {
    setEditingOfferId(offer.id);
    setOfferTitle(offer.title);
    setOfferKind(offer.kind);
    setOfferPlatform(offer.platform);
    setOfferCategory(offer.category);
    setOfferPrice(offer.priceLabel);
    setOfferCommission(offer.commissionNote);
    setOfferUrl(offer.affiliateUrl);
    setOfferImageKey(offer.imageKey || 'audio');
    setOfferVideoUrl(offer.videoUrl || '');
    setOfferSummary(offer.summary);
    setShowDescLinkHelper(false);
    setDescLinkLabel('');
    setDescLinkUrl('');
    setOfferHighlightsText(offer.highlights.join('\n'));
    setOfferStatus(offer.status);
    setOfferModalError(null);
    setIsOfferModalOpen(true);
  }

  async function handleOfferVideoFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingOfferVideo(true);
    setOfferModalError(null);
    try {
      const dataUrl = await readCompactVideoFileToDataUrl(file);
      setOfferVideoUrl(dataUrl);
    } catch (err) {
      setOfferModalError(
        err instanceof Error ? err.message : 'Unable to upload video.'
      );
    } finally {
      setUploadingOfferVideo(false);
      e.target.value = '';
    }
  }

  function handleInsertHyperlinkIntoSummary() {
    let cleanUrl = descLinkUrl.trim();
    if (!cleanUrl) return;
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    if (cleanUrl.startsWith('http://')) {
      cleanUrl = `https://${cleanUrl.slice(7)}`;
    }
    const cleanLabel = (descLinkLabel.trim() || 'View Product').replace(
      /[\[\]]/g,
      ''
    );
    const mdLink = `[${cleanLabel}](${cleanUrl})`;
    setOfferSummary((prev) =>
      prev.trim().length > 0 ? `${prev.trim()} ${mdLink}` : mdLink
    );
    if (!offerUrl.trim()) {
      setOfferUrl(cleanUrl);
    }
    setDescLinkLabel('');
    setDescLinkUrl('');
    setShowDescLinkHelper(false);
  }

  function handleAppendSavedTrackingTag() {
    const trimmed = offerUrl.trim();
    if (!trimmed) {
      setOfferModalError('Paste a destination URL first.');
      return;
    }
    try {
      const normalized = trimmed.startsWith('http')
        ? trimmed
        : `https://${trimmed}`;
      const parsed = new URL(normalized);
      if (offerPlatform === 'Amazon' && privateInfo?.defaultAmazonTag?.trim()) {
        parsed.searchParams.set('tag', privateInfo.defaultAmazonTag.trim());
        setOfferUrl(parsed.toString());
        setOfferModalError(null);
        return;
      }
      if (
        offerPlatform === 'Digistore24' &&
        privateInfo?.defaultDigistoreId?.trim()
      ) {
        parsed.searchParams.set('aff', privateInfo.defaultDigistoreId.trim());
        setOfferUrl(parsed.toString());
        setOfferModalError(null);
        return;
      }
      setOfferModalError(
        'Save your default Amazon Tag or Digistore24 ID in Backend -> Site & Access first.'
      );
    } catch {
      setOfferModalError('Please enter a valid HTTPS URL first.');
    }
  }

  async function handleSaveAffiliateModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingOffer(true);
    setOfferModalError(null);
    try {
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
        imageKey: offerImageKey || 'audio',
        videoUrl: offerVideoUrl,
        summary: offerSummary,
        highlights,
        status: offerStatus,
      };
      await saveOffer(input);
      setIsOfferModalOpen(false);
    } catch (err) {
      setOfferModalError(
        err instanceof Error ? err.message : 'Unable to save affiliate link.'
      );
    } finally {
      setSavingOffer(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] text-[#1C1917]">
      {/* Creator-Controlled Site-Wide Announcement Ribbon */}
      {siteConfig.announcementEnabled &&
        siteConfig.announcementText.trim().length > 0 && (
          <div className="bg-[#1C1917] text-[#FBF9F5] border-b border-stone-800">
            <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <p className="text-stone-200 leading-snug">
                {siteConfig.announcementText}
              </p>
              {siteConfig.announcementCtaLabel.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    navigateToSection(siteConfig.announcementTargetSection)
                  }
                  className="font-semibold text-white underline underline-offset-4 hover:text-amber-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {siteConfig.announcementCtaLabel} →
                </button>
              )}
            </div>
          </div>
        )}

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="md:sticky md:top-0 z-30 bg-[#FBF9F5]/95 backdrop-blur-xs border-b border-stone-200/90">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-8 px-5 sm:px-8 py-4">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#blog"
            onClick={(e) => {
              e.preventDefault();
              navigateToSection('blog');
            }}
            className="font-serif text-xl font-semibold tracking-tight text-stone-900 whitespace-nowrap shrink-0"
          >
            Pickra
          </a>

          {/* Zone 2: 5 single-line navigation links */}
          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600"
          >
            <button
              type="button"
              onClick={() => navigateToSection('blog')}
              className={`py-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isBlogSection || activeSection === 'write'
                  ? 'border-[#9A3412] text-stone-900'
                  : 'border-transparent hover:text-stone-900'
              }`}
            >
              Blog
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('store')}
              className={`py-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeSection === 'store'
                  ? 'border-[#9A3412] text-stone-900'
                  : 'border-transparent hover:text-stone-900'
              }`}
            >
              Store
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('products')}
              className={`py-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeSection === 'products'
                  ? 'border-[#9A3412] text-stone-900'
                  : 'border-transparent hover:text-stone-900'
              }`}
            >
              Product Affiliate
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('services')}
              className={`py-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeSection === 'services'
                  ? 'border-[#9A3412] text-stone-900'
                  : 'border-transparent hover:text-stone-900'
              }`}
            >
              Service Affiliate
            </button>
            {canAccessCreatorAdmin && (
              <button
                type="button"
                onClick={() => navigateToSection('studio')}
                className={`py-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeSection === 'studio'
                    ? 'border-[#9A3412] text-stone-900'
                    : 'border-transparent hover:text-stone-900'
                }`}
              >
                Backend
              </button>
            )}
          </nav>

          {/* Zone 3: 1 primary action — Medium-style Write Blog */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => openBlockEditorForPost(null)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <PenSquare className="w-3.5 h-3.5" />
              <span>Write Blog</span>
            </button>
          </div>
        </div>

        {/* Mobile Secondary Row */}
        <div className="flex md:hidden items-center justify-around gap-2 overflow-x-auto border-t border-stone-200/70 px-4 py-2.5 text-xs font-medium text-stone-600">
          <button
            type="button"
            onClick={() => navigateToSection('blog')}
            className={`whitespace-nowrap shrink-0 ${
              isBlogSection ? 'text-[#9A3412] font-semibold' : ''
            }`}
          >
            Blog
          </button>
          <button
            type="button"
            onClick={() => navigateToSection('store')}
            className={`whitespace-nowrap shrink-0 ${
              activeSection === 'store' ? 'text-[#9A3412] font-semibold' : ''
            }`}
          >
            Store
          </button>
          <button
            type="button"
            onClick={() => navigateToSection('products')}
            className={`whitespace-nowrap shrink-0 ${
              activeSection === 'products' ? 'text-[#9A3412] font-semibold' : ''
            }`}
          >
            Product Affiliate
          </button>
          <button
            type="button"
            onClick={() => navigateToSection('services')}
            className={`whitespace-nowrap shrink-0 ${
              activeSection === 'services' ? 'text-[#9A3412] font-semibold' : ''
            }`}
          >
            Service Affiliate
          </button>
          <button
            type="button"
            onClick={() => openBlockEditorForPost(null)}
            className={`whitespace-nowrap shrink-0 ${
              activeSection === 'write' ? 'text-[#9A3412] font-semibold' : ''
            }`}
          >
            Write
          </button>
          {canAccessCreatorAdmin && (
            <button
              type="button"
              onClick={() => navigateToSection('studio')}
              className={`whitespace-nowrap shrink-0 ${
                activeSection === 'studio' ? 'text-[#9A3412] font-semibold' : ''
              }`}
            >
              Backend
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {activeSection === 'write' ? (
          <MediumBlockEditor
            initialPost={storyBeingEdited}
            onBack={() => navigateToSection('blog')}
            onPublished={(savedPostId) => {
              setSelectedPostId(savedPostId);
              setStoryBeingEdited(null);
              setActiveSection('blog');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : activeSection === 'store' ? (
          <DirectStorefront key={storeSubView} initialSubView={storeSubView} />
        ) : selectedPost && isBlogSection ? (
          <ArticleReader
            post={selectedPost}
            offersMap={allAccessibleOffersMap}
            directProductsMap={allAccessibleDirectProductsMap}
            onBack={() => setSelectedPostId(null)}
            onEditInEditor={openBlockEditorForPost}
            onDeletePost={async (p) => {
              await deletePost(p.id);
              setSelectedPostId(null);
            }}
            onOpenStore={() => navigateToSection('store')}
          />
        ) : activeSection === 'studio' && canAccessCreatorAdmin ? (
          <PublisherStudio
            onOpenPublishedPost={openPost}
            onOpenBlockEditor={openBlockEditorForPost}
            onOpenDirectStore={() => navigateToSection('store')}
          />
        ) : activeSection === 'products' ? (
          /* ===============================================================
             PRODUCT AFFILIATE PAGE: PHYSICAL & DIGITAL AFFILIATE LINKS
             =============================================================== */
          <section className="max-w-[1200px] mx-auto px-5 sm:px-8 py-10 sm:py-14">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="max-w-3xl">
                <div className="text-xs text-stone-500">
                  Product Affiliate · Amazon · Digistore24 · ClickBank · Gumroad
                  · CJ · ShareASale · Impact
                </div>
                <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-medium text-stone-900">
                  Product Affiliate — Physical &amp; Digital Products
                </h1>
                <p className="mt-3 text-base text-stone-600 leading-relaxed">
                  Curated physical hardware and digital product affiliate
                  listings with rich descriptions, images, videos, and direct
                  destination links. Click any product link to land directly on
                  the target product platform.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start lg:self-auto">
                <button
                  type="button"
                  onClick={() => openNewAffiliateModal('physical')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Product Affiliate</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigateToSection('store')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-[#9A3412]" />
                  <span>Creators&apos; Store →</span>
                </button>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="mt-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-stone-200">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-1 p-1 bg-[#F3EFE8] rounded-lg">
                  {(
                    [
                      ['all', 'All Products'],
                      ['physical', 'Physical Products'],
                      ['digital', 'Digital Products'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setProductKindFilter(val)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        productKindFilter === val
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <select
                  aria-label="Filter by affiliate platform"
                  value={productPlatformFilter}
                  onChange={(e) =>
                    setProductPlatformFilter(
                      e.target.value as 'All' | AffiliatePlatform
                    )
                  }
                  className="px-3 py-2 text-xs font-medium bg-white border border-stone-200 rounded-lg text-stone-700 focus:outline-none focus:border-[#9A3412]"
                >
                  <option value="All">All Marketing Platforms</option>
                  {PRODUCT_AFFILIATE_PLATFORMS.map((plat) => (
                    <option key={plat} value={plat}>
                      {plat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative w-full lg:w-72">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search Amazon, Digistore24, tools..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-[#9A3412]"
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => setProductSearch('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-stone-600">
                  No affiliate products match your current filter selection.
                </p>
                <div className="mt-4 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setProductKindFilter('all');
                      setProductPlatformFilter('All');
                      setProductSearch('');
                    }}
                    className="text-xs font-semibold text-[#9A3412] hover:underline cursor-pointer"
                  >
                    Reset Filters
                  </button>
                  <button
                    type="button"
                    onClick={() => openNewAffiliateModal('physical')}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-[#1C1917] rounded-lg cursor-pointer"
                  >
                    + Add Affiliate Product
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                {filteredProducts.map((offer: AffiliateOffer) => {
                  const relatedPost = relatedPostByOfferId[offer.id];
                  return (
                    <div key={offer.id} className="flex flex-col">
                      <OfferCard
                        offer={offer}
                        variant="grid"
                        onEdit={
                          isCreatorAdmin ? openEditAffiliateModal : undefined
                        }
                        onDelete={
                          isCreatorAdmin
                            ? (targetOffer) => {
                                void deleteOffer(targetOffer.id);
                              }
                            : undefined
                        }
                      />
                      {relatedPost && (
                        <button
                          type="button"
                          onClick={() => openPost(relatedPost)}
                          className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-[#9A3412] transition-colors cursor-pointer text-left"
                        >
                          <BookOpen className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            Reviewed in blog: {relatedPost.title}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : activeSection === 'services' ? (
          /* ===============================================================
             SERVICE AFFILIATE PAGE: PROFESSIONAL SERVICE SELLER LINKS
             =============================================================== */
          <section className="max-w-[1200px] mx-auto px-5 sm:px-8 py-10 sm:py-14">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="max-w-3xl">
                <div className="text-xs text-stone-500">
                  Service Affiliate · Fiverr · Upwork · Toptal · 99designs ·
                  Contra · PeoplePerHour
                </div>
                <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-medium text-stone-900">
                  Service Affiliate — Vetted Professional Services
                </h1>
                <p className="mt-3 text-base text-stone-600 leading-relaxed">
                  Promoted engineering, design, video production, and specialist
                  service sellers with descriptions, images, video showcases,
                  and direct booking links—guiding demanders directly to each
                  service seller&apos;s platform.
                </p>
              </div>

              <button
                type="button"
                onClick={() => openNewAffiliateModal('service')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start lg:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Service Affiliate</span>
              </button>
            </div>

            <div className="mt-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-stone-200">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#F3EFE8] rounded-lg">
                  {(
                    ['All', 'Fiverr', 'Upwork', 'Toptal', '99designs'] as const
                  ).map((plat) => (
                    <button
                      key={plat}
                      type="button"
                      onClick={() => setServicePlatformFilter(plat)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        servicePlatformFilter === plat
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {plat === 'All' ? 'All Service Platforms' : plat}
                    </button>
                  ))}
                </div>

                <select
                  aria-label="Filter all service networks"
                  value={servicePlatformFilter}
                  onChange={(e) =>
                    setServicePlatformFilter(
                      e.target.value as 'All' | AffiliatePlatform
                    )
                  }
                  className="px-3 py-2 text-xs font-medium bg-white border border-stone-200 rounded-lg text-stone-700 focus:outline-none focus:border-[#9A3412]"
                >
                  <option value="All">All Service Networks</option>
                  {SERVICE_AFFILIATE_PLATFORMS.map((plat) => (
                    <option key={plat} value={plat}>
                      {plat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative w-full lg:w-72">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  placeholder="Search Fiverr, Upwork, design, SEO..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-[#9A3412]"
                />
                {serviceSearch && (
                  <button
                    type="button"
                    onClick={() => setServiceSearch('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {filteredServices.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-stone-600">
                  No professional services match your current filter selection.
                </p>
                <div className="mt-4 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setServicePlatformFilter('All');
                      setServiceSearch('');
                    }}
                    className="text-xs font-semibold text-[#9A3412] hover:underline cursor-pointer"
                  >
                    Reset Filters
                  </button>
                  <button
                    type="button"
                    onClick={() => openNewAffiliateModal('service')}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-[#1C1917] rounded-lg cursor-pointer"
                  >
                    + Add Affiliate Service
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                {filteredServices.map((offer) => {
                  const relatedPost = relatedPostByOfferId[offer.id];
                  return (
                    <div key={offer.id} className="flex flex-col">
                      <OfferCard
                        offer={offer}
                        variant="grid"
                        onEdit={
                          isCreatorAdmin ? openEditAffiliateModal : undefined
                        }
                        onDelete={
                          isCreatorAdmin
                            ? (targetOffer) => {
                                void deleteOffer(targetOffer.id);
                              }
                            : undefined
                        }
                      />
                      {relatedPost && (
                        <button
                          type="button"
                          onClick={() => openPost(relatedPost)}
                          className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-[#9A3412] transition-colors cursor-pointer text-left"
                        >
                          <BookOpen className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            Featured in blog: {relatedPost.title}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          /* ===============================================================
             BLOG PAGE (GLOBAL EDITORIAL BLOG + MEDIUM COMPOSER + SHOWCASES)
             =============================================================== */
          <div>
            {/* SECTION 1: Lead Blog Story Hero + Medium Composer Entry */}
            {leadPost ? (
              <section className="max-w-[1200px] mx-auto px-5 sm:px-8 pt-8 sm:pt-12 pb-12 border-b border-stone-200/90">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
                  <div className="lg:col-span-6 flex flex-col justify-between py-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                        <span className="font-medium text-[#9A3412]">
                          Featured Blog Story
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{leadPost.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{leadPost.publishedLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {leadPost.readTimeMinutes} min read
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Theme:{' '}
                          {
                            BLOG_THEME_PALETTES[leadPost.theme || 'classic']
                              .label
                          }
                        </span>
                      </div>

                      <h1 className="mt-4 font-serif text-[clamp(2rem,3.6vw,3.1rem)] font-medium text-stone-900 leading-[1.12] tracking-tight">
                        {leadPost.title}
                      </h1>

                      <p className="mt-4 text-base sm:text-lg text-stone-600 leading-relaxed">
                        {leadPost.subtitle}
                      </p>

                      {isCreatorAdmin && (
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                          <button
                            type="button"
                            onClick={() => openBlockEditorForPost(leadPost)}
                            className="inline-flex items-center gap-1 font-medium text-stone-700 hover:text-[#9A3412] cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit Lead Blog</span>
                          </button>
                          <span className="text-stone-300" aria-hidden="true">
                            ·
                          </span>
                          {confirmDeletePostId === leadPost.id ? (
                            <span className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  void deletePost(leadPost.id);
                                  setConfirmDeletePostId(null);
                                }}
                                className="font-semibold text-red-700 hover:underline cursor-pointer"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePostId(null)}
                                className="text-stone-500 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDeletePostId(leadPost.id)
                              }
                              className="inline-flex items-center gap-1 text-stone-500 hover:text-red-700 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-stone-200/80 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => openPost(leadPost)}
                          className="inline-flex items-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <span>Read Full Blog</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => openBlockEditorForPost(null)}
                          className="inline-flex items-center gap-1.5 px-4 py-3 text-xs font-semibold text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <PenSquare className="w-3.5 h-3.5 text-[#9A3412]" />
                          <span>Write New Blog</span>
                        </button>
                      </div>

                      {cartCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setIsCartOpen(true)}
                          className="text-xs font-mono font-semibold text-stone-900 hover:text-[#9A3412] tabular-nums cursor-pointer"
                        >
                          Bag ({cartCount}) · {formatPriceCents(cartTotalCents)}
                        </button>
                      ) : (
                        <span className="text-xs text-stone-500 tabular-nums">
                          {leadPost.attachedOfferIds.length} product &amp;
                          service links inside
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    onClick={() => openPost(leadPost)}
                    className="lg:col-span-6 rounded-xl overflow-hidden bg-[#F3EFE8] border border-stone-200/80 cursor-pointer group min-h-[280px]"
                  >
                    <ResilientImage
                      imageKey={leadPost.coverImageKey}
                      alt={leadPost.title}
                      fallbackLabel={leadPost.title}
                      className="w-full h-full lg:h-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
                    />
                  </div>
                </div>

                {/* Full-width Operational & Partner Transparency Strip */}
                <div className="mt-8 pt-5 border-t border-stone-200/80 flex flex-wrap items-center justify-between gap-4 text-xs text-stone-500">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-stone-800">
                      Pickra Global Blog &amp; Commerce
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Medium-Style Rich Blog (Images, Links, Video &amp; Color
                      Themes)
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Creators&apos; Marketplace &amp; Affiliate Hub</span>
                  </div>
                  <span>
                    Creators earn 90% on Store sales; external links guide
                    directly to partner platforms.
                  </span>
                </div>
              </section>
            ) : (
              <section className="max-w-[1200px] mx-auto px-5 sm:px-8 py-14 border-b border-stone-200/90 text-center">
                <h1 className="font-serif text-3xl font-medium text-stone-900">
                  Pickra Global Editorial Blog
                </h1>
                <p className="mt-2 text-sm text-stone-600">
                  Publish your first rich blog story with images, embedded
                  videos, affiliate links, and custom color themes.
                </p>
                <button
                  type="button"
                  onClick={() => openBlockEditorForPost(null)}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg cursor-pointer"
                >
                  <PenSquare className="w-4 h-4" />
                  <span>Write First Blog Post</span>
                </button>
              </section>
            )}

            {/* SECTION 2: Global Blog Feed (with Add, Edit & Delete) */}
            <section
              id="blog"
              className="max-w-[1200px] mx-auto px-5 sm:px-8 py-12 sm:py-16 border-b border-stone-200/90"
            >
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div>
                  <span className="text-xs text-stone-500">
                    Global Audience Blog · Rich Media, Links, Video &amp; Color
                    Themes
                  </span>
                  <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-medium text-stone-900">
                    Published Blog Stories
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#F3EFE8] rounded-lg">
                    {(
                      [
                        'All',
                        'Hardware & Gear',
                        'Digital Systems',
                        'Freelance Talent',
                        'Field Guides',
                      ] as const
                    ).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setBlogCategory(cat)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          blogCategory === cat
                            ? 'bg-white text-stone-900 shadow-xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={blogSearch}
                      onChange={(e) => setBlogSearch(e.target.value)}
                      placeholder="Search blog posts..."
                      className="w-full pl-8 pr-7 py-2 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-[#9A3412]"
                    />
                    {blogSearch && (
                      <button
                        type="button"
                        onClick={() => setBlogSearch('')}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => openBlockEditorForPost(null)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Blog</span>
                  </button>
                </div>
              </div>

              {loadingData && publishedPosts.length === 0 ? (
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-7">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-80 rounded-xl bg-[#F3EFE8] border border-stone-200/70"
                    />
                  ))}
                </div>
              ) : filteredBlogPosts.length === 0 ? (
                <div className="mt-10 py-12 text-center bg-white border border-stone-200/80 rounded-xl">
                  <p className="text-sm text-stone-600">
                    No blog stories match your current search or category
                    filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setBlogCategory('All');
                      setBlogSearch('');
                    }}
                    className="mt-3 text-xs font-semibold text-[#9A3412] hover:underline cursor-pointer"
                  >
                    Show All Blog Stories
                  </button>
                </div>
              ) : (
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                  {filteredBlogPosts.map((post) => {
                    const palette =
                      BLOG_THEME_PALETTES[post.theme || 'classic'];
                    return (
                      <article
                        key={post.id}
                        onClick={() => openPost(post)}
                        className="group flex flex-col bg-white border border-stone-200/90 rounded-xl overflow-hidden cursor-pointer transition-transform duration-150 hover:-translate-y-0.5"
                      >
                        <div className="aspect-[4/3] w-full bg-[#F3EFE8] overflow-hidden">
                          <ResilientImage
                            imageKey={post.coverImageKey}
                            alt={post.title}
                            fallbackLabel={post.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                        </div>

                        <div className="flex flex-col flex-1 p-5 sm:p-6">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                            <span className="font-medium text-[#9A3412]">
                              {post.category}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{post.publishedLabel}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">
                              {post.readTimeMinutes} min read
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{palette.label}</span>
                          </div>

                          <h3 className="mt-2.5 font-serif text-xl font-medium text-stone-900 leading-snug group-hover:text-[#9A3412] transition-colors">
                            {post.title}
                          </h3>

                          <p className="mt-2 text-sm text-stone-600 leading-relaxed line-clamp-3 flex-1">
                            {post.subtitle}
                          </p>

                          <div className="mt-5 pt-4 border-t border-stone-200/80 flex items-center justify-between text-xs text-stone-500">
                            <span className="tabular-nums">
                              {post.attachedOfferIds.length} attached{' '}
                              {post.attachedOfferIds.length === 1
                                ? 'link'
                                : 'links'}
                            </span>
                            <span className="font-semibold text-stone-900 group-hover:text-[#9A3412] inline-flex items-center gap-1">
                              <span>Read Blog</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          </div>

                          {isCreatorAdmin && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mt-3 pt-2.5 border-t border-stone-200/70 flex items-center justify-end gap-3 text-xs"
                            >
                              <button
                                type="button"
                                onClick={() => openBlockEditorForPost(post)}
                                className="inline-flex items-center gap-1 font-medium text-stone-600 hover:text-stone-900 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>

                              {confirmDeletePostId === post.id ? (
                                <span className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void deletePost(post.id);
                                      setConfirmDeletePostId(null);
                                    }}
                                    className="font-semibold text-red-700 hover:underline cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeletePostId(null)}
                                    className="text-stone-500 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmDeletePostId(post.id)
                                  }
                                  className="inline-flex items-center gap-1 text-stone-500 hover:text-red-700 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* SECTION 3: Creators' Store Marketplace Showcase */}
            {homeDirectEditions.length > 0 && (
              <section className="max-w-[1200px] mx-auto px-5 sm:px-8 py-12 sm:py-16 border-b border-stone-200/90">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                  <div>
                    <span className="text-xs text-stone-500">
                      Multi-Creator Marketplace · Physical &amp; Digital
                      Products
                    </span>
                    <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-medium text-stone-900">
                      Creators&apos; Store — Sold Directly on Pickra
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {leadCampaign && (
                      <button
                        type="button"
                        onClick={() => {
                          applyPromoCode(leadCampaign.promoCode);
                          navigateToSection('store');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Tag className="w-3.5 h-3.5 text-[#9A3412]" />
                        <span>
                          Promo {leadCampaign.promoCode}:{' '}
                          {leadCampaign.discountPercent}% Off →
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => navigateToSection('store', 'sell')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#9A3412] bg-white border border-stone-300 hover:border-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>Sell Your Products</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateToSection('store')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Explore Store</span>
                    </button>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                  {homeDirectEditions.map((product) => {
                    const editable =
                      isCreatorAdmin ||
                      (Boolean(user) && product.sellerId === user?.uid);
                    return (
                      <DirectProductCard
                        key={product.id}
                        product={product}
                        variant="grid"
                        onInspectProduct={() => navigateToSection('store')}
                        onEdit={
                          editable
                            ? () => navigateToSection('store', 'sell')
                            : undefined
                        }
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
              </section>
            )}

            {/* SECTION 4: Curated Affiliate Products & Services Showcase */}
            <section className="max-w-[1200px] mx-auto px-5 sm:px-8 py-12 sm:py-16">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div>
                  <span className="text-xs text-stone-500">
                    Global Affiliate Directory · Amazon · Digistore24 · Fiverr ·
                    Upwork &amp; More
                  </span>
                  <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-medium text-stone-900">
                    Affiliate Products &amp; Professional Services
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#F3EFE8] rounded-lg">
                    {(
                      [
                        ['all', 'All Offerings'],
                        ['physical', 'Physical Products'],
                        ['digital', 'Digital Products'],
                        ['service', 'Professional Services'],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setHomeOfferFilter(val)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          homeOfferFilter === val
                            ? 'bg-white text-stone-900 shadow-xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      openNewAffiliateModal(
                        homeOfferFilter === 'service' ? 'service' : 'physical'
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Affiliate Link</span>
                  </button>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                {homeFeaturedOffers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    variant="grid"
                    onEdit={isCreatorAdmin ? openEditAffiliateModal : undefined}
                    onDelete={
                      isCreatorAdmin
                        ? (targetOffer) => {
                            void deleteOffer(targetOffer.id);
                          }
                        : undefined
                    }
                  />
                ))}
              </div>

              <div className="mt-10 pt-6 border-t border-stone-200/80 flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs text-stone-500">
                  {isCreatorAdmin
                    ? 'Owner access active — write rich blogs, edit or delete items on any page, or open Backend to monitor orders, payouts, and traffic.'
                    : 'Read global blog dispatches, sell your own creations on the Store, or explore vetted partner products and services.'}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => openBlockEditorForPost(null)}
                    className="text-[#9A3412] hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Write Blog →
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToSection('store', 'sell')}
                    className="text-stone-900 hover:text-[#9A3412] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Sell on Store →
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToSection('products')}
                    className="text-stone-900 hover:text-[#9A3412] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Product Affiliate →
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToSection('services')}
                    className="text-stone-900 hover:text-[#9A3412] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Service Affiliate →
                  </button>
                  {canAccessCreatorAdmin && (
                    <button
                      type="button"
                      onClick={() => navigateToSection('studio')}
                      className="text-[#9A3412] hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Owner Backend →
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Shared Affiliate Product / Service Add & Edit Modal */}
      {isOfferModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-950/50 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-label="Affiliate Offering Composer"
          onClick={() => setIsOfferModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-xl"
          >
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-stone-200">
              <div>
                <div className="text-xs font-medium text-[#9A3412]">
                  Pickra Affiliate Marketing Catalog
                </div>
                <h2 className="font-serif text-xl font-medium text-stone-900">
                  {editingOfferId
                    ? 'Edit Affiliate Link'
                    : offerKind === 'service'
                    ? 'Post New Affiliate Professional Service'
                    : 'Post New Affiliate Product'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOfferModalOpen(false)}
                className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!user ? (
              <div className="pt-4">
                <AuthPanel
                  defaultMode="signin"
                  defaultAsSeller={false}
                  heading="Sign in to publish affiliate links"
                  subheading="Sign in with your Website Owner account to publish, edit, or remove affiliate product and service links."
                />
              </div>
            ) : !isCreatorAdmin ? (
              <div className="py-6 space-y-3">
                <p className="text-sm text-stone-600 leading-relaxed">
                  Posting affiliate marketing links on the Products and Services
                  pages is reserved for the website owner. Want to sell your own
                  physical or digital products and get paid? Open{' '}
                  <strong>Store &rarr; Sell on Pickra</strong>!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsOfferModalOpen(false);
                    navigateToSection('store', 'sell');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#9A3412] rounded-lg cursor-pointer"
                >
                  Go to Sell on Pickra →
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => void handleSaveAffiliateModalSubmit(e)}
                className="mt-4 space-y-4"
              >
                {offerModalError && (
                  <div className="px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900">
                    {offerModalError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Product or Service Title
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={140}
                    value={offerTitle}
                    onChange={(e) => setOfferTitle(e.target.value)}
                    placeholder="e.g., Keychron Q1 Max or Fiverr Pro Brand Identity Studio"
                    className="w-full px-3 py-2 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Listing Type
                    </label>
                    <select
                      value={offerKind}
                      onChange={(e) => {
                        const next = e.target.value as OfferKind;
                        setOfferKind(next);
                        if (
                          next === 'service' &&
                          !SERVICE_AFFILIATE_PLATFORMS.includes(offerPlatform)
                        ) {
                          setOfferPlatform('Fiverr');
                        } else if (
                          next !== 'service' &&
                          !PRODUCT_AFFILIATE_PLATFORMS.includes(offerPlatform)
                        ) {
                          setOfferPlatform('Amazon');
                        }
                      }}
                      className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    >
                      <option value="physical">Physical Product</option>
                      <option value="digital">Digital Product</option>
                      <option value="service">Professional Service</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Marketing Platform
                    </label>
                    <select
                      value={offerPlatform}
                      onChange={(e) =>
                        setOfferPlatform(e.target.value as AffiliatePlatform)
                      }
                      className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    >
                      {(offerKind === 'service'
                        ? SERVICE_AFFILIATE_PLATFORMS
                        : ALL_AFFILIATE_PLATFORMS
                      ).map((plat) => (
                        <option key={plat} value={plat}>
                          {plat}
                        </option>
                      ))}
                    </select>
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
                      placeholder="$149.00 or From $95"
                      className="w-full px-2.5 py-2 text-xs font-mono bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Category / Department
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={60}
                      value={offerCategory}
                      onChange={(e) => setOfferCategory(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Editorial Note (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      value={offerCommission}
                      onChange={(e) => setOfferCommission(e.target.value)}
                      placeholder="Top Rated · Instant Access"
                      className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="text-xs font-medium text-stone-700">
                      {offerKind === 'service'
                        ? 'Service Seller Affiliate Link (HTTPS — guides demanders to service page)'
                        : 'Primary Product Affiliate Link (HTTPS — guides buyers to target platform)'}
                    </label>
                    {(offerPlatform === 'Amazon' ||
                      offerPlatform === 'Digistore24') && (
                      <button
                        type="button"
                        onClick={handleAppendSavedTrackingTag}
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
                    placeholder={
                      offerKind === 'service'
                        ? 'https://www.fiverr.com/... or https://www.upwork.com/...'
                        : 'https://www.amazon.com/dp/... or https://www.digistore24.com/...'
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                <ImageUploadPicker
                  label="Image Attachment (Upload Photo, Paste URL, or Studio Preset)"
                  value={offerImageKey}
                  onChange={setOfferImageKey}
                  previewAspectClass="aspect-[16/9]"
                  compact
                />

                {/* Video Attachment (URL or Upload) */}
                <div className="p-3.5 bg-[#FBF9F5] border border-stone-200 rounded-xl space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-stone-700 inline-flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-[#9A3412]" />
                      <span>Video Attachment (Optional — Upload Clip or Paste URL)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-[#1C1917] hover:bg-[#9A3412] rounded cursor-pointer whitespace-nowrap">
                        <Upload className="w-3 h-3" />
                        <span>
                          {uploadingOfferVideo ? 'Uploading...' : 'Upload Video'}
                        </span>
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime"
                          onChange={(e) => void handleOfferVideoFileChange(e)}
                          className="hidden"
                        />
                      </label>
                      {offerVideoUrl && (
                        <button
                          type="button"
                          onClick={() => setOfferVideoUrl('')}
                          className="text-[11px] text-red-700 hover:underline cursor-pointer"
                        >
                          Remove Video
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
                    placeholder={
                      offerVideoUrl.startsWith('data:video/')
                        ? 'Uploaded video file attached — paste a URL to replace'
                        : 'https://www.youtube.com/watch?v=... or Vimeo / Loom / .mp4 link'
                    }
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                  {offerVideoUrl && (
                    <VideoEmbedFigure url={offerVideoUrl} compact />
                  )}
                </div>

                {/* Rich Text Description & Affiliate Links Box */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-xs font-medium text-stone-700">
                      Description &amp; Affiliate Links Box (Paste links or insert clickable hyperlinks)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowDescLinkHelper((v) => !v)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#9A3412] hover:underline cursor-pointer"
                    >
                      <Link2 className="w-3 h-3" />
                      <span>
                        {showDescLinkHelper
                          ? 'Close Link Helper'
                          : '+ Insert Hyperlink'}
                      </span>
                    </button>
                  </div>

                  {showDescLinkHelper && (
                    <div className="p-3 bg-[#FBF9F5] border border-stone-300 rounded-lg grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        value={descLinkLabel}
                        onChange={(e) => setDescLinkLabel(e.target.value)}
                        placeholder="Link text (e.g. Buy on Amazon)"
                        className="sm:col-span-4 px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded"
                      />
                      <input
                        type="url"
                        value={descLinkUrl}
                        onChange={(e) => setDescLinkUrl(e.target.value)}
                        placeholder="https://www.amazon.com/... or https://www.fiverr.com/..."
                        className="sm:col-span-6 px-2.5 py-1.5 text-xs font-mono bg-white border border-stone-300 rounded"
                      />
                      <button
                        type="button"
                        onClick={handleInsertHyperlinkIntoSummary}
                        className="sm:col-span-2 px-3 py-1.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded cursor-pointer whitespace-nowrap"
                      >
                        Insert
                      </button>
                    </div>
                  )}

                  <textarea
                    rows={4}
                    required
                    minLength={10}
                    maxLength={2500}
                    value={offerSummary}
                    onChange={(e) => setOfferSummary(e.target.value)}
                    placeholder="Write description and paste digital/physical product or service affiliate links directly (e.g. https://... or use + Insert Hyperlink so buyers click straight through to the platform)..."
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Key Highlights (up to 4 lines)
                  </label>
                  <textarea
                    rows={2}
                    value={offerHighlightsText}
                    onChange={(e) => setOfferHighlightsText(e.target.value)}
                    placeholder={'Verified quality\nFast turnaround'}
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-200">
                  <button
                    type="button"
                    onClick={() => setIsOfferModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-stone-600 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingOffer}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] disabled:bg-stone-300 rounded-lg transition-colors cursor-pointer"
                  >
                    {savingOffer
                      ? 'Saving...'
                      : editingOfferId
                      ? 'Save Changes'
                      : 'Publish Affiliate Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Slide-Over Store Shopping Bag & Promo Checkout Drawer */}
      <ShoppingBagDrawer
        onNavigateToPurchases={() => navigateToSection('store', 'purchases')}
      />

      {/* Global Create Account / Sign In Modal */}
      <AuthModal />

      {/* Quiet Archival Footer */}
      <footer className="border-t border-stone-200/90 bg-[#F5F2EB] mt-12">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <span className="font-serif text-lg font-semibold text-stone-900">
              Pickra
            </span>
            <p className="mt-1.5 text-xs text-stone-600 leading-relaxed">
              {siteConfig.siteTagline}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-stone-600">
            <button
              type="button"
              onClick={() => navigateToSection('blog')}
              className="hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
            >
              Blog
            </button>
            <button
              type="button"
              onClick={() => openBlockEditorForPost(null)}
              className="hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
            >
              Write Blog
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('store')}
              className="hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
            >
              Store
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('store', 'sell')}
              className="hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
            >
              Sell on Pickra
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('products')}
              className="hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
            >
              Product Affiliate
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('services')}
              className="hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
            >
              Service Affiliate
            </button>
            {canAccessCreatorAdmin && (
              <button
                type="button"
                onClick={() => navigateToSection('studio')}
                className="hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
              >
                Backend
              </button>
            )}
            {!user ? (
              <button
                type="button"
                onClick={() => openAuthModal('signup', true)}
                className="font-semibold text-[#9A3412] hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
              >
                Create Account / Sign In
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="font-medium text-stone-700 hover:text-[#9A3412] cursor-pointer whitespace-nowrap shrink-0"
              >
                Sign Out (
                {profile?.displayName ||
                  user.email?.split('@')[0] ||
                  'Account'}
                )
              </button>
            )}
            <span className="text-stone-400 whitespace-nowrap shrink-0">
              © {new Date().getFullYear()} Pickra
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <PickraShell />
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
