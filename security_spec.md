# Field & Folio — Zero-Trust Firestore Security Specification

## 1. Data Invariants & Master Source of Truth

1. **Default-Deny Catch-All**: All unspecified paths (`/{document=**}`) deny all `read` and `write` operations unconditionally.
2. **Verified Identity Gate**: Every write (`create`, `update`, `delete`) across the entire database requires an authenticated user with `request.auth.token.email_verified == true`.
3. **PII Split-Collection Isolation**:
   - `/users/{userId}` holds strictly public byline data (`uid`, `displayName`, `bio`, `createdAt`, `updatedAt`) and never stores emails, phone numbers, or RBAC role flags.
   - `/users/{userId}/private/{infoId}` (`infoId == 'info'`) isolates `email` and default affiliate tags (`defaultAmazonTag`, `defaultDigistoreId`). It enforces the **Master Gate** (`exists` + `get` on `/users/{userId}` confirming `data.uid == request.auth.uid`) and restricts `get`/`write` strictly to `request.auth.uid == userId`.
4. **Relational Consistency on Content Creation**:
   - Creating a document in `/offers/{offerId}` or `/posts/{postId}` requires `incoming().authorId == request.auth.uid` AND `exists(/databases/$(database)/documents/users/$(incoming().authorId))` to prevent orphaned records.
5. **Terminal State Locking**:
   - Once an `AffiliateOffer` or `BlogPost` reaches `status == 'archived'`, all further `update` operations are blocked unless executed by a verified administrator (`isAdmin()`).
6. **Temporal & Ownership Immutability**:
   - `createdAt` and `updatedAt` must equal `request.time` on `create`.
   - On `update`, `createdAt`, `uid`, and `authorId` are strictly immutable (`incoming().field == existing().field`), while `updatedAt == request.time`.
7. **Secure List Queries (Zero Blanket Reads & Zero Cost Explosion)**:
   - `/admins`, `/users`, and `/users/{userId}/private` prohibit `list` altogether.
   - `/offers` and `/posts` enforce rule-side `resource.data` predicates (`existing().status == 'published' || (isSignedIn() && existing().authorId == request.auth.uid) || isBootstrappedAdmin()`) with zero `get()`/`exists()` calls inside `allow list`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Shadow Field Injection on Post Create (`isVerifiedEditor: true`)**
   ```json
   {
     "collection": "/posts/post_shadow_1",
     "auth": { "uid": "user_1", "email_verified": true },
     "payload": {
       "authorId": "user_1",
       "authorName": "Alice",
       "title": "Top Studio Gear",
       "subtitle": "Tested audio interfaces for creators",
       "slug": "top-studio-gear",
       "category": "Hardware & Gear",
       "readTimeMinutes": 5,
       "coverImageKey": "audio",
       "content": "Detailed long-form review body exceeding twenty characters.",
       "attachedOfferIds": [],
       "disclosureText": "We may earn a commission from qualifying purchases.",
       "featured": false,
       "status": "published",
       "publishedLabel": "Oct 24, 2026",
       "isVerifiedEditor": true
     }
   }
   ```
2. **Unverified Admin Email Spoof (`email_verified: false`)**
   ```json
   {
     "collection": "/admins/attacker_uid",
     "auth": { "uid": "attacker_uid", "email": "mengistushimelis@gmail.com", "email_verified": false },
     "payload": { "uid": "attacker_uid", "grantedBy": "attacker_uid" }
   }
   ```
3. **Cross-User PII Leak (`get` on `/users/victim_uid/private/info`)**
   ```json
   {
     "operation": "get",
     "path": "/users/victim_uid/private/info",
     "auth": { "uid": "attacker_uid", "email_verified": true }
   }
   ```
4. **Identity Spoofing on Offer Creation (`authorId != request.auth.uid`)**
   ```json
   {
     "collection": "/offers/offer_spoof_1",
     "auth": { "uid": "attacker_uid", "email_verified": true },
     "payload": {
       "authorId": "victim_uid",
       "authorName": "Victim",
       "title": "Planar Headphones",
       "kind": "physical",
       "platform": "Amazon",
       "category": "Audio",
       "priceLabel": "$349",
       "commissionNote": "4%",
       "affiliateUrl": "https://www.amazon.com/dp/B08J9",
       "imageKey": "audio",
       "summary": "Balanced reference soundstage for mixing.",
       "highlights": ["Open-back design"],
       "status": "published"
     }
   }
   ```
5. **Orphaned Post Creation (No `/users/{authorId}` Parent Profile)**
   ```json
   {
     "collection": "/posts/orphan_post_1",
     "auth": { "uid": "ghost_uid", "email_verified": true },
     "precondition": "No document at /users/ghost_uid"
   }
   ```
6. **JavaScript Protocol XSS in Affiliate Link (`affiliateUrl: "javascript:alert(1)"`)**
   ```json
   {
     "collection": "/offers/xss_offer_1",
     "auth": { "uid": "user_1", "email_verified": true },
     "payload": { "affiliateUrl": "javascript:alert(1)" }
   }
   ```
7. **Terminal State Bypass (Updating an `'archived'` Post as Non-Admin Owner)**
   ```json
   {
     "operation": "update",
     "path": "/posts/archived_post_1",
     "existingStatus": "archived",
     "auth": { "uid": "user_1", "email_verified": true },
     "payload": { "status": "published" }
   }
   ```
8. **Array Element Type Poisoning (`highlights: ["Valid", 99999]`)**
   ```json
   {
     "collection": "/offers/array_poison_1",
     "auth": { "uid": "user_1", "email_verified": true },
     "payload": { "highlights": ["Valid string", 99999] }
   }
   ```
9. **Unbounded Array Exhaustion (`attachedOfferIds` with 12 IDs > max 8)**
   ```json
   {
     "collection": "/posts/array_overflow_1",
     "auth": { "uid": "user_1", "email_verified": true },
     "payload": { "attachedOfferIds": ["a1","a2","a3","a4","a5","a6","a7","a8","a9","a10","a11","a12"] }
   }
   ```
10. **Path Variable ID Poisoning (`offerId` with 200-char or special-char string)**
    ```json
    {
      "collection": "/offers/bad$id!with/slashes",
      "auth": { "uid": "user_1", "email_verified": true }
    }
    ```
11. **Client Forged Timestamp (`createdAt` set to past date instead of `request.time`)**
    ```json
    {
      "collection": "/posts/forged_time_1",
      "auth": { "uid": "user_1", "email_verified": true },
      "payload": { "createdAt": "2020-01-01T00:00:00Z" }
    }
    ```
12. **Unauthorized Draft Scraping (`list` on `/posts` without `status == 'published'` filter)**
    ```json
    {
      "operation": "list",
      "path": "/posts",
      "auth": null,
      "query": "unfiltered collection scan"
    }
    ```
