# Pickra Zero-Trust Firestore Security Specification

## 1. Data Invariants & Master Source of Truth

1. **Global Default-Deny**: Every path not explicitly matched is rejected (`allow read, write: if false;`).
2. **Verified Authentication Gate**: All writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Website Owner & Admin Governance (`/admins/{adminId}`)**:
   - Only the bootstrapped website owner (`mengistushimelis@gmail.com` with `email_verified == true`) or a UID registered in `/admins/{uid}` is recognized as `isAdmin()`.
   - Editorial Blog Posts (`/posts/{postId}`), Affiliate Products & Services (`/offers/{offerId}`), Marketing Campaigns (`/campaigns/{campaignId}`), and Global Site Config (`/siteConfig/main`) can only be created, updated, or deleted by `isAdmin()`.
4. **Split-Collection PII & Master Gate (`/users/{userId}` + `/users/{userId}/private/info`)**:
   - Public profile `/users/{userId}` never stores email, phone, address, or payout account numbers; `list` is prohibited (`allow list: if false`).
   - Private subcollection `/users/{userId}/private/info` enforces the Master Gate (`exists(/users/$(userId)) && get(/users/$(userId)).data.uid == request.auth.uid`), restricts `get`/`create`/`update` strictly to `isOwner(userId)`, and bounds `payoutAccounts` (`size() <= 6`, each item `<= 240` chars across Telebirr, BankTransfer, CBEBirr, MobileMoney, Stripe, PayPal, Wise, Custom).
5. **Multi-Creator Storefront (`/directProducts/{productId}`)**:
   - Any verified user with an active `/users/{uid}` profile can publish, update, or delete their own physical or digital products (`sellerId == request.auth.uid`), including bounded `videoUrl` (`<= 250000`) and digital deliverable `digitalFileUrl` (`<= 560000` for HTTPS links or compact PDF/ZIP/Excel/eBook/HTML/Tool uploads).
   - Sellers cannot spoof `sellerId`, modify archived products without admin privileges, or delete another creator's products. Website owner (`isAdmin()`) retains full moderation override.
6. **Customer Orders, Guest Checkout & Creator Payout Ledger (`/directOrders/{orderId}`)**:
   - Strictly private PII (`buyerName`, `buyerEmail`, `shippingAddress`, `sellerPayoutDetails`): `get` and `list` are restricted strictly to authenticated `buyerId`, `sellerId`, or `isAdmin()` (unauthenticated users have zero read/list access). Zero `get()`/`exists()` inside `allow list`.
   - Direct Store checkout supports both verified account buyers (`incoming().buyerId == request.auth.uid && exists(/users/$(buyerId))`) and unauthenticated guest buyers (`!isSignedIn() && incoming().buyerId.matches('^guest_[a-zA-Z0-9_\\-]+$')`).
   - Buyers cannot create pre-settled orders (`payoutStatus == 'paid_out'`).
   - Sellers can update fulfillment (`status`, `fulfillmentNote`, `sellerPayoutDetails`) prior to terminal state (`fulfilled` / `cancelled`) or update `sellerPayoutDetails` while payout is unsettled, but ONLY `isAdmin()` (website owner) can mark `payoutStatus: 'paid_out'` or edit `payoutNote`.
7. **Temporal & Structural Integrity**:
   - Every `create` enforces `createdAt == request.time` (and `updatedAt == request.time`). Every `update` enforces `updatedAt == request.time` and immutable `createdAt` + owner UIDs.
   - Every string and list is strictly bounded by `.size()`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 — Shadow Field Injection on `UserProfile`**: Injecting `isAdmin: true` into `/users/{uid}` -> Rejected by `data.keys().hasOnly(...)`.
2. **Payload 2 — Unverified Email Spoofing Bootstrapped Owner**: `email: 'mengistushimelis@gmail.com'` with `email_verified: false` creating `/posts/post_1` -> Rejected by `isBootstrappedAdmin()` / `isAdmin()`.
3. **Payload 3 — Non-Owner Reading Private Payout Account**: `user_b` calling `get` on `/users/user_a/private/info` -> Rejected by `isOwner(userId)`.
4. **Payload 4 — Non-Admin Publishing Affiliate Offer**: Verified third-party seller creating `/offers/off_1` -> Rejected by `isAdmin()`.
5. **Payload 5 — Seller Identity Spoofing on `DirectProduct`**: `user_b` creating `/directProducts/prod_1` with `sellerId: 'user_a'` -> Rejected by `incoming().sellerId == request.auth.uid`.
6. **Payload 6 — Orphaned `DirectProduct` Without `/users/{uid}`**: Verified `user_c` creating `/directProducts/prod_2` before `/users/user_c` exists -> Rejected by `exists(/databases/$(database)/documents/users/$(incoming().sellerId))`.
7. **Payload 7 — Seller Self-Marking Order `paid_out`**: Seller `user_a` updating `/directOrders/ord_1` with `payoutStatus: 'paid_out'` -> Rejected because seller `affectedKeys().hasOnly(...)` excludes `payoutStatus`.
8. **Payload 8 — Guest or Buyer Creating Order Already Marked `paid_out`**: Creating `/directOrders/ord_2` with `payoutStatus: 'paid_out'` -> Rejected by create guard `incoming().payoutStatus in ['pending', 'not_applicable']`.
9. **Payload 9 — Unauthenticated Guest Attempting to Read `/directOrders/ord_1`**: Unauthenticated client calling `get` or `list` on `/directOrders` -> Rejected by `isVerifiedUser()` on `get` and `list`.
10. **Payload 10 — Blanket Order Scraping (`allow list`)**: Authenticated user listing `/directOrders` without filtering by `buyerId` or `sellerId` -> Rejected by `existing().buyerId == request.auth.uid || existing().sellerId == request.auth.uid`.
11. **Payload 11 — ID Poisoning & Oversized File Exhaustion**: Document ID containing slashes/spaces or `digitalFileUrl` > 560,000 chars -> Rejected by `isValidId()` and `data.digitalFileUrl.size() <= 560000`.
12. **Payload 12 — Client Timestamp Forgery**: Creating `/posts/post_2` with backdated `createdAt` != `request.time` -> Rejected by `incoming().createdAt == request.time`.
