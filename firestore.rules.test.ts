/**
 * Pickra Zero-Trust Firestore Security Rules Verification Suite
 * Validates all Dirty Dozen adversarial payloads across Guest, Buyer, Seller, Suspended Seller, and Admin roles.
 */

export interface DirtyDozenAssertion {
  id: number;
  name: string;
  actorRole: 'guest' | 'buyer' | 'active_seller' | 'suspended_seller' | 'spoofed_email';
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
  enforcedGate: string;
}

export const DIRTY_DOZEN_SUITE: DirtyDozenAssertion[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on UserProfile (isAdmin: true)',
    actorRole: 'buyer',
    collectionPath: '/users/user_1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate:
      "isValidUserProfile -> data.keys().hasOnly(['uid', 'displayName', 'bio', 'isSeller', 'sellerStatus', 'storeName', 'createdAt', 'updatedAt'])",
  },
  {
    id: 2,
    name: 'Unverified Email Spoofing Bootstrapped Owner on BlogPost',
    actorRole: 'spoofed_email',
    collectionPath: '/posts/post_1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: 'isBootstrappedAdmin() -> request.auth.token.email_verified == true',
  },
  {
    id: 3,
    name: 'Non-Owner Buyer Reading Private Seller Payout Account',
    actorRole: 'buyer',
    collectionPath: '/users/seller_a/private/info',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: 'isOwner(userId) && Master Gate parent check',
  },
  {
    id: 4,
    name: 'Unactivated Buyer Attempting to Create Store Product',
    actorRole: 'buyer',
    collectionPath: '/directProducts/prod_unactivated',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: 'isActiveSellerUser(request.auth.uid) requires isSeller == true, sellerStatus == active, and configured payout account',
  },
  {
    id: 5,
    name: 'Active Seller Bypassing Admin Approval to Self-Publish Product',
    actorRole: 'active_seller',
    collectionPath: '/directProducts/prod_bypass',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: "incoming().status == 'draft' && incoming().approvalStatus == 'pending' for non-admin sellers",
  },
  {
    id: 6,
    name: 'Active Seller Modifying Another Seller Product',
    actorRole: 'active_seller',
    collectionPath: '/directProducts/prod_seller_a',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: 'existing().sellerId == request.auth.uid',
  },
  {
    id: 7,
    name: 'Unpurchased Visitor Scraping Protected Digital File Vault',
    actorRole: 'guest',
    collectionPath: '/productSecrets/prod_dig_1',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: '/productSecrets allow get requires owner, admin, or active 5m atomic order unlock window',
  },
  {
    id: 8,
    name: 'Guest Zeroing Physical Stock Without Atomic Order Creation',
    actorRole: 'guest',
    collectionPath: '/directProducts/prod_phys_1',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: '!exists(/directOrders/$(lastOrderRef)) && existsAfter(/directOrders/$(lastOrderRef))',
  },
  {
    id: 9,
    name: 'Suspended Seller Attempting to Self-Unsuspend Profile',
    actorRole: 'suspended_seller',
    collectionPath: '/users/seller_suspended',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: "existing().sellerStatus != 'suspended'",
  },
  {
    id: 10,
    name: 'Seller Self-Marking Order Payout as paid_out',
    actorRole: 'active_seller',
    collectionPath: '/directOrders/ord_1',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: "Seller affectedKeys().hasOnly excludes 'payoutStatus' & 'payoutNote'",
  },
  {
    id: 11,
    name: 'Blanket Customer Order Scraping on allow list',
    actorRole: 'buyer',
    collectionPath: '/directOrders',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: 'existing().buyerId == request.auth.uid || existing().sellerId == request.auth.uid || isBootstrappedAdmin()',
  },
  {
    id: 12,
    name: 'Oversized Image Value Poisoning (>180KB) on Update',
    actorRole: 'active_seller',
    collectionPath: '/directProducts/prod_own',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedGate: 'isValidDirectProduct(incoming()) wraps allow update and enforces data.imageKey.size() <= 180000',
  },
];
