import React, { useEffect, useState } from 'react';
import {
  Check,
  Download,
  ExternalLink,
  LogIn,
  LogOut,
  PenSquare,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { OfferDraftInput, useFirebaseApp } from '../context/FirebaseContext';
import {
  AffiliateOffer,
  AffiliatePlatform,
  BlogPost,
  OfferKind,
  PublishStatus,
} from '../types';
import { PRESET_IMAGES } from '../assets/presetImages';

interface PublisherStudioProps {
  onOpenPublishedPost: (post: BlogPost) => void;
  onOpenBlockEditor: (post?: BlogPost | null) => void;
}

const PLATFORMS: AffiliatePlatform[] = [
  'Amazon',
  'Digistore24',
  'Upwork',
  'Fiverr',
  'Gumroad',
  'ClickBank',
  'Custom',
];

export const PublisherStudio: React.FC<PublisherStudioProps> = ({
  onOpenPublishedPost,
  onOpenBlockEditor,
}) => {
  const {
    user,
    profile,
    privateInfo,
    studioPosts,
    publishedPosts,
    studioOffers,
    publishedOffers,
    clickCounts,
    hasFirestoreContent,
    signInWithGoogle,
    signOutUser,
    saveOffer,
    deleteOffer,
    deletePost,
    saveProfileAndAffiliateTags,
    importStarterCatalog,
  } = useFirebaseApp();

  const [studioTab, setStudioTab] = useState<'posts' | 'offers' | 'settings'>('posts');
  const [feedbackBanner, setFeedbackBanner] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  // Confirm delete inline state (avoids window.confirm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Offer Composer State
  const [editingOfferId, setEditingOfferId] = useState<string | undefined>(undefined);
  const [offerTitle, setOfferTitle] = useState('');
  const [offerKind, setOfferKind] = useState<OfferKind>('physical');
  const [offerPlatform, setOfferPlatform] = useState<AffiliatePlatform>('Amazon');
  const [offerCategory, setOfferCategory] = useState('Studio Hardware');
  const [offerPrice, setOfferPrice] = useState('$199.00');
  const [offerCommission, setOfferCommission] = useState('');
  const [offerUrl, setOfferUrl] = useState('');
  const [offerImageKey, setOfferImageKey] = useState('audio');
  const [offerCustomImageUrl, setOfferCustomImageUrl] = useState('');
  const [offerSummary, setOfferSummary] = useState('');
  const [offerHighlightsText, setOfferHighlightsText] = useState('');
  const [offerStatus, setOfferStatus] = useState<PublishStatus>('published');

  // Settings State
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [amazonTag, setAmazonTag] = useState('');
  const [digistoreId, setDigistoreId] = useState('');

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

  function notify(tone: 'ok' | 'err', text: string) {
    setFeedbackBanner({ tone, text });
  }

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
    setOfferSummary('');
    setOfferHighlightsText('');
    setOfferStatus('published');
  }

  function loadOfferIntoComposer(offer: AffiliateOffer) {
    setEditingOfferId(offer.isSeed ? undefined : offer.id);
    setOfferTitle(offer.title);
    setOfferKind(offer.kind);
    setOfferPlatform(offer.platform);
    setOfferCategory(offer.category);
    setOfferPrice(offer.priceLabel);
    setOfferCommission(offer.commissionNote);
    setOfferUrl(offer.affiliateUrl);
    const isPreset = PRESET_IMAGES.some((p) => p.key === offer.imageKey);
    if (isPreset) {
      setOfferImageKey(offer.imageKey);
      setOfferCustomImageUrl('');
    } else {
      setOfferImageKey('custom');
      setOfferCustomImageUrl(offer.imageKey);
    }
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
      const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
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
        notify('ok', `Appended Digistore24 Affiliate ID (${digistoreId.trim()}).`);
        return;
      }

      notify(
        'err',
        'Configure your default Amazon Tag or Digistore24 ID under Affiliate IDs & Profile first.'
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
        offerImageKey === 'custom' ? offerCustomImageUrl.trim() : offerImageKey;
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
        summary: offerSummary,
        highlights,
        status: offerStatus,
      };

      await saveOffer(input);
      resetOfferComposer();
      notify('ok', 'Affiliate product or service saved to catalog.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Unable to save offering.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
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
      notify('ok', 'Author profile and private affiliate tracking IDs updated.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Failed to save settings.');
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
        'Starter articles and affiliate links imported into your Firestore workspace. You can now edit every URL.'
      );
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  const allManageableOffers: AffiliateOffer[] = React.useMemo(() => {
    const map = new Map<string, AffiliateOffer>();
    for (const item of studioOffers) map.set(item.id, item);
    for (const item of publishedOffers) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    return Array.from(map.values());
  }, [studioOffers, publishedOffers]);

  const allManageablePosts: BlogPost[] = React.useMemo(() => {
    const map = new Map<string, BlogPost>();
    for (const item of studioPosts) map.set(item.id, item);
    for (const item of publishedPosts) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    return Array.from(map.values());
  }, [studioPosts, publishedPosts]);

  if (!user) {
    return (
      <section className="max-w-[960px] mx-auto px-5 sm:px-8 py-14 sm:py-20">
        <div className="bg-white border border-stone-200/90 rounded-xl p-8 sm:p-12">
          <p className="text-xs font-medium text-[#9A3412]">
            Publisher Studio &amp; Affiliate Catalog Manager
          </p>
          <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-medium text-stone-900">
            Manage your affiliate products, freelance links, and published stories
          </h1>
          <p className="mt-4 text-base text-stone-600 leading-relaxed max-w-2xl">
            Sign in with Google to manage your product and service links across Amazon, Digistore24, Upwork, and Fiverr, or jump straight into the Medium-style Block Editor to draft a new story with images, videos, and links.
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-stone-200/80">
            <div>
              <h3 className="text-sm font-semibold text-stone-900">
                01. Medium-Style Block Editor
              </h3>
              <p className="mt-1.5 text-xs text-stone-600 leading-relaxed">
                Write block-by-block with inline hyperlinks, captioned images, YouTube/Vimeo/MP4 videos, and bookmark cards.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-stone-900">
                02. Multi-Platform Catalog
              </h3>
              <p className="mt-1.5 text-xs text-stone-600 leading-relaxed">
                Organize physical gear, digital downloads, and Upwork or Fiverr services ready to drop into any post.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-stone-900">
                03. Auto-Tagging &amp; Clicks
              </h3>
              <p className="mt-1.5 text-xs text-stone-600 leading-relaxed">
                Store your Amazon Associate tag and Digistore24 ID privately and monitor outbound clicks.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="inline-flex items-center gap-2.5 px-5 py-3 text-sm font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In with Google</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenBlockEditor(null)}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
            >
              <PenSquare className="w-4 h-4" />
              <span>Open Block Story Editor</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8 sm:py-12">
      {/* Studio Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <span>Signed in as {user.email}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{studioPosts.length} saved stories</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{studioOffers.length} saved offerings</span>
          </div>
          <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-medium text-stone-900">
            Publisher Studio
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!hasFirestoreContent && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleImportSeeds()}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-stone-800 bg-[#F3EFE8] hover:bg-stone-200/80 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Import Starter Catalog to Edit</span>
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

          <button
            type="button"
            onClick={() => void signOutUser()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 border border-stone-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Interactive Segmented Tab Bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-[#F3EFE8] rounded-lg">
          <button
            type="button"
            onClick={() => setStudioTab('posts')}
            className={`px-4 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              studioTab === 'posts'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Stories &amp; Drafts
          </button>
          <button
            type="button"
            onClick={() => setStudioTab('offers')}
            className={`px-4 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              studioTab === 'offers'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Products &amp; Services
          </button>
          <button
            type="button"
            onClick={() => setStudioTab('settings')}
            className={`px-4 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              studioTab === 'settings'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Affiliate IDs &amp; Profile
          </button>
        </div>

        {studioTab === 'offers' && (
          <button
            type="button"
            onClick={resetOfferComposer}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Product or Service</span>
          </button>
        )}
      </div>

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          role="status"
          className={`mt-5 px-4 py-3 rounded-lg border text-xs flex items-center justify-between gap-4 ${
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

      {/* TAB 1: STORIES & DRAFTS LIST (OPENS IN MEDIUM-STYLE BLOCK EDITOR) */}
      {studioTab === 'posts' && (
        <div className="mt-8 bg-white border border-stone-200/90 rounded-xl p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-200/80">
            <div>
              <h2 className="font-serif text-xl font-medium text-stone-900">
                Published Stories &amp; Working Drafts
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                Open any story in the Medium-style Block Editor to add text, inline hyperlinks, images, videos, link cards, or affiliate products.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onOpenBlockEditor(null)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <PenSquare className="w-4 h-4" />
              <span>Write a Story in Block Editor</span>
            </button>
          </div>

          <div className="mt-4 divide-y divide-stone-200/80">
            {allManageablePosts.map((post) => (
              <div
                key={post.id}
                className="py-5 first:pt-2 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    <span className="capitalize font-medium text-stone-800">
                      {post.isSeed ? 'Starter Story' : post.status}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{post.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{post.publishedLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {post.attachedOfferIds.length} attached links
                    </span>
                  </div>

                  <h3 className="mt-1 font-serif text-lg font-medium text-stone-900 leading-snug">
                    {post.title}
                  </h3>
                  <p className="mt-1 text-xs text-stone-600 line-clamp-1">
                    {post.subtitle}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-xs">
                  <button
                    type="button"
                    onClick={() => onOpenBlockEditor(post)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 font-medium text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <PenSquare className="w-3.5 h-3.5 text-[#9A3412]" />
                    <span>{post.isSeed ? 'Clone in Editor' : 'Edit Blocks'}</span>
                  </button>

                  {post.status === 'published' && (
                    <button
                      type="button"
                      onClick={() => onOpenPublishedPost(post)}
                      className="inline-flex items-center gap-1 px-3 py-2 text-stone-600 hover:text-stone-900 cursor-pointer whitespace-nowrap"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {!post.isSeed &&
                    (confirmDeleteId === post.id ? (
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
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: AFFILIATE PRODUCTS & SERVICES MANAGER */}
      {studioTab === 'offers' && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 6 cols: Add / Edit Product or Service */}
          <form
            onSubmit={(e) => void handleSaveOfferSubmit(e)}
            className="lg:col-span-6 bg-white border border-stone-200/90 rounded-xl p-6 sm:p-8 space-y-4"
          >
            <div className="pb-4 border-b border-stone-200/80">
              <h2 className="font-serif text-xl font-medium text-stone-900">
                {editingOfferId
                  ? 'Edit Affiliate Product or Service'
                  : 'Add Affiliate Product or Service'}
              </h2>
              <p className="mt-0.5 text-xs text-stone-500">
                Add physical hardware, digital products, or Upwork and Fiverr services to attach inside your blog stories.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                Title
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={140}
                value={offerTitle}
                onChange={(e) => setOfferTitle(e.target.value)}
                placeholder="e.g., Sony ZV-E10 Mirrorless Vlog Camera or Fiverr Pro Technical SEO Audit"
                className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Offering Type
                </label>
                <select
                  value={offerKind}
                  onChange={(e) => setOfferKind(e.target.value as OfferKind)}
                  className="w-full px-3 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                >
                  <option value="physical">Physical Product</option>
                  <option value="digital">Digital Product</option>
                  <option value="service">Freelance Service</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Platform / Network
                </label>
                <select
                  value={offerPlatform}
                  onChange={(e) =>
                    setOfferPlatform(e.target.value as AffiliatePlatform)
                  }
                  className="w-full px-3 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Department / Category
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  value={offerCategory}
                  onChange={(e) => setOfferCategory(e.target.value)}
                  placeholder="Audio, SaaS, SEO..."
                  className="w-full px-3 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Displayed Price / Rate
                </label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  placeholder="$149.00 or From $95/hr"
                  className="w-full px-3 py-2.5 text-sm font-mono tabular-nums bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Commission Note
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={offerCommission}
                  onChange={(e) => setOfferCommission(e.target.value)}
                  placeholder="e.g. 50% Digistore24"
                  className="w-full px-3 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                />
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-medium text-stone-700">
                  Affiliate Link URL (https://)
                </label>
                {(offerPlatform === 'Amazon' || offerPlatform === 'Digistore24') && (
                  <button
                    type="button"
                    onClick={applyDefaultAffiliateIdToUrl}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#9A3412] hover:underline cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Append Saved {offerPlatform} ID</span>
                  </button>
                )}
              </div>
              <input
                type="url"
                required
                value={offerUrl}
                onChange={(e) => setOfferUrl(e.target.value)}
                placeholder="https://www.amazon.com/dp/... or https://www.digistore24.com/redir/..."
                className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Product / Service Visual
                </label>
                <select
                  value={offerImageKey}
                  onChange={(e) => setOfferImageKey(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                >
                  {PRESET_IMAGES.map((img) => (
                    <option key={img.key} value={img.key}>
                      {img.label}
                    </option>
                  ))}
                  <option value="custom">Custom HTTPS Image URL...</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Catalog Visibility
                </label>
                <select
                  value={offerStatus}
                  onChange={(e) => setOfferStatus(e.target.value as PublishStatus)}
                  className="w-full px-3 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            {offerImageKey === 'custom' && (
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Custom Product Image URL (https://)
                </label>
                <input
                  type="url"
                  required
                  value={offerCustomImageUrl}
                  onChange={(e) => setOfferCustomImageUrl(e.target.value)}
                  placeholder="https://example.com/product.jpg"
                  className="w-full px-3.5 py-2 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                Editorial Verdict / Summary
              </label>
              <textarea
                required
                minLength={10}
                maxLength={400}
                rows={3}
                value={offerSummary}
                onChange={(e) => setOfferSummary(e.target.value)}
                placeholder="Explain who this product or freelancer is best for and what stood out in testing..."
                className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                Key Highlights (one per line, up to 4)
              </label>
              <textarea
                rows={3}
                value={offerHighlightsText}
                onChange={(e) => setOfferHighlightsText(e.target.value)}
                placeholder={'48-hour delivery turnaround\nIncludes full commercial source files\n100% verified client ratings'}
                className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
              />
            </div>

            <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-3">
              {editingOfferId && (
                <button
                  type="button"
                  onClick={resetOfferComposer}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{editingOfferId ? 'Update Offering' : 'Save to Catalog'}</span>
              </button>
            </div>
          </form>

          {/* Right 6 cols: Saved Affiliate Offerings & Click Metrics */}
          <div className="lg:col-span-6 bg-white border border-stone-200/90 rounded-xl p-6 sm:p-8">
            <h3 className="font-serif text-xl font-medium text-stone-900">
              Affiliate Link Inventory &amp; Outbound Clicks
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              Manage your saved physical products, digital tools, and freelance service links.
            </p>

            <div className="mt-5 divide-y divide-stone-200/80">
              {allManageableOffers.map((offer) => {
                const clicks = clickCounts[offer.id] || 0;
                return (
                  <div
                    key={offer.id}
                    className="py-4 first:pt-2 last:pb-0 flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-500">
                        <span className="font-medium text-stone-800">
                          {offer.platform}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{offer.kind}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {offer.priceLabel}
                        </span>
                        {offer.isSeed && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Starter Item</span>
                          </>
                        )}
                      </div>

                      <h4 className="mt-1 text-sm font-semibold text-stone-900 leading-snug">
                        {offer.title}
                      </h4>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => loadOfferIntoComposer(offer)}
                          className="font-medium text-[#9A3412] hover:underline cursor-pointer"
                        >
                          {offer.isSeed ? 'Clone & Customize Link' : 'Edit Link'}
                        </button>
                        <a
                          href={offer.affiliateUrl}
                          target="_blank"
                          rel="noopener noreferrer sponsored"
                          className="text-stone-500 hover:text-stone-900 inline-flex items-center gap-1"
                        >
                          <span>Test Destination</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>

                        {!offer.isSeed &&
                          (confirmDeleteId === offer.id ? (
                            <span className="inline-flex items-center gap-2">
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
                              onClick={() => setConfirmDeleteId(offer.id)}
                              className="text-stone-400 hover:text-red-700 cursor-pointer"
                              aria-label={`Delete ${offer.title}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ))}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="block font-mono text-base font-medium text-stone-900 tabular-nums">
                        {clicks}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        outbound clicks
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PROFILE & PRIVATE AFFILIATE IDS */}
      {studioTab === 'settings' && (
        <div className="mt-8 max-w-2xl bg-white border border-stone-200/90 rounded-xl p-6 sm:p-8">
          <h2 className="font-serif text-xl font-medium text-stone-900">
            Publisher Byline &amp; Default Affiliate Tracking IDs
          </h2>
          <p className="mt-1 text-xs text-stone-500 leading-relaxed">
            Your public byline appears on published dispatches. Your affiliate network IDs are stored in an isolated owner-only private record for one-click link tagging.
          </p>

          <form onSubmit={(e) => void handleSaveSettings(e)} className="mt-6 space-y-5">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                Public Author / Masthead Name
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                Editorial Bio
              </label>
              <textarea
                rows={3}
                maxLength={300}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
              />
            </div>

            <div className="pt-4 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Default Amazon Associates Tag
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={amazonTag}
                  onChange={(e) => setAmazonTag(e.target.value)}
                  placeholder="e.g., pickra-20"
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Default Digistore24 Affiliate ID
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={digistoreId}
                  onChange={(e) => setDigistoreId(e.target.value)}
                  placeholder="e.g., publisher_id"
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Save Profile &amp; Affiliate IDs</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
