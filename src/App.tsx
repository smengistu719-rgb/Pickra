import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Camera,
  Edit3,
  Link2,
  Lock,
  PenSquare,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  Upload,
  UserCheck,
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
  BLOG_THEME_PALETTES,
  BlogPost,
  ContactIssueCategory,
  DirectProduct,
  OfferKind,
  PostCategory,
  PublishStatus,
} from './types';
import {
  compressImageFileToDataUrl,
  readCompactVideoFileToDataUrl,
} from './firebase';
import { ResilientImage } from './components/ResilientImage';
import { OfferCard } from './components/OfferCard';
import { DirectStorefront, StoreSubView } from './components/DirectStorefront';
import { ShoppingBagDrawer } from './components/ShoppingBagDrawer';
import { ArticleReader } from './components/ArticleReader';
import { PublisherStudio } from './components/PublisherStudio';
import { MediumBlockEditor } from './components/MediumBlockEditor';
import { ImageUploadPicker } from './components/ImageUploadPicker';
import { VideoEmbedFigure } from './components/EditorialRichBlocks';
import { AuthModal } from './components/AuthModal';
import { EditableDropdownSelect } from './components/EditableDropdownSelect';
import { EditableSectionHeader } from './components/EditableSectionHeader';
import {
  AboutUsPage,
  ContactUsPage,
  PrivacyAndLegalPage,
} from './components/InfoPages';

function resolveInitialSection(): ActiveSection {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('post')) {
      return 'blog';
    }
    const pathSegment = window.location.pathname
      .replace(/^\/+|\/+$/g, '')
      .split('/')[0]
      ?.toLowerCase();
    const sec = (params.get('section') || pathSegment || '').toLowerCase();
    if (
      sec === 'blog' ||
      sec === 'journal' ||
      sec === 'store' ||
      sec === 'shop' ||
      sec === 'products' ||
      sec === 'services' ||
      sec === 'about' ||
      sec === 'contact' ||
      sec === 'privacy' ||
      sec === 'write' ||
      sec === 'studio'
    ) {
      if (sec === 'journal') return 'blog';
      if (sec === 'shop') return 'store';
      return sec as ActiveSection;
    }
    if (params.get('promo')) {
      return 'store';
    }
  } catch {
    // ignore URL parsing errors
  }
  return 'blog';
}

function resolveInitialPostRef(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const postParam = params.get('post')?.trim();
    return postParam || null;
  } catch {
    return null;
  }
}

