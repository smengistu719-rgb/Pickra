/**
 * Phase 0 Zero-Trust Security Rules Test Specification
 * Verifies that all "Dirty Dozen" adversarial payloads return PERMISSION_DENIED.
 *
 * Execute against the Firebase Firestore Rules Emulator with @firebase/rules-unit-testing.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: null | {
    uid: string;
    email?: string;
    email_verified?: boolean;
  };
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_SECURITY_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Rejects shadow field injection (isVerifiedEditor) on post creation',
    operation: 'create',
    path: 'posts/post_shadow_1',
    auth: { uid: 'user_1', email: 'author@example.com', email_verified: true },
    payload: {
      authorId: 'user_1',
      authorName: 'Alice',
      title: 'Top Studio Gear',
      subtitle: 'Tested audio interfaces for creators',
      slug: 'top-studio-gear',
      category: 'Hardware & Gear',
      readTimeMinutes: 5,
      coverImageKey: 'audio',
      content: 'Detailed long-form review body exceeding twenty characters.',
      attachedOfferIds: [],
      disclosureText: 'We may earn a commission from qualifying purchases.',
      featured: false,
      status: 'published',
      publishedLabel: 'Oct 24, 2026',
      isVerifiedEditor: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Rejects spoofed admin email when email_verified is false',
    operation: 'create',
    path: 'admins/attacker_uid',
    auth: {
      uid: 'attacker_uid',
      email: 'mengistushimelis@gmail.com',
      email_verified: false,
    },
    payload: {
      uid: 'attacker_uid',
      grantedBy: 'attacker_uid',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Rejects cross-user PII read on /users/{victim}/private/info',
    operation: 'get',
    path: 'users/victim_uid/private/info',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Rejects identity spoofing when authorId does not match request.auth.uid',
    operation: 'create',
    path: 'offers/offer_spoof_1',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    payload: {
      authorId: 'victim_uid',
      authorName: 'Victim',
      title: 'Planar Headphones',
      kind: 'physical',
      platform: 'Amazon',
      category: 'Audio',
      priceLabel: '$349.00',
      commissionNote: '4%',
      affiliateUrl: 'https://www.amazon.com/dp/B08J9',
      imageKey: 'audio',
      summary: 'Balanced reference soundstage for mixing and mastering.',
      highlights: ['Open-back acoustic architecture'],
      status: 'published',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Rejects orphaned post creation when parent /users/{uid} profile does not exist',
    operation: 'create',
    path: 'posts/orphan_post_1',
    auth: { uid: 'ghost_uid', email: 'ghost@example.com', email_verified: true },
    payload: {
      authorId: 'ghost_uid',
      authorName: 'Ghost',
      title: 'Orphaned Post Title',
      subtitle: 'Valid length subtitle for orphaned check',
      slug: 'orphaned-post',
      category: 'Field Guides',
      readTimeMinutes: 4,
      coverImageKey: 'workspace',
      content: 'Valid article content body exceeding the minimum twenty character limit.',
      attachedOfferIds: [],
      disclosureText: 'Affiliate disclosure statement included here.',
      featured: false,
      status: 'published',
      publishedLabel: 'Oct 24, 2026',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Rejects non-HTTPS javascript: URI in affiliateUrl',
    operation: 'create',
    path: 'offers/xss_offer_1',
    auth: { uid: 'user_1', email: 'author@example.com', email_verified: true },
    payload: {
      authorId: 'user_1',
      authorName: 'Alice',
      title: 'Malicious Link Offer',
      kind: 'digital',
      platform: 'Digistore24',
      category: 'Software',
      priceLabel: '$49.00',
      commissionNote: '50%',
      affiliateUrl: 'javascript:alert(1)',
      imageKey: 'digital',
      summary: 'Attempted XSS payload inside affiliate destination URL.',
      highlights: [],
      status: 'published',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Rejects non-admin update to a post locked in terminal archived state',
    operation: 'update',
    path: 'posts/archived_post_1',
    auth: { uid: 'user_1', email: 'author@example.com', email_verified: true },
    payload: {
      status: 'published',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Rejects array element type poisoning in highlights[1]',
    operation: 'create',
    path: 'offers/array_poison_1',
    auth: { uid: 'user_1', email: 'author@example.com', email_verified: true },
    payload: {
      authorId: 'user_1',
      authorName: 'Alice',
      title: 'Array Poison Offer',
      kind: 'service',
      platform: 'Upwork',
      category: 'Engineering',
      priceLabel: '$95/hr',
      commissionNote: 'Referral',
      affiliateUrl: 'https://www.upwork.com/freelancers/example',
      imageKey: 'service',
      summary: 'Valid summary string for testing second array index validation.',
      highlights: ['Valid highlight', 99999],
      status: 'published',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Rejects unbounded array exceeding 8 attachedOfferIds',
    operation: 'create',
    path: 'posts/array_overflow_1',
    auth: { uid: 'user_1', email: 'author@example.com', email_verified: true },
    payload: {
      attachedOfferIds: ['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9'],
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Rejects poisoned document ID containing invalid characters',
    operation: 'create',
    path: 'offers/poisoned$id!',
    auth: { uid: 'user_1', email: 'author@example.com', email_verified: true },
    payload: {},
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Rejects client-forged createdAt timestamp not matching request.time',
    operation: 'create',
    path: 'posts/forged_time_1',
    auth: { uid: 'user_1', email: 'author@example.com', email_verified: true },
    payload: {
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Rejects unfiltered collection list scan that would expose draft posts',
    operation: 'list',
    path: 'posts',
    auth: null,
    expectedResult: 'PERMISSION_DENIED',
  },
];
