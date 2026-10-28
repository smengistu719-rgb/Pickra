# Pickra Zero-Trust Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants & Relational Sources of Truth

1. **Global Default-Deny Catch-All:** `match /{document=**} { allow read, write: if false; }` is the first block inside `match /databases/{database}/documents`.
2. **Trusted Admin Source of Truth:** Admin privileges derive strictly from either:
   - `isBootstrappedAdmin()` (`request.auth.token.email_verified == true && request.auth.token.email == 'mengistushimelis@gmail.com'`), or
   - `exists(/databases/$(database)/documents/admins/$(request.auth.uid))`.
   Client-writable profile fields can never grant admin permissions.
3. **PII Split-Collection Master Gate:**
   - `/users/{userId}` holds strictly non-PII profile fields (`uid`, `displayName`, `bio`, `isSeller`, `sellerStatus`, `storeName`, `createdAt`, `updatedAt`). `allow list` is restricted exclusively to `isBootstrappedAdmin()` (zero `get()`/`exists()` calls) so the website owner can monitor users and sellers without exposing user lists publicly.
   - `/users/{userId}/private/info` holds PII (`email`, `payoutMethod`, `payoutAccount`, `payoutAccounts`, affiliate tags) and enforces `isOwner(userId)` plus the Master Gate check on parent `/users/{userId}`. Suspended sellers cannot unsuspend their own `sellerStatus`.
