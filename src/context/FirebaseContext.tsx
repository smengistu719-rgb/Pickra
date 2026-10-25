import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  generateSafeDocId,
  googleProvider,
  handleFirestoreError,
  OperationType,
  toSafeSlug,
  VALIDATION_LIMITS,
} from '../firebase';
import {
  AffiliateOffer,
  BlogPost,
  PublishStatus,
  UserPrivateInfo,
  UserProfile,
} from '../types';
import { DEFAULT_DISCLOSURE, SEED_OFFERS, SEED_POSTS } from '../data/editorialSeed';

export interface OfferDraftInput {
  id?: string;
  title: string;
  kind: AffiliateOffer['kind'];
  platform: AffiliateOffer['platform'];
  category: string;
  priceLabel: string;
  commissionNote: string;
  affiliateUrl: string;
  imageKey: string;
  summary: string;
  highlights: string[];
  status: PublishStatus;
}

export interface PostDraftInput {
  id?: string;
  title: string;
  subtitle: string;
  slug?: string;
  category: BlogPost['category'];
  readTimeMinutes: number;
  coverImageKey: string;
  content: string;
  attachedOfferIds: string[];
  disclosureText: string;
  featured: boolean;
  status: PublishStatus;
  publishedLabel: string;
}

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  loadingData: boolean;
  profile: UserProfile | null;
  privateInfo: UserPrivateInfo | null;
  publishedPosts: BlogPost[];
  publishedOffers: AffiliateOffer[];
  studioPosts: BlogPost[];
  studioOffers: AffiliateOffer[];
  allAccessibleOffersMap: Record<string, AffiliateOffer>;
  clickCounts: Record<string, number>;
  hasFirestoreContent: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  saveOffer: (input: OfferDraftInput) => Promise<string>;
  updateOfferStatus: (offerId: string, status: PublishStatus) => Promise<void>;
  deleteOffer: (offerId: string) => Promise<void>;
  savePost: (input: PostDraftInput) => Promise<string>;
  updatePostStatus: (postId: string, status: PublishStatus) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  saveProfileAndAffiliateTags: (input: {
    displayName: string;
    bio: string;
    defaultAmazonTag: string;
    defaultDigistoreId: string;
  }) => Promise<void>;
  importStarterCatalog: () => Promise<void>;
  recordOutboundClick: (offerId: string) => void;
}

const CLICK_STORAGE_KEY = 'fieldfolio_outbound_clicks_v1';
const HIDE_SEEDS_KEY = 'fieldfolio_hide_starter_seeds_v1';

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

function timestampToMs(val: unknown): number {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (val && typeof val === 'object' && 'seconds' in val && typeof (val as { seconds: number }).seconds === 'number') {
    return (val as { seconds: number }).seconds * 1000;
  }
  return Date.now();
}

