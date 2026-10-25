import React, { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, PenSquare, Search, X } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FirebaseProvider, useFirebaseApp } from './context/FirebaseContext';
import {
  ActiveSection,
  AffiliateOffer,
  AffiliatePlatform,
  BlogPost,
  PostCategory,
} from './types';
import { ResilientImage } from './components/ResilientImage';
import { OfferCard } from './components/OfferCard';
import { ArticleReader } from './components/ArticleReader';
import { PublisherStudio } from './components/PublisherStudio';
import { MediumBlockEditor } from './components/MediumBlockEditor';

function PickraShell() {
  const {
    loadingData,
    publishedPosts,
    publishedOffers,
    allAccessibleOffersMap,
  } = useFirebaseApp();

  const [activeSection, setActiveSection] = useState<ActiveSection>('journal');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [storyBeingEdited, setStoryBeingEdited] = useState<BlogPost | null>(null);

  // Journal filters
  const [journalCategory, setJournalCategory] = useState<'All' | PostCategory>('All');
  const [journalSearch, setJournalSearch] = useState('');

  // Homepage directory quick-filter
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
    'All' | 'Upwork' | 'Fiverr' | 'Custom'
  >('All');
  const [serviceSearch, setServiceSearch] = useState('');

  const selectedPost = useMemo(() => {
    if (!selectedPostId) return null;
    return publishedPosts.find((p) => p.id === selectedPostId) || null;
  }, [selectedPostId, publishedPosts]);

  const leadPost = publishedPosts[0] || null;

  const filteredJournalPosts = useMemo(() => {
    const q = journalSearch.trim().toLowerCase();
    return publishedPosts.filter((post) => {
      if (journalCategory !== 'All' && post.category !== journalCategory) {
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
  }, [publishedPosts, journalCategory, journalSearch]);

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

  // Map offerId -> first related blog post so shoppers can jump into the full review
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

  function navigateToSection(section: ActiveSection) {
    setSelectedPostId(null);
    if (section === 'write') {
      setStoryBeingEdited(null);
    }
    setActiveSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openPost(post: BlogPost) {
    setSelectedPostId(post.id);
    setActiveSection('journal');
  }

  function openBlockEditorForPost(post?: BlogPost | null) {
    setStoryBeingEdited(post || null);
    setSelectedPostId(null);
    setActiveSection('write');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] text-[#1C1917]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="md:sticky md:top-0 z-30 bg-[#FBF9F5]/95 backdrop-blur-xs border-b border-stone-200/90">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-8 px-5 sm:px-8 py-4">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#journal"
            onClick={(e) => {
              e.preventDefault();
              navigateToSection('journal');
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
              onClick={() => navigateToSection('journal')}
              className={`py-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeSection === 'journal'
                  ? 'border-[#9A3412] text-stone-900'
                  : 'border-transparent hover:text-stone-900'
              }`}
            >
              Journal
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
              Products
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
              Services
            </button>
            <button
              type="button"
              onClick={() => openBlockEditorForPost(null)}
              className={`py-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeSection === 'write'
                  ? 'border-[#9A3412] text-stone-900'
                  : 'border-transparent hover:text-stone-900'
              }`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('studio')}
              className={`py-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeSection === 'studio'
                  ? 'border-[#9A3412] text-stone-900'
                  : 'border-transparent hover:text-stone-900'
              }`}
            >
              Studio
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => openBlockEditorForPost(null)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <PenSquare className="w-3.5 h-3.5" />
              <span>Write a Story</span>
            </button>
          </div>
        </div>

        {/* Mobile Secondary Row (Non-sticky on mobile so sticky cap = 0%) */}
        <div className="flex md:hidden items-center justify-around border-t border-stone-200/70 px-4 py-2.5 text-xs font-medium text-stone-600">
          <button
            type="button"
            onClick={() => navigateToSection('journal')}
            className={`whitespace-nowrap shrink-0 ${
              activeSection === 'journal' ? 'text-[#9A3412] font-semibold' : ''
            }`}
          >
            Journal
          </button>
          <button
            type="button"
            onClick={() => navigateToSection('products')}
            className={`whitespace-nowrap shrink-0 ${
              activeSection === 'products' ? 'text-[#9A3412] font-semibold' : ''
            }`}
          >
            Products
          </button>
          <button
            type="button"
            onClick={() => navigateToSection('services')}
            className={`whitespace-nowrap shrink-0 ${
              activeSection === 'services' ? 'text-[#9A3412] font-semibold' : ''
            }`}
          >
            Services
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
          <button
            type="button"
            onClick={() => navigateToSection('studio')}
            className={`whitespace-nowrap shrink-0 ${
              activeSection === 'studio' ? 'text-[#9A3412] font-semibold' : ''
            }`}
          >
            Studio
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {activeSection === 'write' ? (
          <MediumBlockEditor
            initialPost={storyBeingEdited}
            onBack={() => navigateToSection('journal')}
            onPublished={(savedPostId) => {
              setSelectedPostId(savedPostId);
              setStoryBeingEdited(null);
              setActiveSection('journal');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : selectedPost && activeSection === 'journal' ? (
          <ArticleReader
            post={selectedPost}
            offersMap={allAccessibleOffersMap}
            onBack={() => setSelectedPostId(null)}
            onEditInEditor={openBlockEditorForPost}
          />
        ) : activeSection === 'studio' ? (
          <PublisherStudio
            onOpenPublishedPost={openPost}
            onOpenBlockEditor={openBlockEditorForPost}
          />
        ) : activeSection === 'products' ? (
          /* DEDICATED PHYSICAL & DIGITAL PRODUCTS DIRECTORY */
          <section className="max-w-[1200px] mx-auto px-5 sm:px-8 py-10 sm:py-14">
            <div className="max-w-3xl">
              <div className="text-xs text-stone-500">
                Affiliate Product Directory · Amazon · Digistore24 · Gumroad
              </div>
              <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-medium text-stone-900">
                Vetted Physical Hardware &amp; Digital Products
              </h1>
              <p className="mt-3 text-base text-stone-600 leading-relaxed">
                Every physical instrument and digital workflow system featured in our weekly dispatches, organized by format and partner marketplace.
              </p>
            </div>

            {/* Filter Toolbar */}
            <div className="mt-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-stone-200">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-1 p-1 bg-[#F3EFE8] rounded-lg">
                  {(
                    [
                      ['all', 'All Products'],
                      ['physical', 'Physical Hardware'],
                      ['digital', 'Digital Downloads'],
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
                  aria-label="Filter by platform"
                  value={productPlatformFilter}
                  onChange={(e) =>
                    setProductPlatformFilter(
                      e.target.value as 'All' | AffiliatePlatform
                    )
                  }
                  className="px-3 py-2 text-xs font-medium bg-white border border-stone-200 rounded-lg text-stone-700 focus:outline-none focus:border-[#9A3412]"
                >
                  <option value="All">All Platforms</option>
                  <option value="Amazon">Amazon</option>
                  <option value="Digistore24">Digistore24</option>
                  <option value="Gumroad">Gumroad</option>
                  <option value="ClickBank">ClickBank</option>
                  <option value="Custom">Custom Partner</option>
                </select>
              </div>

              <div className="relative w-full lg:w-72">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search hardware or digital tools..."
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
                  No products match your current filter selection.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setProductKindFilter('all');
                    setProductPlatformFilter('All');
                    setProductSearch('');
                  }}
                  className="mt-3 text-xs font-semibold text-[#9A3412] hover:underline cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                {filteredProducts.map((offer: AffiliateOffer) => {
                  const relatedPost = relatedPostByOfferId[offer.id];
                  return (
                    <div key={offer.id} className="flex flex-col">
                      <OfferCard offer={offer} variant="grid" />
                      {relatedPost && (
                        <button
                          type="button"
                          onClick={() => openPost(relatedPost)}
                          className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-[#9A3412] transition-colors cursor-pointer text-left"
                        >
                          <BookOpen className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            Reviewed in: {relatedPost.title}
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
          /* DEDICATED FREELANCE SERVICES DIRECTORY (UPWORK, FIVERR, ETC.) */
          <section className="max-w-[1200px] mx-auto px-5 sm:px-8 py-10 sm:py-14">
            <div className="max-w-3xl">
              <div className="text-xs text-stone-500">
                Specialist Freelance Directory · Upwork · Fiverr · Direct Studios
              </div>
              <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-medium text-stone-900">
                Vetted Freelance Specialists &amp; Turnkey Services
              </h1>
              <p className="mt-3 text-base text-stone-600 leading-relaxed">
                Curated engineering, brand identity, and search growth specialists across Upwork and Fiverr—tested in real editorial and product sprints.
              </p>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-200">
              <div className="inline-flex items-center gap-1 p-1 bg-[#F3EFE8] rounded-lg">
                {(['All', 'Upwork', 'Fiverr', 'Custom'] as const).map((plat) => (
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
                    {plat === 'All' ? 'All Marketplaces' : plat}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  placeholder="Search engineering, design, SEO..."
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
                  No freelance services match your current filter selection.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setServicePlatformFilter('All');
                    setServiceSearch('');
                  }}
                  className="mt-3 text-xs font-semibold text-[#9A3412] hover:underline cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                {filteredServices.map((offer) => {
                  const relatedPost = relatedPostByOfferId[offer.id];
                  return (
                    <div key={offer.id} className="flex flex-col">
                      <OfferCard offer={offer} variant="grid" />
                      {relatedPost && (
                        <button
                          type="button"
                          onClick={() => openPost(relatedPost)}
                          className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-[#9A3412] transition-colors cursor-pointer text-left"
                        >
                          <BookOpen className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            Featured in guide: {relatedPost.title}
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
          /* HOMEPAGE / EDITORIAL JOURNAL FRONT-PAGE (3 SECTIONS MAX CEILING) */
          <div>
            {/* SECTION 1: Lead Editorial Story Split Hero + Operational Disclosure Ribbon */}
            {leadPost && (
              <section className="max-w-[1200px] mx-auto px-5 sm:px-8 pt-8 sm:pt-12 pb-12 border-b border-stone-200/90">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
                  <div className="lg:col-span-6 flex flex-col justify-between py-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                        <span className="font-medium text-[#9A3412]">
                          Lead Dispatch
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{leadPost.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{leadPost.publishedLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {leadPost.readTimeMinutes} min read
                        </span>
                      </div>

                      <h1 className="mt-4 font-serif text-[clamp(2rem,3.6vw,3.1rem)] font-medium text-stone-900 leading-[1.12] tracking-tight">
                        {leadPost.title}
                      </h1>

                      <p className="mt-4 text-base sm:text-lg text-stone-600 leading-relaxed">
                        {leadPost.subtitle}
                      </p>
                    </div>

                    <div className="mt-8 pt-6 border-t border-stone-200/80 flex flex-wrap items-center justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => openPost(leadPost)}
                        className="inline-flex items-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <span>Read Full Dispatch</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      <span className="text-xs text-stone-500 tabular-nums">
                        {leadPost.attachedOfferIds.length} attached partner links inside
                      </span>
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

                {/* Full-width Operational & Partner Transparency Strip below the Hero Split */}
                <div className="mt-8 pt-5 border-t border-stone-200/80 flex flex-wrap items-center justify-between gap-4 text-xs text-stone-500">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-stone-800">
                      Reader-Supported Journal
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Physical &amp; Digital Products (Amazon, Digistore24, Gumroad)
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Freelance Talent (Upwork, Fiverr)</span>
                  </div>
                  <span>
                    Qualifying links may earn an affiliate commission at zero extra cost to readers.
                  </span>
                </div>
              </section>
            )}

            {/* SECTION 2: Frequent Blog Dispatches Feed */}
            <section
              id="journal"
              className="max-w-[1200px] mx-auto px-5 sm:px-8 py-12 sm:py-16 border-b border-stone-200/90"
            >
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div>
                  <span className="text-xs text-stone-500">
                    Editorial Archive &amp; Buyer Guides
                  </span>
                  <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-medium text-stone-900">
                    Recent Blog Dispatches
                  </h2>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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
                        onClick={() => setJournalCategory(cat)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          journalCategory === cat
                            ? 'bg-white text-stone-900 shadow-xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={journalSearch}
                      onChange={(e) => setJournalSearch(e.target.value)}
                      placeholder="Search dispatches..."
                      className="w-full pl-8 pr-7 py-2 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-[#9A3412]"
                    />
                    {journalSearch && (
                      <button
                        type="button"
                        onClick={() => setJournalSearch('')}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
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
              ) : filteredJournalPosts.length === 0 ? (
                <div className="mt-10 py-12 text-center bg-white border border-stone-200/80 rounded-xl">
                  <p className="text-sm text-stone-600">
                    No blog dispatches match your current search or category filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setJournalCategory('All');
                      setJournalSearch('');
                    }}
                    className="mt-3 text-xs font-semibold text-[#9A3412] hover:underline cursor-pointer"
                  >
                    Show All Dispatches
                  </button>
                </div>
              ) : (
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                  {filteredJournalPosts.map((post) => (
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
                            {post.attachedOfferIds.length === 1 ? 'link' : 'links'}
                          </span>
                          <span className="font-semibold text-stone-900 group-hover:text-[#9A3412] inline-flex items-center gap-1">
                            <span>Read Essay</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* SECTION 3: Curated Affiliate Picks Showcase (Physical, Digital & Freelance Services) */}
            <section className="max-w-[1200px] mx-auto px-5 sm:px-8 py-12 sm:py-16">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div>
                  <span className="text-xs text-stone-500">
                    Direct Partner Picks Across Networks
                  </span>
                  <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-medium text-stone-900">
                    Vetted Products &amp; Specialist Services
                  </h2>
                </div>

                <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#F3EFE8] rounded-lg">
                  {(
                    [
                      ['all', 'All Offerings'],
                      ['physical', 'Physical Products'],
                      ['digital', 'Digital Products'],
                      ['service', 'Freelance Services'],
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
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                {homeFeaturedOffers.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} variant="grid" />
                ))}
              </div>

              <div className="mt-10 pt-6 border-t border-stone-200/80 flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs text-stone-500">
                  Ready to publish your next review? Open the Medium-style Block Editor to weave text, images, videos, and affiliate links together.
                </p>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => openBlockEditorForPost(null)}
                    className="text-[#9A3412] hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Write a Story →
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToSection('products')}
                    className="text-stone-900 hover:text-[#9A3412] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Browse Products →
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToSection('services')}
                    className="text-stone-900 hover:text-[#9A3412] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Browse Services →
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Quiet Archival Footer */}
      <footer className="border-t border-stone-200/90 bg-[#F5F2EB] mt-12">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <span className="font-serif text-lg font-semibold text-stone-900">
              Pickra
            </span>
            <p className="mt-1.5 text-xs text-stone-600 leading-relaxed">
              Independent affiliate marketing publication curating physical gear, digital workflows, and specialist talent across Amazon, Digistore24, Gumroad, Upwork, and Fiverr.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-stone-600">
            <button
              type="button"
              onClick={() => navigateToSection('journal')}
              className="hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
            >
              Journal
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('products')}
              className="hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
            >
              Products
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('services')}
              className="hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
            >
              Services
            </button>
            <button
              type="button"
              onClick={() => openBlockEditorForPost(null)}
              className="hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('studio')}
              className="hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
            >
              Publisher Studio
            </button>
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