function PickraShell() {
  const {
    user,
    authReady,
    adminRoleReady,
    loadingPosts,
    loadingOffers,
    publicDataError,
    retryPublicData,
    isCreatorAdmin,
    isActiveSeller,
    profile,
    privateInfo,
    siteConfig,
    publishedPosts,
    publishedOffers,
    cartCount,
    setIsCartOpen,
    openAuthModal,
    signOutUser,
    saveOffer,
    deleteOffer,
    deletePost,
    updateOfferImage,
    updatePostCoverImage,
    dropdownOptions,
    addDropdownOption,
    renameDropdownOption,
    deleteDropdownOption,
    sectionHeaders,
    saveSectionHeader,
    resetSectionHeader,
  } = useFirebaseApp();

  const canAccessCreatorAdmin = Boolean(
    user &&
      !user.isAnonymous &&
      (isCreatorAdmin ||
        (user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() &&
          user.emailVerified))
  );

  // Allow owner with unverified email to reach the Backend gate screen to verify
  const canOpenBackendGate = Boolean(
    canAccessCreatorAdmin ||
      (user &&
        !user.isAnonymous &&
        user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase())
  );

  const blogModuleEnabled = siteConfig.blogEnabled !== false;
  const storeModuleEnabled = siteConfig.storeEnabled !== false;
  const productAffiliateModuleEnabled =
    siteConfig.productAffiliateEnabled !== false;
  const serviceAffiliateModuleEnabled =
    siteConfig.serviceAffiliateEnabled !== false;

  const [activeSection, setActiveSection] = useState<ActiveSection>(
    resolveInitialSection
  );
  const [contactPresetCategory, setContactPresetCategory] =
    useState<ContactIssueCategory>('general');
  const [storeSubView, setStoreSubView] = useState<StoreSubView>('catalog');
  const [pendingStoreEditProduct, setPendingStoreEditProduct] =
    useState<DirectProduct | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(
    resolveInitialPostRef
  );
  const [storyBeingEdited, setStoryBeingEdited] = useState<BlogPost | null>(
    null
  );
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(
    null
  );
  const [uploadingPostPhotoId, setUploadingPostPhotoId] = useState<
    string | null
  >(null);

  // Blog filters
  const [blogCategory, setBlogCategory] = useState<'All' | PostCategory>('All');
  const [blogSearch, setBlogSearch] = useState('');

  // Product Affiliate page filters
  const [productKindFilter, setProductKindFilter] = useState<
    'all' | 'physical' | 'digital'
  >('all');
  const [productPlatformFilter, setProductPlatformFilter] = useState<
    'All' | AffiliatePlatform
  >('All');
  const [productSearch, setProductSearch] = useState('');

  // Service Affiliate page filters
  const [servicePlatformFilter, setServicePlatformFilter] = useState<
    'All' | AffiliatePlatform
  >('All');
  const [serviceSearch, setServiceSearch] = useState('');

  // Module-Scoped Affiliate Modal ('products' vs 'services') — Admin Only
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerModalModule, setOfferModalModule] = useState<
    'products' | 'services'
  >('products');
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
    return (
      publishedPosts.find(
        (p) => p.id === selectedPostId || p.slug === selectedPostId
      ) || null
    );
  }, [selectedPostId, publishedPosts]);

  const leadPost = publishedPosts[0] || null;

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

  const totalPublishedProductOffers = useMemo(
    () => publishedOffers.filter((offer) => offer.kind !== 'service').length,
    [publishedOffers]
  );

  const totalPublishedServiceOffers = useMemo(
    () => publishedOffers.filter((offer) => offer.kind === 'service').length,
    [publishedOffers]
  );

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

  const firstEnabledPublicSection = useMemo<ActiveSection>(() => {
    if (blogModuleEnabled) return 'blog';
    if (storeModuleEnabled) return 'store';
    if (productAffiliateModuleEnabled) return 'products';
    if (serviceAffiliateModuleEnabled) return 'services';
    return 'blog';
  }, [
    blogModuleEnabled,
    storeModuleEnabled,
    productAffiliateModuleEnabled,
    serviceAffiliateModuleEnabled,
  ]);

  useEffect(() => {
    if (!authReady || !adminRoleReady) return;
    if (activeSection === 'studio' && !canOpenBackendGate) {
      setActiveSection(firstEnabledPublicSection);
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
    if (activeSection === 'write' && !canAccessCreatorAdmin) {
      setActiveSection(firstEnabledPublicSection);
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('section') === 'write') {
          url.searchParams.delete('section');
          window.history.replaceState({}, '', url.toString());
        }
      } catch {
        // ignore URL history errors
      }
    }
  }, [
    authReady,
    adminRoleReady,
    activeSection,
    canOpenBackendGate,
    canAccessCreatorAdmin,
    firstEnabledPublicSection,
  ]);

  useEffect(() => {
    if (!canAccessCreatorAdmin && isOfferModalOpen) {
      setIsOfferModalOpen(false);
    }
  }, [canAccessCreatorAdmin, isOfferModalOpen]);

  function syncPublicUrlState(
    nextSection: ActiveSection,
    nextPostSlugOrId: string | null = null
  ) {
    try {
      const url = new URL(window.location.href);
      if (nextPostSlugOrId) {
        url.searchParams.delete('section');
        url.searchParams.set('post', nextPostSlugOrId);
      } else {
        url.searchParams.delete('post');
        if (nextSection === 'blog' || nextSection === 'journal') {
          url.searchParams.delete('section');
        } else if (nextSection !== 'studio' && nextSection !== 'write') {
          url.searchParams.set('section', nextSection);
        }
      }
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore URL history errors
    }
  }

  function navigateToSection(
    section: ActiveSection,
    targetStoreSubView: StoreSubView = 'catalog'
  ) {
    setSelectedPostId(null);
    if (section === 'studio' && !canOpenBackendGate) {
      setActiveSection(firstEnabledPublicSection);
      syncPublicUrlState(firstEnabledPublicSection, null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (section === 'write') {
      if (!canAccessCreatorAdmin) {
        setActiveSection(firstEnabledPublicSection);
        syncPublicUrlState(firstEnabledPublicSection, null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setStoryBeingEdited(null);
    }
    if (section === 'store') {
      setStoreSubView(targetStoreSubView);
    }
    const resolved = section === 'journal' ? 'blog' : section;
    setActiveSection(resolved);
    syncPublicUrlState(resolved, null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openContactPage(category: ContactIssueCategory = 'general') {
    setContactPresetCategory(category);
    navigateToSection('contact');
  }

  function openPost(post: BlogPost) {
    setSelectedPostId(post.id);
    setActiveSection('blog');
    syncPublicUrlState('blog', post.slug || post.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openBlockEditorForPost(post?: BlogPost | null) {
    if (!canAccessCreatorAdmin) return;
    setStoryBeingEdited(post || null);
    setSelectedPostId(null);
    setActiveSection('write');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handlePostCoverUpload(
    postId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    if (!canAccessCreatorAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPostPhotoId(postId);
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      await updatePostCoverImage(postId, dataUrl);
    } finally {
      setUploadingPostPhotoId(null);
      e.target.value = '';
    }
  }

  function openNewAffiliateModal(targetModule: 'products' | 'services') {
    if (!canAccessCreatorAdmin) return;
    const defaultKind: OfferKind =
      targetModule === 'services' ? 'service' : 'physical';
    const defaultPlat =
      targetModule === 'services'
        ? dropdownOptions.servicePlatforms[0] || 'Fiverr'
        : dropdownOptions.productPlatforms[0] || 'Amazon';
    const defaultCat =
      targetModule === 'services'
        ? 'Specialist Services'
        : dropdownOptions.affiliateCategories[0] || 'Studio Hardware';
    setOfferModalModule(targetModule);
    setEditingOfferId(undefined);
    setOfferTitle('');
    setOfferKind(defaultKind);
    setOfferPlatform(defaultPlat);
    setOfferCategory(defaultCat);
    setOfferPrice(targetModule === 'services' ? 'From $120' : '$149.00');
    setOfferCommission('');
    setOfferUrl('');
    setOfferImageKey(targetModule === 'services' ? 'freelance' : 'audio');
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
    if (!canAccessCreatorAdmin) return;
    setOfferModalModule(offer.kind === 'service' ? 'services' : 'products');
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
    const cleanLabel = (
      descLinkLabel.trim() ||
      (offerModalModule === 'services' ? 'View Service' : 'View Product')
    ).replace(/[\[\]]/g, '');
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
        'Save your default Amazon Tag or Digistore24 ID in Backend -> Website Settings first.'
      );
    } catch {
      setOfferModalError('Please enter a valid HTTPS URL first.');
    }
  }

  async function handleSaveAffiliateModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canAccessCreatorAdmin) return;
    setSavingOffer(true);
    setOfferModalError(null);
    try {
      const enforcedKind: OfferKind =
        offerModalModule === 'services'
          ? 'service'
          : offerKind === 'digital'
          ? 'digital'
          : 'physical';
      const highlights = offerHighlightsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 4);
      const input: OfferDraftInput = {
        id: editingOfferId,
        title: offerTitle,
        kind: enforcedKind,
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

  function renderPausedModuleNotice(moduleTitle: string) {
    return (
      <section className="max-w-[760px] mx-auto px-5 sm:px-8 py-16 text-center">
        <div className="bg-white border border-stone-200/90 rounded-2xl p-8 sm:p-10 space-y-4">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9A3412]">
            <Lock className="w-3.5 h-3.5" />
            <span>Module Paused by Website Administrator</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-medium text-stone-900">
            {moduleTitle} is temporarily unavailable
          </h1>
          <p className="text-sm text-stone-600 leading-relaxed">
            This module is currently paused for maintenance or curation. Please
            explore the other active Pickra sections above.
          </p>
          {firstEnabledPublicSection !== activeSection && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigateToSection(firstEnabledPublicSection)}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg cursor-pointer"
              >
                Explore Active Sections
              </button>
            </div>
          )}
        </div>
      </section>
    );
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

      {/* Strict 3-Zone Top Bar Contract — Independent Navigation Per Module */}
      <header className="md:sticky md:top-0 z-30 bg-[#FBF9F5]/95 backdrop-blur-xs border-b border-stone-200/90">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-8 px-5 sm:px-8 py-4">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#pickra"
            onClick={(e) => {
              e.preventDefault();
              navigateToSection(firstEnabledPublicSection);
            }}
            className="font-serif text-xl font-semibold tracking-tight text-stone-900 whitespace-nowrap shrink-0"
          >
            Pickra
          </a>

          {/* Zone 2: Independent Module Navigation Links */}
          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600"
          >
            {(blogModuleEnabled || canAccessCreatorAdmin) && (
              <button
                type="button"
                onClick={() => navigateToSection('blog')}
                className={`py-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isBlogSection || activeSection === 'write'
                    ? 'border-[#9A3412] text-stone-900'
                    : 'border-transparent hover:text-stone-900'
                }`}
              >
                Blog{!blogModuleEnabled ? ' (Paused)' : ''}
              </button>
            )}
            {(storeModuleEnabled || canAccessCreatorAdmin) && (
              <button
                type="button"
                onClick={() => navigateToSection('store')}
                className={`py-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeSection === 'store'
                    ? 'border-[#9A3412] text-stone-900'
                    : 'border-transparent hover:text-stone-900'
                }`}
              >
                Store{!storeModuleEnabled ? ' (Paused)' : ''}
              </button>
            )}
            {(productAffiliateModuleEnabled || canAccessCreatorAdmin) && (
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
                {!productAffiliateModuleEnabled ? ' (Paused)' : ''}
              </button>
            )}
            {(serviceAffiliateModuleEnabled || canAccessCreatorAdmin) && (
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
                {!serviceAffiliateModuleEnabled ? ' (Paused)' : ''}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigateToSection('about')}
              className={`py-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeSection === 'about'
                  ? 'border-[#9A3412] text-stone-900'
                  : 'border-transparent hover:text-stone-900'
              }`}
            >
              About Us
            </button>
            <button
              type="button"
              onClick={() => openContactPage('general')}
              className={`py-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeSection === 'contact' || activeSection === 'privacy'
                  ? 'border-[#9A3412] text-stone-900'
                  : 'border-transparent hover:text-stone-900'
              }`}
            >
              Contact Us
            </button>
            {canOpenBackendGate && (
              <button
                type="button"
                onClick={() => navigateToSection('studio')}
                className={`py-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeSection === 'studio'
                    ? 'border-[#9A3412] text-stone-900'
                    : 'border-transparent hover:text-stone-900'
                }`}
              >
                Admin
              </button>
            )}
          </nav>

          {/* Zone 3: Role-Appropriate Primary Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            {storeModuleEnabled && activeSection === 'store' && (
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-800 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>Bag ({cartCount})</span>
              </button>
            )}

            {canAccessCreatorAdmin ? (
              <button
                type="button"
                onClick={() => openBlockEditorForPost(null)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <PenSquare className="w-3.5 h-3.5" />
                <span>Write Blog</span>
              </button>
            ) : !user || user.isAnonymous ? (
              <button
                type="button"
                onClick={() => openAuthModal('signin', false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>Sign In</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  navigateToSection(
                    'store',
                    isActiveSeller ? 'sell' : 'purchases'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <UserCheck className="w-3.5 h-3.5 text-[#9A3412]" />
                <span className="max-w-[140px] truncate">
                  {profile?.displayName ||
                    user.email?.split('@')[0] ||
                    'Account'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Secondary Row */}
        <div className="flex md:hidden items-center justify-around gap-3 overflow-x-auto border-t border-stone-200/70 px-4 py-2.5 text-xs font-medium text-stone-600">
          {(blogModuleEnabled || canAccessCreatorAdmin) && (
            <button
              type="button"
              onClick={() => navigateToSection('blog')}
              className={`whitespace-nowrap shrink-0 ${
                isBlogSection ? 'text-[#9A3412] font-semibold' : ''
              }`}
            >
              Blog
            </button>
          )}
          {(storeModuleEnabled || canAccessCreatorAdmin) && (
            <button
              type="button"
              onClick={() => navigateToSection('store')}
              className={`whitespace-nowrap shrink-0 ${
                activeSection === 'store' ? 'text-[#9A3412] font-semibold' : ''
              }`}
            >
              Store
            </button>
          )}
          {(productAffiliateModuleEnabled || canAccessCreatorAdmin) && (
            <button
              type="button"
              onClick={() => navigateToSection('products')}
              className={`whitespace-nowrap shrink-0 ${
                activeSection === 'products'
                  ? 'text-[#9A3412] font-semibold'
                  : ''
              }`}
            >
              Product Affiliate
            </button>
          )}
          {(serviceAffiliateModuleEnabled || canAccessCreatorAdmin) && (
            <button
              type="button"
              onClick={() => navigateToSection('services')}
              className={`whitespace-nowrap shrink-0 ${
                activeSection === 'services'
                  ? 'text-[#9A3412] font-semibold'
                  : ''
              }`}
            >
              Service Affiliate
            </button>
          )}
          <button
            type="button"
            onClick={() => navigateToSection('about')}
            className={`whitespace-nowrap shrink-0 ${
              activeSection === 'about' ? 'text-[#9A3412] font-semibold' : ''
            }`}
          >
            About Us
          </button>
          <button
            type="button"
            onClick={() => openContactPage('general')}
            className={`whitespace-nowrap shrink-0 ${
              activeSection === 'contact' ? 'text-[#9A3412] font-semibold' : ''
            }`}
          >
            Contact Us
          </button>
          <button
            type="button"
            onClick={() => navigateToSection('privacy')}
            className={`whitespace-nowrap shrink-0 ${
              activeSection === 'privacy' ? 'text-[#9A3412] font-semibold' : ''
            }`}
          >
            Privacy
          </button>
          {canAccessCreatorAdmin && (
            <button
              type="button"
              onClick={() => openBlockEditorForPost(null)}
              className={`whitespace-nowrap shrink-0 ${
                activeSection === 'write' ? 'text-[#9A3412] font-semibold' : ''
              }`}
            >
              Write
            </button>
          )}
          {canOpenBackendGate && (
            <button
              type="button"
              onClick={() => navigateToSection('studio')}
              className={`whitespace-nowrap shrink-0 ${
                activeSection === 'studio' ? 'text-[#9A3412] font-semibold' : ''
              }`}
            >
              Admin
            </button>
          )}
        </div>
      </header>

      {/* Main Content — 4 Completely Independent Modules + Admin Console */}
      <main className="flex-1">
        {activeSection === 'write' && canAccessCreatorAdmin ? (
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
        ) : activeSection === 'studio' && canOpenBackendGate ? (
          <PublisherStudio
            onOpenPublishedPost={openPost}
            onOpenBlockEditor={openBlockEditorForPost}
            onOpenDirectStore={() => navigateToSection('store')}
          />
        ) : activeSection === 'store' ? (
          !storeModuleEnabled && !canAccessCreatorAdmin ? (
            renderPausedModuleNotice('Pickra Store')
          ) : (
            <DirectStorefront
              key={storeSubView}
              initialSubView={storeSubView}
              initialEditProduct={pendingStoreEditProduct}
              onConsumeInitialEditProduct={() =>
                setPendingStoreEditProduct(null)
              }
              onOpenPrivacy={() => navigateToSection('privacy')}
              onOpenContactSupport={() => openContactPage('seller_payout')}
            />
          )
        ) : activeSection === 'products' ? (
          !productAffiliateModuleEnabled && !canAccessCreatorAdmin ? (
            renderPausedModuleNotice('Product Affiliate')
          ) : (
            /* ===============================================================
               MODULE 3: PRODUCT AFFILIATE (PHYSICAL & DIGITAL PARTNER LINKS)
               =============================================================== */
            <section className="max-w-[1200px] mx-auto px-5 sm:px-8 py-10 sm:py-14">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <EditableSectionHeader
                  copy={sectionHeaders.productAffiliateMasthead}
                  onSave={(nextCopy) =>
                    saveSectionHeader('productAffiliateMasthead', nextCopy)
                  }
                  onReset={() => resetSectionHeader('productAffiliateMasthead')}
                  level="h1"
                  className="max-w-3xl"
                  canEdit={canAccessCreatorAdmin}
                />

                {canAccessCreatorAdmin && (
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start lg:self-auto">
                    <button
                      type="button"
                      onClick={() => openNewAffiliateModal('products')}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Product Affiliate</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Filter Toolbar */}
              <div className="mt-8 flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-6 border-b border-stone-200">
                <div className="flex flex-wrap items-start gap-3">
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

                  <EditableDropdownSelect
                    ariaLabel="Filter by affiliate platform"
                    value={productPlatformFilter}
                    options={dropdownOptions.productPlatforms}
                    prefixOptions={[
                      { value: 'All', label: 'All Marketing Platforms' },
                    ]}
                    onChange={(val) =>
                      setProductPlatformFilter(val as 'All' | AffiliatePlatform)
                    }
                    onAddOption={(opt) =>
                      addDropdownOption('productPlatforms', opt)
                    }
                    onRenameOption={(oldOpt, nextOpt) => {
                      renameDropdownOption('productPlatforms', oldOpt, nextOpt);
                      if (productPlatformFilter === oldOpt) {
                        setProductPlatformFilter(nextOpt);
                      }
                    }}
                    onDeleteOption={(opt) =>
                      deleteDropdownOption('productPlatforms', opt)
                    }
                    placeholder="Platform..."
                    compact
                    canEdit={canAccessCreatorAdmin}
                    selectClassName="px-3 py-2 text-xs font-medium bg-white border border-stone-200 rounded-lg text-stone-700 focus:outline-none focus:border-[#9A3412]"
                  />
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

              {loadingOffers && totalPublishedProductOffers === 0 ? (
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-7">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-72 rounded-xl bg-[#F3EFE8] border border-stone-200/70 animate-pulse"
                    />
                  ))}
                </div>
              ) : totalPublishedProductOffers === 0 ? (
                <div className="mt-8 py-14 px-6 bg-white border border-stone-200/90 rounded-2xl text-center space-y-3">
                  <p className="font-serif text-lg font-medium text-stone-900">
                    No Product Affiliate recommendations are published yet
                  </p>
                  <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed">
                    Curated partner hardware and digital tool recommendations
                    will appear here once published.
                  </p>
                  {canAccessCreatorAdmin && (
                    <button
                      type="button"
                      onClick={() => openNewAffiliateModal('products')}
                      className="mt-2 px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg cursor-pointer"
                    >
                      + Add Affiliate Product
                    </button>
                  )}
                </div>
              ) : filteredProducts.length === 0 ? (
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
                    {canAccessCreatorAdmin && (
                      <button
                        type="button"
                        onClick={() => openNewAffiliateModal('products')}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-[#1C1917] rounded-lg cursor-pointer"
                      >
                        + Add Affiliate Product
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                  {filteredProducts.map((offer: AffiliateOffer) => (
                    <div key={offer.id} className="flex flex-col">
                      <OfferCard
                        offer={offer}
                        variant="grid"
                        onEdit={
                          canAccessCreatorAdmin
                            ? openEditAffiliateModal
                            : undefined
                        }
                        onChangeImage={
                          canAccessCreatorAdmin
                            ? (targetOffer, nextImg) => {
                                void updateOfferImage(targetOffer.id, nextImg);
                              }
                            : undefined
                        }
                        onDelete={
                          canAccessCreatorAdmin
                            ? (targetOffer) => {
                                void deleteOffer(targetOffer.id);
                              }
                            : undefined
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
        ) : activeSection === 'services' ? (
          !serviceAffiliateModuleEnabled && !canAccessCreatorAdmin ? (
            renderPausedModuleNotice('Service Affiliate')
          ) : (
            /* ===============================================================
               MODULE 4: SERVICE AFFILIATE (PROFESSIONAL SERVICE LINKS ONLY)
               =============================================================== */
            <section className="max-w-[1200px] mx-auto px-5 sm:px-8 py-10 sm:py-14">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <EditableSectionHeader
                  copy={sectionHeaders.serviceAffiliateMasthead}
                  onSave={(nextCopy) =>
                    saveSectionHeader('serviceAffiliateMasthead', nextCopy)
                  }
                  onReset={() => resetSectionHeader('serviceAffiliateMasthead')}
                  level="h1"
                  className="max-w-3xl"
                  canEdit={canAccessCreatorAdmin}
                />

                {canAccessCreatorAdmin && (
                  <button
                    type="button"
                    onClick={() => openNewAffiliateModal('services')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start lg:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Service Affiliate</span>
                  </button>
                )}
              </div>

              <div className="mt-8 flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-6 border-b border-stone-200">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#F3EFE8] rounded-lg">
                    {['All', ...dropdownOptions.servicePlatforms.slice(0, 4)].map(
                      (plat) => (
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
                      )
                    )}
                  </div>

                  <EditableDropdownSelect
                    ariaLabel="Filter all service networks"
                    value={servicePlatformFilter}
                    options={dropdownOptions.servicePlatforms}
                    prefixOptions={[
                      { value: 'All', label: 'All Service Networks' },
                    ]}
                    onChange={(val) =>
                      setServicePlatformFilter(val as 'All' | AffiliatePlatform)
                    }
                    onAddOption={(opt) =>
                      addDropdownOption('servicePlatforms', opt)
                    }
                    onRenameOption={(oldOpt, nextOpt) => {
                      renameDropdownOption('servicePlatforms', oldOpt, nextOpt);
                      if (servicePlatformFilter === oldOpt) {
                        setServicePlatformFilter(nextOpt);
                      }
                    }}
                    onDeleteOption={(opt) =>
                      deleteDropdownOption('servicePlatforms', opt)
                    }
                    placeholder="Service network..."
                    compact
                    canEdit={canAccessCreatorAdmin}
                    selectClassName="px-3 py-2 text-xs font-medium bg-white border border-stone-200 rounded-lg text-stone-700 focus:outline-none focus:border-[#9A3412]"
                  />
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

              {loadingOffers && totalPublishedServiceOffers === 0 ? (
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-7">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-72 rounded-xl bg-[#F3EFE8] border border-stone-200/70 animate-pulse"
                    />
                  ))}
                </div>
              ) : totalPublishedServiceOffers === 0 ? (
                <div className="mt-8 py-14 px-6 bg-white border border-stone-200/90 rounded-2xl text-center space-y-3">
                  <p className="font-serif text-lg font-medium text-stone-900">
                    No Service Affiliate listings are published yet
                  </p>
                  <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed">
                    Recommended specialist services and partner agencies will
                    appear here once published.
                  </p>
                  {canAccessCreatorAdmin && (
                    <button
                      type="button"
                      onClick={() => openNewAffiliateModal('services')}
                      className="mt-2 px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg cursor-pointer"
                    >
                      + Add Affiliate Service
                    </button>
                  )}
                </div>
              ) : filteredServices.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm text-stone-600">
                    No professional services match your current filter
                    selection.
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
                    {canAccessCreatorAdmin && (
                      <button
                        type="button"
                        onClick={() => openNewAffiliateModal('services')}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-[#1C1917] rounded-lg cursor-pointer"
                      >
                        + Add Affiliate Service
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                  {filteredServices.map((offer) => (
                    <div key={offer.id} className="flex flex-col">
                      <OfferCard
                        offer={offer}
                        variant="grid"
                        onEdit={
                          canAccessCreatorAdmin
                            ? openEditAffiliateModal
                            : undefined
                        }
                        onChangeImage={
                          canAccessCreatorAdmin
                            ? (targetOffer, nextImg) => {
                                void updateOfferImage(targetOffer.id, nextImg);
                              }
                            : undefined
                        }
                        onDelete={
                          canAccessCreatorAdmin
                            ? (targetOffer) => {
                                void deleteOffer(targetOffer.id);
                              }
                            : undefined
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
        ) : activeSection === 'about' ? (
          <AboutUsPage
            canAccessCreatorAdmin={canAccessCreatorAdmin}
            onNavigateSection={navigateToSection}
            onOpenContactWithCategory={openContactPage}
          />
        ) : activeSection === 'contact' ? (
          <ContactUsPage
            canAccessCreatorAdmin={canAccessCreatorAdmin}
            initialCategory={contactPresetCategory}
            onNavigateSection={navigateToSection}
          />
        ) : activeSection === 'privacy' ? (
          <PrivacyAndLegalPage
            canAccessCreatorAdmin={canAccessCreatorAdmin}
            onOpenContactWithCategory={openContactPage}
          />
        ) : !blogModuleEnabled && !canAccessCreatorAdmin ? (
          renderPausedModuleNotice('Pickra Blog')
        ) : selectedPost && isBlogSection ? (
          <ArticleReader
            post={selectedPost}
            onBack={() => {
              setSelectedPostId(null);
              syncPublicUrlState('blog', null);
            }}
            onSelectPost={openPost}
            onEditInEditor={
              canAccessCreatorAdmin ? openBlockEditorForPost : undefined
            }
            onChangeCoverImage={
              canAccessCreatorAdmin
                ? (p, nextImage) => {
                    void updatePostCoverImage(p.id, nextImage);
                  }
                : undefined
            }
            onDeletePost={
              canAccessCreatorAdmin
                ? async (p) => {
                    await deletePost(p.id);
                    setSelectedPostId(null);
                  }
                : undefined
            }
          />
        ) : (
          /* ===============================================================
             MODULE 1: BLOG PAGE (PURE EDITORIAL — NO STORE/AFFILIATE MIXING)
             =============================================================== */
          <div>
            {publicDataError && (
              <div className="max-w-[1200px] mx-auto px-5 sm:px-8 pt-6">
                <div
                  role="alert"
                  className="p-4 bg-red-50 border border-red-200 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs text-red-900"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                    <span>{publicDataError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={retryPublicData}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Loading Blog</span>
                  </button>
                </div>
              </div>
            )}

            {/* SECTION 1: Lead Blog Story Hero */}
            {loadingPosts && publishedPosts.length === 0 ? (
              <section
                aria-live="polite"
                className="max-w-[1200px] mx-auto px-5 sm:px-8 pt-8 sm:pt-12 pb-12 border-b border-stone-200/90"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch animate-pulse">
                  <div className="lg:col-span-6 space-y-4 py-4">
                    <div className="h-3 w-48 bg-[#F3EFE8] rounded" />
                    <div className="h-10 w-5/6 bg-[#F3EFE8] rounded" />
                    <div className="h-4 w-full bg-[#F3EFE8] rounded" />
                    <div className="h-4 w-3/4 bg-[#F3EFE8] rounded" />
                    <div className="h-10 w-40 bg-[#F3EFE8] rounded-lg mt-6" />
                  </div>
                  <div className="lg:col-span-6 min-h-[280px] rounded-xl bg-[#F3EFE8]" />
                </div>
              </section>
            ) : leadPost ? (
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

                      {canAccessCreatorAdmin && (
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                          <label className="inline-flex items-center gap-1 font-medium text-stone-700 hover:text-[#9A3412] cursor-pointer whitespace-nowrap">
                            <Camera className="w-3.5 h-3.5 text-[#9A3412]" />
                            <span>
                              {uploadingPostPhotoId === leadPost.id
                                ? 'Updating...'
                                : 'Change Photo'}
                            </span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              onChange={(e) =>
                                void handlePostCoverUpload(leadPost.id, e)
                              }
                              className="hidden"
                            />
                          </label>
                          <span className="text-stone-300" aria-hidden="true">
                            ·
                          </span>
                          <button
                            type="button"
                            onClick={() => openBlockEditorForPost(leadPost)}
                            className="inline-flex items-center gap-1 font-medium text-stone-700 hover:text-[#9A3412] cursor-pointer whitespace-nowrap"
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
                              className="inline-flex items-center gap-1 text-stone-500 hover:text-red-700 cursor-pointer whitespace-nowrap"
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
                        <a
                          href={`?post=${encodeURIComponent(
                            leadPost.slug || leadPost.id
                          )}`}
                          onClick={(e) => {
                            e.preventDefault();
                            openPost(leadPost);
                          }}
                          className="inline-flex items-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <span>Read Full Article</span>
                          <ArrowRight className="w-4 h-4" />
                        </a>

                        {canAccessCreatorAdmin && (
                          <button
                            type="button"
                            onClick={() => openBlockEditorForPost(null)}
                            className="inline-flex items-center gap-1.5 px-4 py-3 text-xs font-semibold text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <PenSquare className="w-3.5 h-3.5 text-[#9A3412]" />
                            <span>Write New Blog</span>
                          </button>
                        )}
                      </div>

                      <span className="text-xs text-stone-500">
                        By {leadPost.authorName || 'Pickra Editorial'}
                      </span>
                    </div>
                  </div>

                  <div
                    onClick={() => openPost(leadPost)}
                    className="relative lg:col-span-6 rounded-xl overflow-hidden bg-[#F3EFE8] border border-stone-200/80 cursor-pointer group min-h-[280px]"
                  >
                    <ResilientImage
                      imageKey={leadPost.coverImageKey}
                      alt={leadPost.title}
                      fallbackLabel={leadPost.title}
                      className="w-full h-full lg:h-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
                    />
                    {canAccessCreatorAdmin && (
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-stone-900/85 hover:bg-[#9A3412] rounded-lg shadow-xs cursor-pointer whitespace-nowrap transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>
                          {uploadingPostPhotoId === leadPost.id
                            ? 'Uploading...'
                            : 'Change Photo'}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={(e) =>
                            void handlePostCoverUpload(leadPost.id, e)
                          }
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Editorial Strip */}
                <div className="mt-8 pt-5 border-t border-stone-200/80 flex flex-wrap items-center justify-between gap-4 text-xs text-stone-500">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-stone-800">
                      Pickra Global Editorial Journal
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Long-Form Essays, Field Guides, Photography &amp; Video
                      Dispatches
                    </span>
                  </div>
                  <span className="tabular-nums">
                    {publishedPosts.length} published{' '}
                    {publishedPosts.length === 1 ? 'story' : 'stories'}
                  </span>
                </div>
              </section>
            ) : (
              <section className="max-w-[1200px] mx-auto px-5 sm:px-8 py-14 border-b border-stone-200/90 text-center">
                <h1 className="font-serif text-3xl font-medium text-stone-900">
                  Pickra Global Editorial Blog
                </h1>
                <p className="mt-2 text-sm text-stone-600 max-w-xl mx-auto">
                  Long-form essays, field guides, embedded videos, and visual
                  dispatches—open to all readers without signing in.
                </p>
                {canAccessCreatorAdmin && (
                  <button
                    type="button"
                    onClick={() => openBlockEditorForPost(null)}
                    className="mt-5 inline-flex items-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg cursor-pointer"
                  >
                    <PenSquare className="w-4 h-4" />
                    <span>Write First Blog Post</span>
                  </button>
                )}
              </section>
            )}

            {/* SECTION 2: Global Blog Feed */}
            <section
              id="blog"
              className="max-w-[1200px] mx-auto px-5 sm:px-8 py-12 sm:py-16"
            >
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <EditableSectionHeader
                  copy={sectionHeaders.blogFeed}
                  onSave={(nextCopy) => saveSectionHeader('blogFeed', nextCopy)}
                  onReset={() => resetSectionHeader('blogFeed')}
                  level="h2"
                  showSubtitle={Boolean(sectionHeaders.blogFeed.subtitle)}
                  canEdit={canAccessCreatorAdmin}
                />

                <div className="flex flex-wrap items-start gap-3">
                  <EditableDropdownSelect
                    ariaLabel="Filter blog category"
                    value={blogCategory}
                    options={dropdownOptions.blogCategories}
                    prefixOptions={[{ value: 'All', label: 'All Categories' }]}
                    onChange={(val) =>
                      setBlogCategory(val as 'All' | PostCategory)
                    }
                    onAddOption={(opt) =>
                      addDropdownOption('blogCategories', opt)
                    }
                    onRenameOption={(oldOpt, nextOpt) => {
                      renameDropdownOption('blogCategories', oldOpt, nextOpt);
                      if (blogCategory === oldOpt) {
                        setBlogCategory(nextOpt);
                      }
                    }}
                    onDeleteOption={(opt) =>
                      deleteDropdownOption('blogCategories', opt)
                    }
                    placeholder="Blog category..."
                    compact
                    canEdit={canAccessCreatorAdmin}
                    selectClassName="px-3 py-2 text-xs font-medium bg-white border border-stone-200 rounded-lg text-stone-700 focus:outline-none focus:border-[#9A3412]"
                  />

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

                  {canAccessCreatorAdmin && (
                    <button
                      type="button"
                      onClick={() => openBlockEditorForPost(null)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Blog</span>
                    </button>
                  )}
                </div>
              </div>

              {loadingPosts && publishedPosts.length === 0 ? (
                <div className="mt-8 space-y-4" aria-live="polite">
                  <div className="text-xs text-stone-500">
                    Loading published blog articles...
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className="h-80 rounded-xl bg-[#F3EFE8] border border-stone-200/70 animate-pulse"
                      />
                    ))}
                  </div>
                </div>
              ) : publishedPosts.length === 0 ? (
                <div className="mt-10 py-14 px-6 text-center bg-white border border-stone-200/90 rounded-2xl space-y-3">
                  <BookOpen className="w-7 h-7 text-[#9A3412] mx-auto" />
                  <h3 className="font-serif text-xl font-medium text-stone-900">
                    No published blog articles are available yet
                  </h3>
                  <p className="text-sm text-stone-600 max-w-lg mx-auto leading-relaxed">
                    Published essays, field guides, and dispatches appear here
                    automatically for all public visitors as soon as they go
                    live.
                  </p>
                  {canAccessCreatorAdmin && (
                    <button
                      type="button"
                      onClick={() => openBlockEditorForPost(null)}
                      className="mt-2 inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg cursor-pointer"
                    >
                      <PenSquare className="w-3.5 h-3.5" />
                      <span>Publish First Article</span>
                    </button>
                  )}
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
                            <span>
                              By {post.authorName || 'Pickra Editorial'}
                            </span>
                            <a
                              href={`?post=${encodeURIComponent(
                                post.slug || post.id
                              )}`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openPost(post);
                              }}
                              className="font-semibold text-stone-900 group-hover:text-[#9A3412] inline-flex items-center gap-1"
                            >
                              <span>Read Full Article</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </a>
                          </div>

                          {canAccessCreatorAdmin && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mt-3 pt-2.5 border-t border-stone-200/70 flex items-center justify-end gap-3 text-xs"
                            >
                              <label className="inline-flex items-center gap-1 font-medium text-stone-600 hover:text-[#9A3412] cursor-pointer whitespace-nowrap">
                                <Camera className="w-3.5 h-3.5" />
                                <span>
                                  {uploadingPostPhotoId === post.id
                                    ? 'Saving...'
                                    : 'Photo'}
                                </span>
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/gif"
                                  onChange={(e) =>
                                    void handlePostCoverUpload(post.id, e)
                                  }
                                  className="hidden"
                                />
                              </label>

                              <button
                                type="button"
                                onClick={() => openBlockEditorForPost(post)}
                                className="inline-flex items-center gap-1 font-medium text-stone-600 hover:text-stone-900 cursor-pointer whitespace-nowrap"
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
                                  className="inline-flex items-center gap-1 text-stone-500 hover:text-red-700 cursor-pointer whitespace-nowrap"
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
          </div>
        )}
      </main>

      {/* Module-Scoped Affiliate Modal (Admin-Only; Strictly Separated Between Product Affiliate & Service Affiliate) */}
      {canAccessCreatorAdmin && isOfferModalOpen && (
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
                  {offerModalModule === 'services'
                    ? 'Pickra Service Affiliate Module'
                    : 'Pickra Product Affiliate Module'}
                </div>
                <h2 className="font-serif text-xl font-medium text-stone-900">
                  {editingOfferId
                    ? offerModalModule === 'services'
                      ? 'Edit Service Affiliate Listing'
                      : 'Edit Product Affiliate Listing'
                    : offerModalModule === 'services'
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
                  {offerModalModule === 'services'
                    ? 'Professional Service Title'
                    : 'Product Title'}
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={140}
                  value={offerTitle}
                  onChange={(e) => setOfferTitle(e.target.value)}
                  placeholder={
                    offerModalModule === 'services'
                      ? 'e.g., Fiverr Pro Brand Identity Studio'
                      : 'e.g., Keychron Q1 Max Wireless Mechanical Keyboard'
                  }
                  className="w-full px-3 py-2 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {offerModalModule === 'services'
                      ? 'Service Type'
                      : 'Product Format'}
                  </label>
                  {offerModalModule === 'services' ? (
                    <div className="w-full px-2.5 py-2 text-xs font-medium text-stone-800 bg-[#F3EFE8] border border-stone-300 rounded-lg">
                      Professional Service
                    </div>
                  ) : (
                    <select
                      value={offerKind === 'digital' ? 'digital' : 'physical'}
                      onChange={(e) =>
                        setOfferKind(
                          e.target.value === 'digital' ? 'digital' : 'physical'
                        )
                      }
                      className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                    >
                      <option value="physical">Physical Product</option>
                      <option value="digital">Digital Product</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {offerModalModule === 'services'
                      ? 'Service Network'
                      : 'Marketing Platform'}
                  </label>
                  <EditableDropdownSelect
                    ariaLabel="Marketing Platform"
                    value={offerPlatform}
                    options={
                      offerModalModule === 'services'
                        ? dropdownOptions.servicePlatforms
                        : dropdownOptions.productPlatforms
                    }
                    onChange={(val) =>
                      setOfferPlatform(val as AffiliatePlatform)
                    }
                    onAddOption={(opt) =>
                      addDropdownOption(
                        offerModalModule === 'services'
                          ? 'servicePlatforms'
                          : 'productPlatforms',
                        opt
                      )
                    }
                    onRenameOption={(oldOpt, nextOpt) =>
                      renameDropdownOption(
                        offerModalModule === 'services'
                          ? 'servicePlatforms'
                          : 'productPlatforms',
                        oldOpt,
                        nextOpt
                      )
                    }
                    onDeleteOption={(opt) =>
                      deleteDropdownOption(
                        offerModalModule === 'services'
                          ? 'servicePlatforms'
                          : 'productPlatforms',
                        opt
                      )
                    }
                    placeholder="Platform..."
                    compact
                    canEdit={true}
                    selectClassName="px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:border-[#9A3412]"
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
                    placeholder={
                      offerModalModule === 'services' ? 'From $120' : '$149.00'
                    }
                    className="w-full px-2.5 py-2 text-xs font-mono bg-[#FBF9F5] border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Category / Department
                  </label>
                  <EditableDropdownSelect
                    ariaLabel="Category or Department"
                    value={offerCategory}
                    options={dropdownOptions.affiliateCategories}
                    onChange={setOfferCategory}
                    onAddOption={(opt) =>
                      addDropdownOption('affiliateCategories', opt)
                    }
                    onRenameOption={(oldOpt, nextOpt) =>
                      renameDropdownOption(
                        'affiliateCategories',
                        oldOpt,
                        nextOpt
                      )
                    }
                    onDeleteOption={(opt) =>
                      deleteDropdownOption('affiliateCategories', opt)
                    }
                    placeholder="Department..."
                    compact
                    canEdit={true}
                    selectClassName="px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:border-[#9A3412]"
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
                    placeholder="Top Rated · Verified Partner"
                    className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-xs font-medium text-stone-700">
                    {offerModalModule === 'services'
                      ? 'Service Seller Affiliate Link (HTTPS — guides demanders to service page)'
                      : 'Primary Product Affiliate Link (HTTPS — guides buyers to target platform)'}
                  </label>
                  {offerModalModule === 'products' &&
                    (offerPlatform === 'Amazon' ||
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
                    offerModalModule === 'services'
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
                    <span>
                      Video Attachment (Optional — Upload Clip or Paste URL)
                    </span>
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
                    Description &amp; Affiliate Links Box (Paste links or insert
                    clickable hyperlinks)
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
                      placeholder={
                        offerModalModule === 'services'
                          ? 'Link text (e.g. Hire on Fiverr)'
                          : 'Link text (e.g. Buy on Amazon)'
                      }
                      className="sm:col-span-4 px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded"
                    />
                    <input
                      type="url"
                      value={descLinkUrl}
                      onChange={(e) => setDescLinkUrl(e.target.value)}
                      placeholder={
                        offerModalModule === 'services'
                          ? 'https://www.fiverr.com/...'
                          : 'https://www.amazon.com/...'
                      }
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
                  placeholder="Write description and paste affiliate links directly (e.g. https://... or use + Insert Hyperlink so visitors click straight through to the target platform)..."
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
                    : offerModalModule === 'services'
                    ? 'Publish Service Affiliate'
                    : 'Publish Product Affiliate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-Over Store Shopping Bag & Guest Checkout Drawer */}
      <ShoppingBagDrawer
        onNavigateToPurchases={() => navigateToSection('store', 'purchases')}
        onOpenPrivacy={() => navigateToSection('privacy')}
        onOpenContactSupport={() => openContactPage('order_support')}
      />

      {/* Global Create Account / Sign In Modal */}
      <AuthModal
        onOpenPrivacy={() => navigateToSection('privacy')}
        onOpenContact={() => openContactPage('privacy_issue')}
      />

      {/* Quiet Archival Footer */}
      <footer className="border-t border-stone-200/90 bg-[#F5F2EB] mt-12">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-10 space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="max-w-xl">
              <span className="font-serif text-lg font-semibold text-stone-900">
                Pickra
              </span>
              <p className="mt-1.5 text-xs text-stone-600 leading-relaxed">
                {siteConfig.siteTagline}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-stone-600">
              {(blogModuleEnabled || canAccessCreatorAdmin) && (
                <button
                  type="button"
                  onClick={() => navigateToSection('blog')}
                  className="hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Blog
                </button>
              )}
              {canAccessCreatorAdmin && (
                <button
                  type="button"
                  onClick={() => openBlockEditorForPost(null)}
                  className="hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Write Blog
                </button>
              )}
              {(storeModuleEnabled || canAccessCreatorAdmin) && (
                <button
                  type="button"
                  onClick={() => navigateToSection('store')}
                  className="hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Store
                </button>
              )}
              {(storeModuleEnabled || canAccessCreatorAdmin) && (
                <button
                  type="button"
                  onClick={() => navigateToSection('store', 'sell')}
                  className="hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Seller Account
                </button>
              )}
              {(productAffiliateModuleEnabled || canAccessCreatorAdmin) && (
                <button
                  type="button"
                  onClick={() => navigateToSection('products')}
                  className="hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Product Affiliate
                </button>
              )}
              {(serviceAffiliateModuleEnabled || canAccessCreatorAdmin) && (
                <button
                  type="button"
                  onClick={() => navigateToSection('services')}
                  className="hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Service Affiliate
                </button>
              )}
              {canOpenBackendGate && (
                <button
                  type="button"
                  onClick={() => navigateToSection('studio')}
                  className="hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Admin
                </button>
              )}
              {!user || user.isAnonymous ? (
                <button
                  type="button"
                  onClick={() => openAuthModal('signin', false)}
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
            </div>
          </div>

          <div className="pt-5 border-t border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-stone-600">
            <div className="flex flex-wrap items-center gap-5">
              <button
                type="button"
                onClick={() => navigateToSection('about')}
                className={`hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0 ${
                  activeSection === 'about'
                    ? 'font-semibold text-[#9A3412]'
                    : ''
                }`}
              >
                About Us
              </button>
              <button
                type="button"
                onClick={() => openContactPage('general')}
                className={`hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0 ${
                  activeSection === 'contact'
                    ? 'font-semibold text-[#9A3412]'
                    : ''
                }`}
              >
                Contact Us
              </button>
              <button
                type="button"
                onClick={() => navigateToSection('privacy')}
                className={`hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0 ${
                  activeSection === 'privacy'
                    ? 'font-semibold text-[#9A3412]'
                    : ''
                }`}
              >
                Privacy &amp; Data Policy
              </button>
              <button
                type="button"
                onClick={() => openContactPage('privacy_issue')}
                className="text-[#9A3412] hover:text-stone-900 font-medium cursor-pointer whitespace-nowrap shrink-0"
              >
                Report Private Issue
              </button>
            </div>

            <span className="text-stone-400 whitespace-nowrap shrink-0">
              © {new Date().getFullYear()} Pickra · Protected Vault &amp; Independent Publishing
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