function parseOfferDoc(id: string, data: Record<string, unknown>): AffiliateOffer {
  return {
    id,
    authorId: String(data.authorId || ''),
    authorName: String(data.authorName || 'Editorial Contributor'),
    title: String(data.title || ''),
    kind: (data.kind as AffiliateOffer['kind']) || 'physical',
    platform: (data.platform as AffiliateOffer['platform']) || 'Amazon',
    category: String(data.category || 'General'),
    priceLabel: String(data.priceLabel || ''),
    commissionNote: String(data.commissionNote || ''),
    affiliateUrl: String(data.affiliateUrl || ''),
    imageKey: String(data.imageKey || 'workspace'),
    summary: String(data.summary || ''),
    highlights: Array.isArray(data.highlights)
      ? data.highlights.map((h) => String(h)).slice(0, 4)
      : [],
    status: (data.status as PublishStatus) || 'draft',
    isSeed: false,
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

function parsePostDoc(id: string, data: Record<string, unknown>): BlogPost {
  return {
    id,
    authorId: String(data.authorId || ''),
    authorName: String(data.authorName || 'Editorial Contributor'),
    title: String(data.title || ''),
    subtitle: String(data.subtitle || ''),
    slug: String(data.slug || id),
    category: (data.category as BlogPost['category']) || 'Field Guides',
    readTimeMinutes: Number(data.readTimeMinutes || 5),
    coverImageKey: String(data.coverImageKey || 'workspace'),
    content: String(data.content || ''),
    attachedOfferIds: Array.isArray(data.attachedOfferIds)
      ? data.attachedOfferIds.map((item) => String(item)).slice(0, 8)
      : [],
    disclosureText: String(data.disclosureText || DEFAULT_DISCLOSURE),
    featured: Boolean(data.featured),
    status: (data.status as PublishStatus) || 'draft',
    publishedLabel: String(data.publishedLabel || 'Recent Dispatch'),
    isSeed: false,
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo | null>(null);

  const [publicFirestoreOffers, setPublicFirestoreOffers] = useState<AffiliateOffer[]>([]);
  const [publicFirestorePosts, setPublicFirestorePosts] = useState<BlogPost[]>([]);

  const [authorFirestoreOffers, setAuthorFirestoreOffers] = useState<AffiliateOffer[]>([]);
  const [authorFirestorePosts, setAuthorFirestorePosts] = useState<BlogPost[]>([]);

  const [hideSeeds, setHideSeeds] = useState<boolean>(() => {
    try {
      return localStorage.getItem(HIDE_SEEDS_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [clickCounts, setClickCounts] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(CLICK_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {
        seed_offer_planar_dac: 42,
        seed_offer_digistore_os: 67,
        seed_offer_upwork_architect: 31,
        seed_offer_fiverr_brand: 28,
        seed_offer_field_ssd: 19,
        seed_offer_gumroad_seo: 53,
      };
    } catch {
      return {};
    }
  });

  // Track Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Ensure Author Public Profile & Split Private Info exist upon verified Google Sign-In
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setProfile(null);
      setPrivateInfo(null);
      return;
    }

    let cancelled = false;

    async function bootstrapUserRecords(currentUser: User) {
      const userPath = `users/${currentUser.uid}`;
      const privatePath = `users/${currentUser.uid}/private/info`;

      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);

        const defaultName = (
          currentUser.displayName ||
          currentUser.email?.split('@')[0] ||
          'Publisher'
        )
          .trim()
          .slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX);

        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: currentUser.uid,
            displayName: defaultName,
            bio: 'Independent affiliate publisher curating tested physical gear, digital workflows, and specialist talent.',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          if (!cancelled) {
            setProfile({
              uid: currentUser.uid,
              displayName: defaultName,
              bio: 'Independent affiliate publisher curating tested physical gear, digital workflows, and specialist talent.',
            });
          }
        } else if (!cancelled) {
          const d = userSnap.data();
          setProfile({
            uid: currentUser.uid,
            displayName: String(d.displayName || defaultName),
            bio: String(d.bio || ''),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, userPath);
      }

      try {
        const privRef = doc(db, 'users', currentUser.uid, 'private', 'info');
        const privSnap = await getDoc(privRef);
        const safeEmail = (currentUser.email || 'publisher@example.com').slice(0, 254);

        if (!privSnap.exists()) {
          await setDoc(privRef, {
            uid: currentUser.uid,
            email: safeEmail,
            defaultAmazonTag: '',
            defaultDigistoreId: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          if (!cancelled) {
            setPrivateInfo({
              uid: currentUser.uid,
              email: safeEmail,
              defaultAmazonTag: '',
              defaultDigistoreId: '',
            });
          }
        } else if (!cancelled) {
          const pd = privSnap.data();
          setPrivateInfo({
            uid: currentUser.uid,
            email: String(pd.email || safeEmail),
            defaultAmazonTag: String(pd.defaultAmazonTag || ''),
            defaultDigistoreId: String(pd.defaultDigistoreId || ''),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, privatePath);
      }
    }

    void bootstrapUserRecords(user);
    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  // Public listeners: Published Offers & Published Posts (rule-enforced status == 'published')
  useEffect(() => {
    if (!authReady) return;

    let offersLoaded = false;
    let postsLoaded = false;

    const publishedOffersQuery = query(
      collection(db, 'offers'),
      where('status', '==', 'published')
    );

    const publishedPostsQuery = query(
      collection(db, 'posts'),
      where('status', '==', 'published')
    );

    const unsubOffers = onSnapshot(
      publishedOffersQuery,
      (snap) => {
        const items = snap.docs.map((d) =>
          parseOfferDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setPublicFirestoreOffers(items);
        offersLoaded = true;
        if (postsLoaded) setLoadingData(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'offers');
      }
    );

    const unsubPosts = onSnapshot(
      publishedPostsQuery,
      (snap) => {
        const items = snap.docs.map((d) =>
          parsePostDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setPublicFirestorePosts(items);
        postsLoaded = true;
        if (offersLoaded) setLoadingData(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'posts');
      }
    );

    return () => {
      unsubOffers();
      unsubPosts();
    };
  }, [authReady]);

  // Authenticated Studio listeners: Author's own drafts, published, & archived records
  useEffect(() => {
    if (!authReady || !user) {
      setAuthorFirestoreOffers([]);
      setAuthorFirestorePosts([]);
      return;
    }

    const myOffersQuery = query(
      collection(db, 'offers'),
      where('authorId', '==', user.uid)
    );
    const myPostsQuery = query(
      collection(db, 'posts'),
      where('authorId', '==', user.uid)
    );

    const unsubMyOffers = onSnapshot(
      myOffersQuery,
      (snap) => {
        const items = snap.docs.map((d) =>
          parseOfferDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setAuthorFirestoreOffers(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'offers');
      }
    );

    const unsubMyPosts = onSnapshot(
      myPostsQuery,
      (snap) => {
        const items = snap.docs.map((d) =>
          parsePostDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setAuthorFirestorePosts(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'posts');
      }
    );

    return () => {
      unsubMyOffers();
      unsubMyPosts();
    };
  }, [authReady, user]);

  const hasFirestoreContent =
    publicFirestoreOffers.length > 0 ||
    publicFirestorePosts.length > 0 ||
    authorFirestoreOffers.length > 0 ||
    authorFirestorePosts.length > 0;

  const publishedOffers = useMemo(() => {
    const includeSeeds = !hideSeeds;
    const map = new Map<string, AffiliateOffer>();
    for (const offer of publicFirestoreOffers) {
      map.set(offer.id, offer);
    }
    if (includeSeeds) {
      for (const seed of SEED_OFFERS) {
        if (!map.has(seed.id)) {
          map.set(seed.id, seed);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [publicFirestoreOffers, hideSeeds]);

  const publishedPosts = useMemo(() => {
    const includeSeeds = !hideSeeds;
    const map = new Map<string, BlogPost>();
    for (const post of publicFirestorePosts) {
      map.set(post.id, post);
    }
    if (includeSeeds) {
      for (const seed of SEED_POSTS) {
        if (!map.has(seed.id)) {
          map.set(seed.id, seed);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return b.updatedAtMs - a.updatedAtMs;
    });
  }, [publicFirestorePosts, hideSeeds]);

  const studioOffers = useMemo(() => {
    const map = new Map<string, AffiliateOffer>();
    for (const offer of authorFirestoreOffers) {
      map.set(offer.id, offer);
    }
    for (const offer of publicFirestoreOffers) {
      if (!map.has(offer.id)) {
        map.set(offer.id, offer);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [authorFirestoreOffers, publicFirestoreOffers]);

  const studioPosts = useMemo(() => {
    const map = new Map<string, BlogPost>();
    for (const post of authorFirestorePosts) {
      map.set(post.id, post);
    }
    for (const post of publicFirestorePosts) {
      if (!map.has(post.id)) {
        map.set(post.id, post);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [authorFirestorePosts, publicFirestorePosts]);

  const allAccessibleOffersMap = useMemo(() => {
    const record: Record<string, AffiliateOffer> = {};
    for (const seed of SEED_OFFERS) {
      record[seed.id] = seed;
    }
    for (const pub of publicFirestoreOffers) {
      record[pub.id] = pub;
    }
    for (const own of authorFirestoreOffers) {
      record[own.id] = own;
    }
    return record;
  }, [publicFirestoreOffers, authorFirestoreOffers]);

  async function signInWithGoogle() {
    await signInWithPopup(auth, googleProvider);
  }

  async function signOutUser() {
    await signOut(auth);
  }

  async function ensureParentUserProfileExists(currentUser: User): Promise<string> {
    const userRef = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(userRef);
    const fallbackName = (
      profile?.displayName ||
      currentUser.displayName ||
      currentUser.email?.split('@')[0] ||
      'Publisher'
    )
      .trim()
      .slice(0, VALIDATION_LIMITS.DISPLAY_NAME_MAX);

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: currentUser.uid,
        displayName: fallbackName,
        bio: 'Independent affiliate publisher curating tested physical gear, digital workflows, and specialist talent.',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return fallbackName;
    }
    return String(snap.data().displayName || fallbackName).slice(
      0,
      VALIDATION_LIMITS.DISPLAY_NAME_MAX
    );
  }

  async function saveOffer(input: OfferDraftInput): Promise<string> {
    if (!user) throw new Error('Please sign in to save an affiliate offering.');

    const cleanTitle = input.title.trim().slice(0, VALIDATION_LIMITS.OFFER_TITLE_MAX);
    const cleanCategory = (input.category.trim() || 'General').slice(
      0,
      VALIDATION_LIMITS.OFFER_CATEGORY_MAX
    );
    const cleanPrice = (input.priceLabel.trim() || 'Check price').slice(
      0,
      VALIDATION_LIMITS.PRICE_LABEL_MAX
    );
    const cleanCommission = input.commissionNote
      .trim()
      .slice(0, VALIDATION_LIMITS.COMMISSION_NOTE_MAX);

    let cleanUrl = input.affiliateUrl.trim();
    if (cleanUrl && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('http://')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    if (cleanUrl.startsWith('http://')) {
      cleanUrl = `https://${cleanUrl.slice(7)}`;
    }
    cleanUrl = cleanUrl.slice(0, VALIDATION_LIMITS.URL_MAX);

    if (!VALIDATION_LIMITS.HTTPS_URL_REGEX.test(cleanUrl)) {
      throw new Error('Affiliate destination URL must be a valid https:// link.');
    }

    const cleanImageKey = (input.imageKey.trim() || 'workspace').slice(
      0,
      VALIDATION_LIMITS.URL_MAX
    );
    const cleanSummary = input.summary.trim().slice(0, VALIDATION_LIMITS.SUMMARY_MAX);
    if (cleanSummary.length < VALIDATION_LIMITS.SUMMARY_MIN) {
      throw new Error('Summary verdict must be at least 10 characters.');
    }

    const cleanHighlights = input.highlights
      .map((item) => item.trim().slice(0, VALIDATION_LIMITS.HIGHLIGHT_ITEM_MAX))
      .filter((item) => item.length >= 1)
      .slice(0, VALIDATION_LIMITS.HIGHLIGHTS_MAX_COUNT);

    const authorName = await ensureParentUserProfileExists(user);
    const isUpdate = Boolean(input.id && !input.id.startsWith('seed_'));
    const offerId = isUpdate && input.id ? input.id : generateSafeDocId('offer');
    const path = `offers/${offerId}`;

    try {
      if (isUpdate) {
        await updateDoc(doc(db, 'offers', offerId), {
          authorName,
          title: cleanTitle,
          kind: input.kind,
          platform: input.platform,
          category: cleanCategory,
          priceLabel: cleanPrice,
          commissionNote: cleanCommission,
          affiliateUrl: cleanUrl,
          imageKey: cleanImageKey,
          summary: cleanSummary,
          highlights: cleanHighlights,
          status: input.status,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'offers', offerId), {
          authorId: user.uid,
          authorName,
          title: cleanTitle,
          kind: input.kind,
          platform: input.platform,
          category: cleanCategory,
          priceLabel: cleanPrice,
          commissionNote: cleanCommission,
          affiliateUrl: cleanUrl,
          imageKey: cleanImageKey,
          summary: cleanSummary,
          highlights: cleanHighlights,
          status: input.status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      return offerId;
    } catch (err) {
      handleFirestoreError(
        err,
        isUpdate ? OperationType.UPDATE : OperationType.CREATE,
        path
      );
    }
  }

  async function updateOfferStatus(offerId: string, status: PublishStatus) {
    if (!user) throw new Error('Please sign in first.');
    const path = `offers/${offerId}`;
    try {
      await updateDoc(doc(db, 'offers', offerId), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async function deleteOffer(offerId: string) {
    if (!user) throw new Error('Please sign in first.');
    const path = `offers/${offerId}`;
    try {
      await deleteDoc(doc(db, 'offers', offerId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }

  async function savePost(input: PostDraftInput): Promise<string> {
    if (!user) throw new Error('Please sign in to publish or save a blog dispatch.');

    const cleanTitle = input.title.trim().slice(0, VALIDATION_LIMITS.POST_TITLE_MAX);
    if (cleanTitle.length < VALIDATION_LIMITS.POST_TITLE_MIN) {
      throw new Error('Headline must be at least 4 characters.');
    }

    const cleanSubtitle = input.subtitle
      .trim()
      .slice(0, VALIDATION_LIMITS.POST_SUBTITLE_MAX);
    if (cleanSubtitle.length < VALIDATION_LIMITS.POST_SUBTITLE_MIN) {
      throw new Error('Article subtitle must be at least 8 characters.');
    }

    const cleanSlug = toSafeSlug(input.slug || cleanTitle);
    const cleanReadMinutes = Math.max(
      1,
      Math.min(60, Math.round(Number(input.readTimeMinutes) || 5))
    );
    const cleanCover = (input.coverImageKey.trim() || 'workspace').slice(
      0,
      VALIDATION_LIMITS.URL_MAX
    );

    const cleanContent = input.content
      .trim()
      .slice(0, VALIDATION_LIMITS.POST_CONTENT_MAX);
    if (cleanContent.length < VALIDATION_LIMITS.POST_CONTENT_MIN) {
      throw new Error('Blog article body must be at least 20 characters.');
    }

    const cleanAttachedIds = Array.from(new Set(input.attachedOfferIds))
      .filter((oid) => VALIDATION_LIMITS.ID_REGEX.test(oid) && oid.length <= 128)
      .slice(0, VALIDATION_LIMITS.POST_ATTACHED_OFFERS_MAX);

    const cleanDisclosure = (
      input.disclosureText.trim() || DEFAULT_DISCLOSURE
    ).slice(0, VALIDATION_LIMITS.DISCLOSURE_MAX);

    const cleanPublishedLabel = (
      input.publishedLabel.trim() ||
      new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    ).slice(0, 40);

    const authorName = await ensureParentUserProfileExists(user);
    const isUpdate = Boolean(input.id && !input.id.startsWith('seed_'));
    const postId = isUpdate && input.id ? input.id : generateSafeDocId('post');
    const path = `posts/${postId}`;

    try {
      if (isUpdate) {
        await updateDoc(doc(db, 'posts', postId), {
          authorName,
          title: cleanTitle,
          subtitle: cleanSubtitle,
          slug: cleanSlug,
          category: input.category,
          readTimeMinutes: cleanReadMinutes,
          coverImageKey: cleanCover,
          content: cleanContent,
          attachedOfferIds: cleanAttachedIds,
          disclosureText: cleanDisclosure,
          featured: Boolean(input.featured),
          status: input.status,
          publishedLabel: cleanPublishedLabel,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'posts', postId), {
          authorId: user.uid,
          authorName,
          title: cleanTitle,
          subtitle: cleanSubtitle,
          slug: cleanSlug,
          category: input.category,
          readTimeMinutes: cleanReadMinutes,
          coverImageKey: cleanCover,
          content: cleanContent,
          attachedOfferIds: cleanAttachedIds,
          disclosureText: cleanDisclosure,
          featured: Boolean(input.featured),
          status: input.status,
          publishedLabel: cleanPublishedLabel,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      return postId;
    } catch (err) {
      handleFirestoreError(
        err,
        isUpdate ? OperationType.UPDATE : OperationType.CREATE,
        path
      );
    }
  }

  async function updatePostStatus(postId: string, status: PublishStatus) {
    if (!user) throw new Error('Please sign in first.');
    const path = `posts/${postId}`;
    const publishedLabel = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    try {
      await updateDoc(doc(db, 'posts', postId), {
        status,
        publishedLabel,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async function deletePost(postId: string) {
    if (!user) throw new Error('Please sign in first.');
    const path = `posts/${postId}`;
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }

  async function saveProfileAndAffiliateTags(input: {
    displayName: string;
    bio: string;
    defaultAmazonTag: string;
    defaultDigistoreId: string;
  }) {
    if (!user) throw new Error('Please sign in first.');

    const cleanName = (input.displayName.trim() || 'Publisher').slice(
      0,
      VALIDATION_LIMITS.DISPLAY_NAME_MAX
    );
    const cleanBio = input.bio.trim().slice(0, VALIDATION_LIMITS.BIO_MAX);
    const cleanAmazon = input.defaultAmazonTag.trim().slice(0, 60);
    const cleanDigistore = input.defaultDigistoreId.trim().slice(0, 60);
    const safeEmail = (user.email || 'publisher@example.com').slice(0, 254);

    await ensureParentUserProfileExists(user);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: cleanName,
        bio: cleanBio,
        updatedAt: serverTimestamp(),
      });
      setProfile({
        uid: user.uid,
        displayName: cleanName,
        bio: cleanBio,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }

    try {
      const privRef = doc(db, 'users', user.uid, 'private', 'info');
      const snap = await getDoc(privRef);
      if (!snap.exists()) {
        await setDoc(privRef, {
          uid: user.uid,
          email: safeEmail,
          defaultAmazonTag: cleanAmazon,
          defaultDigistoreId: cleanDigistore,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(privRef, {
          email: safeEmail,
          defaultAmazonTag: cleanAmazon,
          defaultDigistoreId: cleanDigistore,
          updatedAt: serverTimestamp(),
        });
      }
      setPrivateInfo({
        uid: user.uid,
        email: safeEmail,
        defaultAmazonTag: cleanAmazon,
        defaultDigistoreId: cleanDigistore,
      });
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `users/${user.uid}/private/info`
      );
    }
  }

  async function importStarterCatalog() {
    if (!user) throw new Error('Please sign in to import starter items.');

    const idMap: Record<string, string> = {};
    for (const seedOffer of SEED_OFFERS) {
      const createdId = await saveOffer({
        title: seedOffer.title,
        kind: seedOffer.kind,
        platform: seedOffer.platform,
        category: seedOffer.category,
        priceLabel: seedOffer.priceLabel,
        commissionNote: seedOffer.commissionNote,
        affiliateUrl: seedOffer.affiliateUrl,
        imageKey: seedOffer.imageKey,
        summary: seedOffer.summary,
        highlights: seedOffer.highlights,
        status: 'published',
      });
      idMap[seedOffer.id] = createdId;
    }

    for (const seedPost of SEED_POSTS) {
      let remappedContent = seedPost.content;
      for (const [oldId, newId] of Object.entries(idMap)) {
        remappedContent = remappedContent.split(`[[offer:${oldId}]]`).join(`[[offer:${newId}]]`);
      }
      const remappedAttached = seedPost.attachedOfferIds.map(
        (oldId) => idMap[oldId] || oldId
      );
      await savePost({
        title: seedPost.title,
        subtitle: seedPost.subtitle,
        slug: seedPost.slug,
        category: seedPost.category,
        readTimeMinutes: seedPost.readTimeMinutes,
        coverImageKey: seedPost.coverImageKey,
        content: remappedContent,
        attachedOfferIds: remappedAttached,
        disclosureText: seedPost.disclosureText,
        featured: seedPost.featured,
        status: 'published',
        publishedLabel: seedPost.publishedLabel,
      });
    }

    setHideSeeds(true);
    try {
      localStorage.setItem(HIDE_SEEDS_KEY, 'true');
    } catch {
      // ignore storage errors
    }
  }

  function recordOutboundClick(offerId: string) {
    setClickCounts((prev) => {
      const next = { ...prev, [offerId]: (prev[offerId] || 0) + 1 };
      try {
        localStorage.setItem(CLICK_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        loadingData,
        profile,
        privateInfo,
        publishedPosts,
        publishedOffers,
        studioPosts,
        studioOffers,
        allAccessibleOffersMap,
        clickCounts,
        hasFirestoreContent,
        signInWithGoogle,
        signOutUser,
        saveOffer,
        updateOfferStatus,
        deleteOffer,
        savePost,
        updatePostStatus,
        deletePost,
        saveProfileAndAffiliateTags,
        importStarterCatalog,
        recordOutboundClick,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebaseApp() {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebaseApp must be used inside FirebaseProvider');
  }
  return ctx;
}
