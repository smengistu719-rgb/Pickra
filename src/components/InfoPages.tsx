import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Check,
  Edit3,
  Link2,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import {
  DEFAULT_ABOUT_MISSION,
  DEFAULT_ABOUT_STORY,
  DEFAULT_CONTACT_EMAIL,
  DEFAULT_CONTACT_LOCATION,
  DEFAULT_CONTACT_PHONE,
  DEFAULT_PRIVACY_POLICY_SUMMARY,
  useFirebaseApp,
} from '../context/FirebaseContext';
import {
  ActiveSection,
  CONTACT_CATEGORY_OPTIONS,
  ContactIssueCategory,
  ContactMessage,
} from '../types';
import { EditableSectionHeader } from './EditableSectionHeader';
import { StoreSubView } from './DirectStorefront';

interface AboutUsPageProps {
  canAccessCreatorAdmin: boolean;
  onNavigateSection: (
    section: ActiveSection,
    storeSubView?: StoreSubView
  ) => void;
  onOpenContactWithCategory: (category: ContactIssueCategory) => void;
}

export const AboutUsPage: React.FC<AboutUsPageProps> = ({
  canAccessCreatorAdmin,
  onNavigateSection,
  onOpenContactWithCategory,
}) => {
  const {
    siteConfig,
    saveSiteConfig,
    sectionHeaders,
    saveSectionHeader,
    resetSectionHeader,
  } = useFirebaseApp();

  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [missionDraft, setMissionDraft] = useState(
    siteConfig.aboutMission || DEFAULT_ABOUT_MISSION
  );
  const [storyDraft, setStoryDraft] = useState(
    siteConfig.aboutStory || DEFAULT_ABOUT_STORY
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  useEffect(() => {
    setMissionDraft(siteConfig.aboutMission || DEFAULT_ABOUT_MISSION);
    setStoryDraft(siteConfig.aboutStory || DEFAULT_ABOUT_STORY);
  }, [siteConfig.aboutMission, siteConfig.aboutStory]);

  async function handleSaveAboutCopy(e: React.FormEvent) {
    e.preventDefault();
    if (!canAccessCreatorAdmin) return;
    setSaving(true);
    setFeedback(null);
    try {
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
        blogEnabled: siteConfig.blogEnabled,
        storeEnabled: siteConfig.storeEnabled,
        productAffiliateEnabled: siteConfig.productAffiliateEnabled,
        serviceAffiliateEnabled: siteConfig.serviceAffiliateEnabled,
        showStarterSeeds: siteConfig.showStarterSeeds,
        hiddenSeedIds: siteConfig.hiddenSeedIds,
        aboutMission: missionDraft,
        aboutStory: storyDraft,
      });
      setIsEditingAbout(false);
      setFeedback({ ok: true, text: 'About Us content updated live.' });
    } catch (err) {
      setFeedback({
        ok: false,
        text:
          err instanceof Error ? err.message : 'Unable to save About Us copy.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="max-w-[1120px] mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-stone-200/90">
        <EditableSectionHeader
          copy={sectionHeaders.aboutMasthead}
          onSave={(nextCopy) => saveSectionHeader('aboutMasthead', nextCopy)}
          onReset={() => resetSectionHeader('aboutMasthead')}
          level="h1"
          className="max-w-3xl"
          canEdit={canAccessCreatorAdmin}
        />

        {canAccessCreatorAdmin && (
          <button
            type="button"
            onClick={() => {
              setIsEditingAbout((prev) => !prev);
              setFeedback(null);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-stone-900 bg-white border border-stone-300 hover:border-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap self-start lg:self-auto shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#9A3412]" />
            <span>
              {isEditingAbout ? 'Cancel Editing' : 'Edit About Us Content'}
            </span>
          </button>
        )}
      </div>

      {feedback && (
        <div
          role="status"
          className={`px-4 py-3 rounded-xl border text-xs ${
            feedback.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Owner Inline About Us Copy Editor */}
      {canAccessCreatorAdmin && isEditingAbout ? (
        <form
          onSubmit={(e) => void handleSaveAboutCopy(e)}
          className="bg-white border border-stone-300 rounded-2xl p-6 sm:p-8 space-y-5"
        >
          <div className="text-xs font-semibold text-[#9A3412]">
            Customize About Us Editorial Statement
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1.5">
              Mission Statement
            </label>
            <textarea
              rows={4}
              required
              minLength={10}
              maxLength={2500}
              value={missionDraft}
              onChange={(e) => setMissionDraft(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1.5">
              How Pickras Works &amp; Editorial Story
            </label>
            <textarea
              rows={5}
              required
              minLength={10}
              maxLength={4000}
              value={storyDraft}
              onChange={(e) => setStoryDraft(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={() => setIsEditingAbout(false)}
              className="px-4 py-2 text-xs font-medium text-stone-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] disabled:bg-stone-300 rounded-lg transition-colors cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save About Us Content'}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 bg-white border border-stone-200/90 rounded-2xl p-7 sm:p-9 space-y-5">
            <div className="text-xs font-medium text-[#9A3412]">
              Our Mission &amp; Editorial Standard
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-medium text-stone-900 leading-snug">
              Built for thoughtful readers, independent makers, and transparent discovery.
            </h2>
            <p className="text-sm sm:text-base text-stone-700 leading-relaxed whitespace-pre-line">
              {siteConfig.aboutMission || DEFAULT_ABOUT_MISSION}
            </p>
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed whitespace-pre-line">
              {siteConfig.aboutStory || DEFAULT_ABOUT_STORY}
            </p>
          </div>

          <div className="lg:col-span-5 bg-[#F5F2EB] border border-stone-200/90 rounded-2xl p-7 space-y-5">
            <div className="text-xs font-medium text-[#9A3412]">
              Platform Commitments
            </div>
            <h3 className="font-serif text-xl font-medium text-stone-900">
              Why Pickras keeps every module independent
            </h3>
            <div className="divide-y divide-stone-200/90 text-xs text-stone-700">
              <div className="py-3 first:pt-0">
                <div className="font-semibold text-stone-900">
                  100% Module Separation
                </div>
                <p className="mt-1 text-stone-600 leading-relaxed">
                  Editorial essays, creator-sold Store releases, Product Affiliate links, and Service Affiliate specialists live in dedicated destinations—never disguised or muddled together.
                </p>
              </div>
              <div className="py-3">
                <div className="font-semibold text-stone-900">
                  Direct Creator Empowerment (90% Net Share)
                </div>
                <p className="mt-1 text-stone-600 leading-relaxed">
                  Verified sellers publish physical editions and vaulted digital files (PDF, ZIP, Excel, HTML, eBooks) and receive payouts to Telebirr, Bank Transfer, CBE Birr, PayPal, or Wise.
                </p>
              </div>
              <div className="py-3">
                <div className="font-semibold text-stone-900">
                  Frictionless Guest &amp; Member Shopping
                </div>
                <p className="mt-1 text-stone-600 leading-relaxed">
                  Visitors can shop the Store and unlock digital downloads immediately without creating an account, or sign in to sync orders across devices.
                </p>
              </div>
              <div className="py-3 last:pb-0">
                <div className="font-semibold text-stone-900">
                  Privacy by Architecture
                </div>
                <p className="mt-1 text-stone-600 leading-relaxed">
                  Sensitive payout accounts, buyer addresses, digital deliverables, and private inquiries are enforced at the database security-rule layer.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Four Independent Modules Architecture Grid */}
      <div className="space-y-5">
        <div>
          <div className="text-xs font-medium text-[#9A3412]">
            Four Independent Pillars
          </div>
          <h2 className="mt-1 font-serif text-2xl font-medium text-stone-900">
            Explore Pickras&apos;s Dedicated Modules
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-stone-200/90 rounded-2xl p-6 flex flex-col justify-between gap-5">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <BookOpen className="w-4 h-4 text-[#9A3412]" />
                <span>01. Editorial Blog</span>
              </div>
              <h3 className="font-serif text-xl font-medium text-stone-900">
                Long-Form Essays, Tutorials &amp; Field Notes
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Rich block-based dispatches featuring embedded media, customizable reading themes, code blocks, and curated references for a global readership.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('blog')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A3412] hover:text-stone-900 cursor-pointer self-start"
            >
              <span>Read the Blog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white border border-stone-200/90 rounded-2xl p-6 flex flex-col justify-between gap-5">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <ShoppingBag className="w-4 h-4 text-[#9A3412]" />
                <span>02. Multi-Creator Store</span>
              </div>
              <h3 className="font-serif text-xl font-medium text-stone-900">
                Direct Physical Editions &amp; Instant Digital Downloads
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Shop original studio goods or register a verified seller account to publish physical inventory and vaulted digital tools with guest-friendly checkout.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigateSection('store', 'catalog')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A3412] hover:text-stone-900 cursor-pointer"
              >
                <span>Visit Storefront</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateSection('store', 'sell')}
                className="text-xs font-medium text-stone-600 hover:text-stone-900 underline underline-offset-4 cursor-pointer"
              >
                Become a Verified Seller
              </button>
            </div>
          </div>

          <div className="bg-white border border-stone-200/90 rounded-2xl p-6 flex flex-col justify-between gap-5">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <Link2 className="w-4 h-4 text-[#9A3412]" />
                <span>03. Product Affiliate Directory</span>
              </div>
              <h3 className="font-serif text-xl font-medium text-stone-900">
                Curated Hardware, Software &amp; Digital Tools
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Handpicked physical gear and digital products across Amazon, Digistore24, ClickBank, Gumroad, and partner platforms—guiding you directly to the official listing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('products')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A3412] hover:text-stone-900 cursor-pointer self-start"
            >
              <span>Browse Product Affiliate Picks</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white border border-stone-200/90 rounded-2xl p-6 flex flex-col justify-between gap-5">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <Briefcase className="w-4 h-4 text-[#9A3412]" />
                <span>04. Service Affiliate Directory</span>
              </div>
              <h3 className="font-serif text-xl font-medium text-stone-900">
                Vetted Creative, Engineering &amp; Consulting Talent
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Verified freelance specialists and agencies across Fiverr, Upwork, Toptal, and 99designs for design, software engineering, video production, and growth.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('services')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A3412] hover:text-stone-900 cursor-pointer self-start"
            >
              <span>Explore Service Affiliate Directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Contact & Privacy Callout */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1 max-w-xl">
          <h3 className="font-serif text-xl font-medium text-stone-900">
            Have an editorial inquiry, partnership proposal, or private issue?
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            Reach the Pickras desk directly or review our full Privacy, Data Protection &amp; Private Issues policy.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onOpenContactWithCategory('general')}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            Contact Us
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection('privacy')}
            className="px-4 py-2.5 text-xs font-medium text-stone-800 bg-[#FBF9F5] border border-stone-300 hover:border-stone-400 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            Privacy &amp; Private Issues
          </button>
        </div>
      </div>
    </section>
  );
};

interface ContactUsPageProps {
  canAccessCreatorAdmin: boolean;
  initialCategory?: ContactIssueCategory;
  onNavigateSection: (
    section: ActiveSection,
    storeSubView?: StoreSubView
  ) => void;
}

export const ContactUsPage: React.FC<ContactUsPageProps> = ({
  canAccessCreatorAdmin,
  initialCategory = 'general',
  onNavigateSection,
}) => {
  const {
    user,
    profile,
    siteConfig,
    saveSiteConfig,
    myContactMessages,
    submitContactMessage,
    sectionHeaders,
    saveSectionHeader,
    resetSectionHeader,
  } = useFirebaseApp();

  const [category, setCategory] =
    useState<ContactIssueCategory>(initialCategory);
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<ContactMessage | null>(
    null
  );

  // Owner Contact Channel Inline Editor
  const [isEditingChannels, setIsEditingChannels] = useState(false);
  const [emailDraft, setEmailDraft] = useState(
    siteConfig.contactEmail || DEFAULT_CONTACT_EMAIL
  );
  const [phoneDraft, setPhoneDraft] = useState(
    siteConfig.contactPhone ?? DEFAULT_CONTACT_PHONE
  );
  const [locationDraft, setLocationDraft] = useState(
    siteConfig.contactLocation ?? DEFAULT_CONTACT_LOCATION
  );
  const [savingChannels, setSavingChannels] = useState(false);
  const [channelFeedback, setChannelFeedback] = useState<string | null>(null);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    if (profile?.displayName && !senderName) {
      setSenderName(profile.displayName);
    } else if (user?.displayName && !senderName) {
      setSenderName(user.displayName);
    }
    if (user?.email && !senderEmail) {
      setSenderEmail(user.email);
    }
  }, [user, profile, senderName, senderEmail]);

  useEffect(() => {
    setEmailDraft(siteConfig.contactEmail || DEFAULT_CONTACT_EMAIL);
    setPhoneDraft(siteConfig.contactPhone ?? DEFAULT_CONTACT_PHONE);
    setLocationDraft(siteConfig.contactLocation ?? DEFAULT_CONTACT_LOCATION);
  }, [
    siteConfig.contactEmail,
    siteConfig.contactPhone,
    siteConfig.contactLocation,
  ]);

  const activeCategoryMeta =
    CONTACT_CATEGORY_OPTIONS.find((c) => c.value === category) ||
    CONTACT_CATEGORY_OPTIONS[0];

  async function handleSubmitInquiry(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await submitContactMessage({
        senderName,
        senderEmail,
        category,
        orderNumber,
        subject,
        message,
      });
      setSubmittedTicket(created);
      setSubject('');
      setMessage('');
      setOrderNumber('');
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Unable to send your message right now. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveContactChannels(e: React.FormEvent) {
    e.preventDefault();
    if (!canAccessCreatorAdmin) return;
    setSavingChannels(true);
    setChannelFeedback(null);
    try {
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
        blogEnabled: siteConfig.blogEnabled,
        storeEnabled: siteConfig.storeEnabled,
        productAffiliateEnabled: siteConfig.productAffiliateEnabled,
        serviceAffiliateEnabled: siteConfig.serviceAffiliateEnabled,
        showStarterSeeds: siteConfig.showStarterSeeds,
        hiddenSeedIds: siteConfig.hiddenSeedIds,
        contactEmail: emailDraft,
        contactPhone: phoneDraft,
        contactLocation: locationDraft,
      });
      setIsEditingChannels(false);
      setChannelFeedback('Public contact channels updated.');
    } catch (err) {
      setChannelFeedback(
        err instanceof Error ? err.message : 'Unable to save contact details.'
      );
    } finally {
      setSavingChannels(false);
    }
  }

  const displayEmail = siteConfig.contactEmail || DEFAULT_CONTACT_EMAIL;
  const displayPhone = siteConfig.contactPhone ?? DEFAULT_CONTACT_PHONE;
  const displayLocation =
    siteConfig.contactLocation ?? DEFAULT_CONTACT_LOCATION;

  return (
    <section className="max-w-[1120px] mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-10">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-stone-200/90">
        <EditableSectionHeader
          copy={sectionHeaders.contactMasthead}
          onSave={(nextCopy) => saveSectionHeader('contactMasthead', nextCopy)}
          onReset={() => resetSectionHeader('contactMasthead')}
          level="h1"
          className="max-w-3xl"
          canEdit={canAccessCreatorAdmin}
        />

        {canAccessCreatorAdmin && (
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsEditingChannels((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-900 bg-white border border-stone-300 hover:border-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#9A3412]" />
              <span>
                {isEditingChannels
                  ? 'Cancel Editing'
                  : 'Edit Contact Channels'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateSection('studio')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Open Admin Inbox</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Direct Contact Channels & Confidential Private Issue Assurance */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-7 space-y-5">
            <div className="text-xs font-medium text-[#9A3412]">
              Direct Contact Desk
            </div>

            {canAccessCreatorAdmin && isEditingChannels ? (
              <form
                onSubmit={(e) => void handleSaveContactChannels(e)}
                className="space-y-3.5"
              >
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Support &amp; Editorial Email
                  </label>
                  <input
                    type="email"
                    required
                    maxLength={254}
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Phone / Hours / Direct Desk Line
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Location / Operating Region
                  </label>
                  <input
                    type="text"
                    maxLength={160}
                    value={locationDraft}
                    onChange={(e) => setLocationDraft(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingChannels(false)}
                    className="px-3 py-1.5 text-xs text-stone-600 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingChannels}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg cursor-pointer"
                  >
                    {savingChannels ? 'Saving...' : 'Save Contact Info'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-xs text-stone-700">
                {channelFeedback && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900">
                    {channelFeedback}
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-[#9A3412] mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-stone-900">
                      Editorial, Store &amp; Privacy Email
                    </div>
                    <a
                      href={`mailto:${displayEmail}`}
                      className="mt-0.5 inline-block font-mono text-stone-700 hover:text-[#9A3412] underline underline-offset-4 break-all"
                    >
                      {displayEmail}
                    </a>
                  </div>
                </div>

                {displayPhone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-[#9A3412] mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-stone-900">
                        Support Desk &amp; Hours
                      </div>
                      <div className="mt-0.5 text-stone-600">
                        {displayPhone}
                      </div>
                    </div>
                  </div>
                )}

                {displayLocation && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-[#9A3412] mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-stone-900">
                        Publication Base
                      </div>
                      <div className="mt-0.5 text-stone-600">
                        {displayLocation}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Private Issues & Data Protection Escalation Box */}
          <div className="bg-[#F5F2EB] border border-stone-200/90 rounded-2xl p-6 space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-900">
              <Lock className="w-4 h-4 text-[#9A3412] shrink-0" />
              <span>Reporting Private Issues &amp; Data Requests</span>
            </div>
            <p className="text-xs text-stone-700 leading-relaxed">
              Every message submitted through this form is stored inside a restricted Firestore collection (<span className="font-mono text-[11px]">/contactMessages</span>) accessible exclusively to you and the verified Pickras administrator—never publicly readable or indexed.
            </p>
            <div className="pt-1 flex flex-wrap items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => setCategory('privacy_issue')}
                className="font-semibold text-[#9A3412] hover:text-stone-900 underline underline-offset-4 cursor-pointer"
              >
                Select &ldquo;Private Issue / Data Request&rdquo;
              </button>
              <span aria-hidden="true" className="text-stone-400">
                ·
              </span>
              <button
                type="button"
                onClick={() => onNavigateSection('privacy')}
                className="text-stone-700 hover:text-stone-900 underline underline-offset-4 cursor-pointer"
              >
                Read Privacy Policy
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Confidential Inquiry & Private Issue Submission Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 space-y-6">
            <div>
              <div className="text-xs font-medium text-[#9A3412]">
                {user && !user.isAnonymous
                  ? 'Authenticated Member Dispatch'
                  : 'Guest & Reader Dispatch (No Sign-In Required)'}
              </div>
              <h2 className="mt-1 font-serif text-2xl font-medium text-stone-900">
                Send a Message or Report a Private Issue
              </h2>
              <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                {activeCategoryMeta.hint}
              </p>
            </div>

            {submittedTicket && (
              <div
                role="status"
                className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 text-xs text-emerald-950"
              >
                <div className="flex items-center gap-2 font-semibold text-emerald-900">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>
                    Confidential Inquiry Received · Ref #{submittedTicket.id.slice(-8).toUpperCase()}
                  </span>
                </div>
                <p className="text-emerald-900/90 leading-relaxed">
                  Thank you, {submittedTicket.senderName}. Your{' '}
                  {submittedTicket.category === 'privacy_issue'
                    ? 'private issue report'
                    : 'message'}{' '}
                  has been delivered privately to the Pickras administrator. Replies will be sent to{' '}
                  <span className="font-mono">{submittedTicket.senderEmail}</span>.
                </p>
              </div>
            )}

            {formError && (
              <div
                role="alert"
                className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900"
              >
                {formError}
              </div>
            )}

            <form
              onSubmit={(e) => void handleSubmitInquiry(e)}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Topic / Issue Type
                </label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as ContactIssueCategory)
                  }
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                >
                  {CONTACT_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Full name"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    Reply-To Email Address
                  </label>
                  <input
                    type="email"
                    required
                    maxLength={254}
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>
              </div>

              {(category === 'order_support' ||
                category === 'seller_payout' ||
                category === 'privacy_issue') && (
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    Order Reference or SKU (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="e.g., PKR-849201 (leave blank if not applicable)"
                    className="w-full px-3.5 py-2 text-xs font-mono bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Subject
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={140}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={
                    category === 'privacy_issue'
                      ? 'e.g., Personal Data Request or Confidential Account Issue'
                      : 'Brief summary of your question or request'
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Detailed Message
                </label>
                <textarea
                  rows={5}
                  required
                  minLength={10}
                  maxLength={3000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Provide any relevant context so our team can assist promptly. Never include full payment card numbers or account passwords."
                  className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-[11px] text-stone-500">
                  Protected by Pickras&apos;s confidential inquiry rules — never visible to other users.
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] disabled:bg-stone-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {submitting
                      ? 'Sending Confidentially...'
                      : category === 'privacy_issue'
                      ? 'Submit Private Issue'
                      : 'Send Message'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Sender's Own Submitted Inquiries & Resolution Notes */}
          {myContactMessages.length > 0 && (
            <div className="bg-white border border-stone-200/90 rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="font-serif text-lg font-medium text-stone-900">
                  Your Recent Inquiries &amp; Private Reports
                </h3>
                <p className="text-xs text-stone-500">
                  Visible only to your session/account and the Pickras administrator.
                </p>
              </div>

              <div className="divide-y divide-stone-200/80">
                {myContactMessages.slice(0, 6).map((msg) => (
                  <div key={msg.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-stone-900">
                        {msg.subject}
                      </span>
                      <span className="text-[11px] text-stone-500 font-mono">
                        {msg.status === 'resolved'
                          ? 'Resolved'
                          : msg.status === 'in_review'
                          ? 'In Review'
                          : 'Received'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 line-clamp-2">
                      {msg.message}
                    </p>
                    {msg.adminNote && (
                      <div className="mt-2 p-2.5 bg-[#FBF9F5] border border-stone-200 rounded-lg text-xs text-stone-800">
                        <span className="font-semibold text-[#9A3412]">
                          Pickras Desk Response:{' '}
                        </span>
                        {msg.adminNote}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

interface PrivacyAndLegalPageProps {
  canAccessCreatorAdmin: boolean;
  onOpenContactWithCategory: (category: ContactIssueCategory) => void;
}

export const PrivacyAndLegalPage: React.FC<PrivacyAndLegalPageProps> = ({
  canAccessCreatorAdmin,
  onOpenContactWithCategory,
}) => {
  const {
    siteConfig,
    saveSiteConfig,
    sectionHeaders,
    saveSectionHeader,
    resetSectionHeader,
  } = useFirebaseApp();

  const [isEditingPolicy, setIsEditingPolicy] = useState(false);
  const [policyDraft, setPolicyDraft] = useState(
    siteConfig.privacyPolicySummary || DEFAULT_PRIVACY_POLICY_SUMMARY
  );
  const [disclosureDraft, setDisclosureDraft] = useState(
    siteConfig.defaultDisclosureText
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  useEffect(() => {
    setPolicyDraft(
      siteConfig.privacyPolicySummary || DEFAULT_PRIVACY_POLICY_SUMMARY
    );
    setDisclosureDraft(siteConfig.defaultDisclosureText);
  }, [siteConfig.privacyPolicySummary, siteConfig.defaultDisclosureText]);

  async function handleSavePrivacySummary(e: React.FormEvent) {
    e.preventDefault();
    if (!canAccessCreatorAdmin) return;
    setSaving(true);
    setFeedback(null);
    try {
      await saveSiteConfig({
        siteTagline: siteConfig.siteTagline,
        announcementEnabled: siteConfig.announcementEnabled,
        announcementText: siteConfig.announcementText,
        announcementCtaLabel: siteConfig.announcementCtaLabel,
        announcementTargetSection: siteConfig.announcementTargetSection,
        freeShippingThresholdCents: siteConfig.freeShippingThresholdCents,
        flatShippingCents: siteConfig.flatShippingCents,
        defaultDisclosureText: disclosureDraft,
        storeCheckoutEnabled: siteConfig.storeCheckoutEnabled,
        blogEnabled: siteConfig.blogEnabled,
        storeEnabled: siteConfig.storeEnabled,
        productAffiliateEnabled: siteConfig.productAffiliateEnabled,
        serviceAffiliateEnabled: siteConfig.serviceAffiliateEnabled,
        showStarterSeeds: siteConfig.showStarterSeeds,
        hiddenSeedIds: siteConfig.hiddenSeedIds,
        privacyPolicySummary: policyDraft,
      });
      setIsEditingPolicy(false);
      setFeedback({
        ok: true,
        text: 'Privacy & disclosure statement updated live.',
      });
    } catch (err) {
      setFeedback({
        ok: false,
        text:
          err instanceof Error
            ? err.message
            : 'Unable to save privacy statement.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="max-w-[1120px] mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-10">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-stone-200/90">
        <EditableSectionHeader
          copy={sectionHeaders.privacyMasthead}
          onSave={(nextCopy) => saveSectionHeader('privacyMasthead', nextCopy)}
          onReset={() => resetSectionHeader('privacyMasthead')}
          level="h1"
          className="max-w-3xl"
          canEdit={canAccessCreatorAdmin}
        />

        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto shrink-0">
          {canAccessCreatorAdmin && (
            <button
              type="button"
              onClick={() => {
                setIsEditingPolicy((prev) => !prev);
                setFeedback(null);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-900 bg-white border border-stone-300 hover:border-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#9A3412]" />
              <span>
                {isEditingPolicy ? 'Cancel Editing' : 'Edit Privacy Statement'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenContactWithCategory('privacy_issue')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Report a Private or Data Issue</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`px-4 py-3 rounded-xl border text-xs ${
            feedback.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {canAccessCreatorAdmin && isEditingPolicy ? (
        <form
          onSubmit={(e) => void handleSavePrivacySummary(e)}
          className="bg-white border border-stone-300 rounded-2xl p-6 sm:p-8 space-y-4"
        >
          <div className="text-xs font-semibold text-[#9A3412]">
            Customize Executive Privacy &amp; Affiliate Disclosure Copy
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1.5">
              Executive Privacy &amp; Data Protection Summary
            </label>
            <textarea
              rows={5}
              required
              minLength={10}
              maxLength={5000}
              value={policyDraft}
              onChange={(e) => setPolicyDraft(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1.5">
              Global FTC Affiliate &amp; Commerce Disclosure
            </label>
            <textarea
              rows={3}
              required
              minLength={10}
              maxLength={400}
              value={disclosureDraft}
              onChange={(e) => setDisclosureDraft(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={() => setIsEditingPolicy(false)}
              className="px-4 py-2 text-xs font-medium text-stone-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] disabled:bg-stone-300 rounded-lg transition-colors cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Privacy & Disclosure'}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-[#9A3412]">
            <Lock className="w-3.5 h-3.5" />
            <span>Executive Privacy Summary</span>
          </div>
          <p className="text-sm sm:text-base text-stone-700 leading-relaxed whitespace-pre-line">
            {siteConfig.privacyPolicySummary || DEFAULT_PRIVACY_POLICY_SUMMARY}
          </p>
        </div>
      )}

      {/* Detailed 6-Section Privacy, Security & Private Issue Architecture */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 space-y-2.5">
          <div className="text-xs font-medium text-[#9A3412]">
            01. Account &amp; Split-Collection Identity Vaults
          </div>
          <h3 className="font-serif text-lg font-medium text-stone-900">
            Public Bylines Separated from Private Credentials
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            When you create an account via Google or Email &amp; Password, only your display name, optional bio, and storefront name are stored in your public profile. Your email address, affiliate tracking IDs, and payout accounts are isolated inside a private subcollection (<span className="font-mono text-[11px]">/users/&#123;uid&#125;/private/info</span>) readable solely by your authenticated session.
          </p>
        </div>

        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 space-y-2.5">
          <div className="text-xs font-medium text-[#9A3412]">
            02. Guest Checkout &amp; Masked Payment Records
          </div>
          <h3 className="font-serif text-lg font-medium text-stone-900">
            Zero Raw Card Storage &amp; Strict Order Access
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            Visitors may purchase Store items as guests without registering an account. Pickras never collects or stores full 16-digit card numbers or CVV codes—only masked confirmation references (such as last-4 digits or Telebirr/CBE Birr/PayPal receipt IDs). Order records are restricted to the buyer, the fulfilling seller, and the Pickras administrator.
          </p>
        </div>

        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 space-y-2.5">
          <div className="text-xs font-medium text-[#9A3412]">
            03. Seller Payout Confidentiality
          </div>
          <h3 className="font-serif text-lg font-medium text-stone-900">
            Protected Creator Settlement Accounts
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            Independent sellers configuring Telebirr, Commercial Bank of Ethiopia, Awash Bank, CBE Birr, PayPal, Stripe, or Wise accounts retain exclusive control over their payout vault. Other sellers and public shoppers can never view or enumerate your payout destination details.
          </p>
        </div>

        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 space-y-2.5">
          <div className="text-xs font-medium text-[#9A3412]">
            04. Protected Digital Deliverable Vault
          </div>
          <h3 className="font-serif text-lg font-medium text-stone-900">
            Post-Purchase Unlock for Digital Files
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            Digital products (PDFs, ZIP archives, Excel workbooks, eBooks, HTML templates, and software tools) are stripped from public storefront listings and stored inside <span className="font-mono text-[11px]">/productSecrets</span>. Download links unlock atomically only after a verified order is completed, and executable malware extensions are strictly blocked on upload.
          </p>
        </div>

        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 space-y-2.5">
          <div className="text-xs font-medium text-[#9A3412]">
            05. Affiliate &amp; Partner Platform Disclosure
          </div>
          <h3 className="font-serif text-lg font-medium text-stone-900">
            Transparent Outbound Partner Links
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            {siteConfig.defaultDisclosureText} Clicking an external listing in the Product Affiliate or Service Affiliate modules directs you to the official partner marketplace (such as Amazon, Digistore24, Fiverr, or Upwork), where that platform&apos;s own privacy policy governs your transaction.
          </p>
        </div>

        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 space-y-2.5">
          <div className="text-xs font-medium text-[#9A3412]">
            06. Local Storage, Data Rights &amp; Private Issues
          </div>
          <h3 className="font-serif text-lg font-medium text-stone-900">
            Access, Correction, Deletion &amp; Confidential Escalation
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            Pickras uses browser local storage strictly for functional shopping-bag persistence, promo codes, and guest order receipts on your device—never for third-party behavioral ad tracking. You may request account deletion, order PII removal, copyright review, or confidential escalation at any time.
          </p>
        </div>
      </div>

      {/* Private Issue Escalation Banner */}
      <div className="bg-[#F5F2EB] border border-stone-200/90 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1 max-w-2xl">
          <div className="text-xs font-semibold text-[#9A3412]">
            Confidential Private Issue Channel
          </div>
          <h3 className="font-serif text-xl font-medium text-stone-900">
            Need to report a private account, payment, copyright, or personal data issue?
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            Submit a confidential report directly to the Pickras administrator. Submissions are restricted at the database rule level so only you and the site owner can view them.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenContactWithCategory('privacy_issue')}
          className="px-5 py-2.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          Open Private Issue Form →
        </button>
      </div>
    </section>
  );
};
