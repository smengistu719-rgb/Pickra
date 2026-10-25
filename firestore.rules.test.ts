/**
 * Pickra Zero-Trust Firestore Security Rules Verification Suite
 * Validates all Dirty Dozen adversarial payloads return PERMISSION_DENIED.
 */

export interface DirtyDozenAssertion {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
  enforcedGate: string;
}

export const DIRTY_DOZEN_SUITE: DirtyDozenAssertion[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on UserProfile (isAdmin: true)',
    collectionPath: '/users/user_1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: "isValidUserProfile -> data.keys().hasOnly(['uid', 'displayName', 'bio', 'isSeller', 'storeName', 'createdAt', 'updatedAt'])",
  },
  {
    id: 2,
    name: 'Unverified Email Spoofing Bootstrapped Owner',
    collectionPath: '/posts/post_1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: 'isVerifiedUser() -> request.auth.token.email_verified == true',
  },
  {
    id: 3,
    name: 'Non-Owner Reading Private Payout Account',
    collectionPath: '/users/user_a/private/info',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: 'isOwner(userId) && Master Gate parent check',
  },
  {
    id: 4,
    name: 'Non-Admin Publishing Affiliate Offer',
    collectionPath: '/offers/offer_1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: 'isAdmin()',
  },
  {
    id: 5,
    name: 'Seller Identity Spoofing on DirectProduct',
    collectionPath: '/directProducts/prod_1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: 'incoming().sellerId == request.auth.uid',
  },
  {
    id: 6,
    name: 'Orphaned DirectProduct Without /users/{uid}',
    collectionPath: '/directProducts/prod_2',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: 'exists(/databases/$(database)/documents/users/$(incoming().sellerId))',
  },
  {
    id: 7,
    name: 'Seller Self-Marking Order paid_out',
    collectionPath: '/directOrders/ord_1',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: "Seller affectedKeys().hasOnly excludes 'payoutStatus' & 'payoutNote'",
  },
  {
    id: 8,
    name: 'Buyer Creating Order Already Marked paid_out',
    collectionPath: '/directOrders/ord_2',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: "incoming().payoutStatus in ['pending', 'not_applicable']",
  },
  {
    id: 9,
    name: 'Terminal Order Mutation by Seller',
    collectionPath: '/directOrders/ord_1',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: "!(existing().status in ['fulfilled', 'cancelled'])",
  },
  {
    id: 10,
    name: 'Blanket Order Scraping on allow list',
    collectionPath: '/directOrders',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: 'existing().buyerId == request.auth.uid || existing().sellerId == request.auth.uid || isBootstrappedAdmin()',
  },
  {
    id: 11,
    name: 'Oversized Image Resource Poisoning (>180KB)',
    collectionPath: '/directProducts/prod_3',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: 'data.imageKey.size() <= 180000 && isValidId(productId)',
  },
  {
    id: 12,
    name: 'Client Timestamp Forgery on BlogPost',
    collectionPath: '/posts/post_2',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: 'incoming().createdAt == request.time',
  },
];