4. **Seller Registration & Activation Gate (`isActiveSellerUser`):**
   - Non-admin users can create, update, or delete `/directProducts/{productId}` and `/productSecrets/{productId}` ONLY if:
     1. `/users/{uid}` exists with `isSeller == true` and `sellerStatus == 'active'` (not `'inactive'`, `'pending'`, or `'suspended'`), AND
     2. `/users/{uid}/private/info` exists with a configured `payoutMethod != 'None'` and `payoutAccount.size() >= 3`, AND
     3. `sellerId == request.auth.uid` (sellers can never modify another seller's products).
5. **Admin Product Review & Approval Gate:**
   - Non-admin sellers cannot self-approve or directly publish new or content-edited products: seller `create` and content `update` on `/directProducts` strictly enforce `incoming().status == 'draft'` and `incoming().approvalStatus == 'pending'`.
   - Only `isAdmin()` can set `approvalStatus == 'approved'` and publish a pending listing (or reject/edit/remove inappropriate listings). Once approved (`existing().approvalStatus == 'approved'`), an active seller may update only `['status', 'stockCount', 'updatedAt']` without bypassing content moderation.
6. **Digital File Vault Isolation (`/productSecrets/{productId}`):**
   - Public `/directProducts/{productId}` forbids storing non-empty `digitalFileUrl` (`digitalFileUrl == ''`), preventing unauthenticated Store visitors from scraping paid digital deliverables.
   - Actual digital URLs/files live in `/productSecrets/{productId}`, where `allow list` is restricted to `isBootstrappedAdmin()`, and `allow get` is restricted to the owning seller, `isAdmin()`, or a short-lived (`5m`) post-purchase capability window unlocked atomically via `existsAfter(/directOrders/$(incoming().lastOrderRef))` in the same batch as a newly created paid order containing `productId` (or re-unlocked by a verified buyer who owns an existing paid order containing `productId`).
7. **Guest Checkout, Atomic Inventory Decrement & Order PII Protection:**
   - Unauthenticated guests (`!isSignedIn() && isGuestBuyerId(buyerId)`) and verified signed-in buyers (`buyerId == request.auth.uid`) can create `paid` orders in `/directOrders/{orderId}` when `storeCheckoutEnabled == true`.
   - Physical inventory decrements (`stockCount`) on `/directProducts/{productId}` are permitted for buyers/guests ONLY via an atomic batch creating a brand-new `/directOrders/{lastOrderRef}` containing `productId`.
   - `/directOrders` contains customer PII and masked payment records (`paymentMethod`, `paymentReference`); `allow get` and `allow list` are strictly denied to unauthenticated guests and restricted to the verified buyer, verified seller, or website owner.
8. **Website Owner Exclusive Modules:**
   - `/posts` (Blog), `/offers` (Product Affiliate & Service Affiliate), `/campaigns` (Store Promos), and `/siteConfig/main` (Module switches & global settings) allow writes exclusively to `isAdmin()`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 — Shadow Field Privilege Escalation on `/users/user_1` (`create`):**
   `{ uid: "user_1", displayName: "Attacker", bio: "", isAdmin: true, createdAt: SERVER_TIME, updatedAt: SERVER_TIME }` -> **PERMISSION_DENIED** (`hasOnly` rejects `isAdmin`).
2. **Payload 2 — Unverified Email Spoofing Website Owner on `/posts/post_1` (`create`):**
   Auth token `{ email: "mengistushimelis@gmail.com", email_verified: false }` -> **PERMISSION_DENIED** (`isBootstrappedAdmin()` requires `email_verified == true`).
3. **Payload 3 — Non-Owner Reading Private Seller Payout Account `/users/seller_a/private/info` (`get`):**
   Authenticated as `buyer_b` -> **PERMISSION_DENIED** (`isOwner(userId)` fails).
4. **Payload 4 — Unactivated Buyer Creating Store Product `/directProducts/prod_unactivated` (`create`):**
   Authenticated `buyer_b` (`isSeller: false`) writes `/directProducts/prod_unactivated` -> **PERMISSION_DENIED** (`isActiveSellerUser` fails).
5. **Payload 5 — Active Seller Bypassing Admin Approval (`status: "published", approvalStatus: "approved"`) on `/directProducts/prod_bypass` (`create`):**
   Active seller tries to publish immediately without admin review -> **PERMISSION_DENIED** (Seller create enforces `status == 'draft' && approvalStatus == 'pending'`).
6. **Payload 6 — Seller Modifying Another Seller's Product `/directProducts/prod_seller_a` (`update`):**
   Active `seller_b` updates `seller_a`'s product -> **PERMISSION_DENIED** (`existing().sellerId == request.auth.uid` fails).
7. **Payload 7 — Unpurchased Visitor Scraping Protected Digital File `/productSecrets/prod_dig_1` (`get`):**
   Unauthenticated visitor calls `getDoc` on `/productSecrets/prod_dig_1` without atomic order unlock -> **PERMISSION_DENIED**.
8. **Payload 8 — Arbitrary Stock Zeroing Without Order Batch on `/directProducts/prod_phys_1` (`update`):**
   Guest attempts to decrement `stockCount` to `0` without creating `/directOrders/{lastOrderRef}` in the same batch -> **PERMISSION_DENIED** (`existsAfter` & `!exists` fail).
9. **Payload 9 — Suspended Seller Self-Reactivating `/users/seller_suspended` (`update`):**
   Suspended seller (`existing().sellerStatus == 'suspended'`) updates `sellerStatus: 'active'` -> **PERMISSION_DENIED** (`existing().sellerStatus != 'suspended'` gate fails).
10. **Payload 10 — Seller Self-Marking Order `paid_out` on `/directOrders/ord_1` (`update`):**
    Seller attempts to update `payoutStatus: 'paid_out'` -> **PERMISSION_DENIED** (Seller `affectedKeys().hasOnly` excludes `payoutStatus`).
11. **Payload 11 — Blanket Customer Order Scraping on `/directOrders` (`list`):**
    Authenticated user queries `/directOrders` without `buyerId` or `sellerId` ownership filter -> **PERMISSION_DENIED** (`allow list` enforces `existing().buyerId == request.auth.uid || existing().sellerId == request.auth.uid || isBootstrappedAdmin()`).
12. **Payload 12 — Oversized Payload / Value Poisoning (`imageKey` > 180KB on `update`):**
    Seller updates `imageKey` with a 500KB string -> **PERMISSION_DENIED** (`isValidDirectProduct(incoming())` wraps `allow update` and enforces `size() <= 180000`).
