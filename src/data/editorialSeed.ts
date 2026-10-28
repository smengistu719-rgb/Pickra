import {
  AffiliateOffer,
  BlogPost,
  DirectProduct,
  MarketingCampaign,
} from '../types';

export const DEFAULT_DISCLOSURE =
  'Reader-supported journal: When you purchase physical products, digital tools, or commission freelance specialists through links in this article, Pickra may earn an affiliate commission at no extra cost to you.';

export const SEED_DIRECT_PRODUCTS: DirectProduct[] = [
  {
    id: 'seed_prod_monograph',
    sellerId: 'editorial_desk',
    sellerName: 'Pickra Studio Editions',
    title: 'Pickra Field Notes Vol. I — Linen Hardcover Monograph & Brass Pen',
    subtitle:
      'Smyth-sewn archival oatmeal linen journal paired with a precision-turned solid C360 brass fountain pen.',
    kind: 'physical',
    category: 'Print & Desk Editions',
    sku: 'PKR-MONO-01',
    priceCents: 6800,
    compareAtCents: 8400,
    stockCount: 38,
    badgeLabel: 'First Pressing',
    imageKey: 'edition',
    summary:
      'Designed in-house by Pickra and sold directly from our studio warehouse. Features 192 numbered dot-grid pages on 120gsm acid-free fountain-pen friendly stock alongside a balanced raw brass pocket instrument.',
    highlights: [
      'Smyth-sewn lay-flat binding wrapped in Belgian oatmeal bookcloth',
      '120gsm Japanese archival paper with zero fountain-pen bleed',
      'Includes solid machined brass pen with German Schmidt fine nib',
      'Numbered first-edition belly band with woven ribbon marker',
    ],
    deliveryNote: 'Ships directly from Pickra within 48 hours via tracked insured courier',
    featured: true,
    status: 'published',
    isSeed: true,
    createdAtMs: 1792820000000,
    updatedAtMs: 1792820000000,
  },
  {
    id: 'seed_prod_desk_valet',
    sellerId: 'editorial_desk',
    sellerName: 'Pickra Studio Editions',
    title: 'Pickra Modular Desk Valet — Matte Anodized Aluminum & American Walnut',
    subtitle:
      'Two-piece CNC-milled everyday carry tray and solid walnut vertical device dock engineered for calm workspaces.',
    kind: 'physical',
    category: 'Studio Hardware',
    sku: 'PKR-TRAY-02',
    priceCents: 11800,
    compareAtCents: 14500,
    stockCount: 22,
    badgeLabel: 'Direct Exclusive',
    imageKey: 'tray',
    summary:
      'Milled from solid 6061-T6 bead-blasted aluminum and hand-oiled American black walnut. Organizes SD cards, lenses, pens, watch, and phone with concealed cable routing.',
    highlights: [
      'CNC-machined 6061 aluminum tray with micro-grooved anti-scratch floor',
      'Kiln-dried American walnut upright stand with hidden USB-C channel',
      'Cork-lined base pads protect wood, stone, and linoleum desktops',
      'Backed by Pickra lifetime structural studio warranty',
    ],
    deliveryNote: 'Ships directly in plastic-free molded pulp packaging within 2 business days',
    featured: true,
    status: 'published',
    isSeed: true,
    createdAtMs: 1792815000000,
    updatedAtMs: 1792815000000,
  },
  {
    id: 'seed_prod_publisher_kit',
    sellerId: 'editorial_desk',
    sellerName: 'Pickra Digital Press',
    title: 'Pickra Publisher & Affiliate Revenue OS — Complete Notion + Figma Kit',
    subtitle:
      'Our exact internal editorial calendar, direct-to-reader product launch playbook, and sponsor attribution ledger.',
    kind: 'digital',
    category: 'Digital Toolkits',
    sku: 'PKR-OS-03',
    priceCents: 4900,
    compareAtCents: 6900,
    stockCount: 999,
    badgeLabel: 'Instant Access',
    imageKey: 'digital',
    summary:
      'Sold directly by Pickra with zero middleman fees. Duplicate our complete editorial pipeline, product launch checklist, UTM campaign generator, and Figma article graphic templates in under ten minutes.',
    highlights: [
      'One-click Notion workspace template with affiliate + direct store P&L views',
      '28 customizable Figma social card, product launch, and media kit frames',
      '90-day direct product launch & email sequence blueprint (PDF + Markdown)',
      'Includes lifetime v2 updates directly in your Pickra purchase history',
    ],
    deliveryNote: 'Instant digital download & workspace access unlocked upon order confirmation',
    featured: false,
    status: 'published',
    isSeed: true,
    createdAtMs: 1792810000000,
    updatedAtMs: 1792810000000,
  },
  {
    id: 'seed_prod_lut_monograph',
    sellerId: 'editorial_desk',
    sellerName: 'Pickra Digital Press',
    title: 'Warm Archival Studio LUTs & Tabletop Lighting Field Manual',
    subtitle:
      'Twelve color-accurate 3D LUTs (.cube) and a 64-page lighting diagram guide for natural-light product photography.',
    kind: 'digital',
    category: 'Photography Assets',
    sku: 'PKR-LUT-04',
    priceCents: 3400,
    compareAtCents: 0,
    stockCount: 999,
    badgeLabel: 'Creator Favorite',
    imageKey: 'camera',
    summary:
      'Crafted for hardware reviewers, makers, and independent shops photographing physical goods by window light. Compatible with DaVinci Resolve, Premiere Pro, Final Cut, and Lightroom.',
    highlights: [
      '12 calibrated .cube LUTs preserving natural skin, brass, and paper tones',
      'Lightroom & Capture One still photography profile presets included',
      '64-page illustrated PDF manual with 18 single-window tabletop setups',
    ],
    deliveryNote: 'Instant ZIP bundle + PDF field manual delivered immediately after checkout',
    featured: false,
    status: 'published',
    isSeed: true,
    createdAtMs: 1792805000000,
    updatedAtMs: 1792805000000,
  },
];

export const SEED_CAMPAIGNS: MarketingCampaign[] = [
  {
    id: 'seed_camp_launch15',
    authorId: 'editorial_desk',
    title: 'Pickra Direct Launch Week — Save 15% on Studio Editions & Digital Kits',
    description:
      'Celebrate the opening of Pickra Direct Store. Apply code PICKRA15 at checkout on any direct physical edition or instant digital toolkit over $40, plus complimentary tracked shipping over $95.',
    promoCode: 'PICKRA15',
    discountPercent: 15,
    minOrderCents: 4000,
    channel: 'Storefront Banner',
    featuredProductId: 'seed_prod_monograph',
    ctaLabel: 'Apply PICKRA15 Offer',
    expiresLabel: 'Through November 30, 2026',
    status: 'published',
    isSeed: true,
    createdAtMs: 1792825000000,
    updatedAtMs: 1792825000000,
  },
  {
    id: 'seed_camp_bundle20',
    authorId: 'editorial_desk',
    title: 'Creator Desk Bundle — 20% Off Orders Over $120',
    description:
      'Pair any physical Pickra desk object with a digital workflow kit to unlock 20% bundle savings and free priority courier dispatch.',
    promoCode: 'BUNDLE20',
    discountPercent: 20,
    minOrderCents: 12000,
    channel: 'Flash Bundle',
    featuredProductId: 'seed_prod_desk_valet',
    ctaLabel: 'Unlock 20% Bundle',
    expiresLabel: 'Limited First-Pressing Allocation',
    status: 'published',
    isSeed: true,
    createdAtMs: 1792822000000,
    updatedAtMs: 1792822000000,
  },
];

export const SEED_OFFERS: AffiliateOffer[] = [
  {
    id: 'seed_offer_planar_dac',
    authorId: 'editorial_desk',
    authorName: 'Pickra Editorial',
    title: 'Audeze MM-100 Open-Back Reference Headphones & Balanced Desktop DAC',
    kind: 'physical',
    platform: 'Amazon',
    category: 'Studio Hardware',
    priceLabel: '$399.00',
    commissionNote: '4.5% Amazon Associates',
    affiliateUrl: 'https://www.amazon.com/s?k=open+back+planar+magnetic+studio+headphones+dac',
    imageKey: 'audio',
    summary:
      'Planar magnetic transient accuracy paired with a zero-noise aluminum balanced DAC. Built for eight-hour editing, mixing, and deep-focus sessions without ear fatigue.',
    highlights: [
      '90mm planar magnetic drivers with neutral studio tuning',
      'Spring-steel magnesium chassis under 475 grams',
      'Single-sided braided cable reversible to left or right cup',
    ],
    status: 'published',
    isSeed: true,
    createdAtMs: 1792700000000,
    updatedAtMs: 1792700000000,
  },
  {
    id: 'seed_offer_digistore_os',
    authorId: 'editorial_desk',
    authorName: 'Pickra Editorial',
    title: 'Modular Editorial & Solopreneur Operations Suite (v4 Blueprint)',
    kind: 'digital',
    platform: 'Digistore24',
    category: 'Digital Workflows',
    priceLabel: '$79.00',
    commissionNote: '50% Digistore24 Partner',
    affiliateUrl: 'https://www.digistore24.com/',
    imageKey: 'digital',
    summary:
      'A complete digital publishing calendar, sponsor CRM, and affiliate revenue ledger engineered for independent writers and boutique media operators.',
    highlights: [
      'Instant digital download with lifetime template updates',
      'Pre-built content pipeline from brief to multi-channel distribution',
      'Automated affiliate link inventory and quarterly yield tracker',
    ],
    status: 'published',
    isSeed: true,
    createdAtMs: 1792710000000,
    updatedAtMs: 1792710000000,
  },
  {
    id: 'seed_offer_upwork_architect',
    authorId: 'editorial_desk',
    authorName: 'Pickra Editorial',
    title: 'Top-Rated Plus Full-Stack Web & Conversion Performance Engineering',
    kind: 'service',
    platform: 'Upwork',
    category: 'Engineering Services',
    priceLabel: 'From $85 / hr',
    commissionNote: 'Upwork Affiliate Referral',
    affiliateUrl: 'https://www.upwork.com/hire/full-stack-developers/',
    imageKey: 'service',
    summary:
      'Vetted independent full-stack engineers specializing in sub-second Core Web Vitals, custom publishing stacks, and high-converting storefront architecture.',
    highlights: [
      '100% Job Success threshold across verified client milestones',
      'Technical SEO schema, Lighthouse optimization, and clean TypeScript builds',
      'Flexible hourly retainers or scoped fixed-price sprints',
    ],
    status: 'published',
    isSeed: true,
    createdAtMs: 1792720000000,
    updatedAtMs: 1792720000000,
  },
  {
    id: 'seed_offer_fiverr_brand',
    authorId: 'editorial_desk',
    authorName: 'Pickra Editorial',
    title: 'Fiverr Pro Editorial Identity, Packaging & Custom Type Direction',
    kind: 'service',
    platform: 'Fiverr',
    category: 'Design & Branding',
    priceLabel: 'From $240 / project',
    commissionNote: 'Fiverr CPA / Hybrid Partner',
    affiliateUrl: 'https://www.fiverr.com/categories/graphics-design/brand-style-guides',
    imageKey: 'workspace',
    summary:
      'Hand-vetted Fiverr Pro identity studios delivering complete typographic systems, vector wordmarks, and social art direction within a 7-day turnaround.',
    highlights: [
      'Complete brand book with print and web color specifications',
      'Source vector files, custom social templates, and Commercial License',
      'Structured two-round creative revision workflow',
    ],
    status: 'published',
    isSeed: true,
    createdAtMs: 1792730000000,
    updatedAtMs: 1792730000000,
  },
  {
    id: 'seed_offer_field_ssd',
    authorId: 'editorial_desk',
    authorName: 'Pickra Editorial',
    title: 'SanDisk Extreme PRO 2TB NVMe Rugged Field SSD & Waxed Folio Kit',
    kind: 'physical',
    platform: 'Amazon',
    category: 'Photography & Storage',
    priceLabel: '$189.00',
    commissionNote: '4.0% Amazon Associates',
    affiliateUrl: 'https://www.amazon.com/s?k=sandisk+extreme+pro+2tb+portable+ssd',
    imageKey: 'camera',
    summary:
      'Sustained 2000MB/s read-write throughput forged in an anodized aluminum heat-sink chassis. Essential off-site backup for RAW stills and 4K ProRes dispatches.',
    highlights: [
      'IP65 water and dust resistance with 3-meter drop protection',
      'Forged aluminum chassis acts as passive thermal heatsink',
      'Hardware 256-bit AES encryption over USB-C 3.2 Gen 2x2',
    ],
    status: 'published',
    isSeed: true,
    createdAtMs: 1792740000000,
    updatedAtMs: 1792740000000,
  },
  {
    id: 'seed_offer_gumroad_seo',
    authorId: 'editorial_desk',
    authorName: 'Pickra Editorial',
    title: 'Programmatic Content & Affiliate Search Intent Playbook',
    kind: 'digital',
    platform: 'Gumroad',
    category: 'Growth & Publishing',
    priceLabel: '$54.00',
    commissionNote: '35% Creator Affiliate',
    affiliateUrl: 'https://gumroad.com/',
    imageKey: 'digital',
    summary:
      'Step-by-step field manual on structuring comparison essays, buyer guides, and long-tail search clusters without sacrificing editorial credibility.',
    highlights: [
      '140-page illustrated monograph plus keyword clustering spreadsheets',
      'Real conversion benchmarks across physical vs. digital affiliate tiers',
      'Includes FTC & GDPR compliant disclosure templates',
    ],
    status: 'published',
    isSeed: true,
    createdAtMs: 1792750000000,
    updatedAtMs: 1792750000000,
  },
];

export const SEED_POSTS: BlogPost[] = [
  {
    id: 'seed_post_lean_media_stack',
    authorId: 'editorial_desk',
    authorName: 'Pickra Editorial',
    title: 'The Independent Publisher’s Craft: Editorial Focus, Rhythm, and Archival Standards',
    subtitle:
      'How small editorial desks maintain rigorous testing, timeless typography, and weekly publishing discipline without newsroom bloat.',
    slug: 'independent-publishers-craft-editorial-focus-rhythm',
    category: 'Field Guides',
    readTimeMinutes: 7,
    coverImageKey: 'workspace',
    content: `Running a modern independent publication no longer requires a twenty-person masthead or an expensive downtown lease. Over the past eighteen months, we studied thirty-four independent journals to understand where editorial discipline produces lasting reader trust—and where complexity quietly erodes focus.

Strong publications share three foundational habits: primary-source field notes, calm reading environments free from popups, and a predictable weekly dispatch cadence grounded in [open web publishing standards](https://developer.mozilla.org/).

## 01. Tactile Outlining Before Touching the Keyboard

Long-form writing, technical tutorials, and structured essays benefit immensely from sketching arguments by hand before opening a browser tab. Mapping three core takeaways on paper sharpens narrative flow and eliminates filler paragraphs before drafting even begins.

> Write for the reader who has ten uninterrupted minutes and high standards; cut every sentence that merely clears its throat.

![Editorial workspace and field notes arranged in natural morning light](camera)

## 02. Standardizing the Editorial Calendar Before Scaling Output

Publishing frequency collapses when every article starts from an unstructured blank page. Establish a single source of truth for research briefs, fact-checking checklists, visual captions, and publication dates so every essay meets the same bar.

@[bookmark:Creative Commons Attribution 4.0 International — Open Publishing Reference | Standard framework for attributing archival photography, open datasets, and cited research across global dispatches. | Read Standard](https://creativecommons.org/licenses/by/4.0/)

When every draft moves through research, structural edit, visual verification, and final proof in sequence, shipping weekly essays becomes calm and sustainable.

## 03. Designing for Long-Term Readability

Even the sharpest prose loses readers if pages shift during load or typography feels cramped. Generous line height, warm paper contrast, and clear section hierarchy keep attention where it belongs: on ideas worth revisiting months and years later.`,
    attachedOfferIds: [],
    disclosureText:
      'Independent Editorial Journal: Essays, field notes, and tutorials published by the Pickra editorial desk.',
    featured: true,
    status: 'published',
    publishedLabel: 'October 24, 2026',
    isSeed: true,
    createdAtMs: 1792800000000,
    updatedAtMs: 1792800000000,
  },
  {
    id: 'seed_post_field_kit_storage',
    authorId: 'editorial_desk',
    authorName: 'Pickra Editorial',
    title: 'Two Weeks Documenting Architecture & Craft With Natural Window Light',
    subtitle:
      'Field lessons from photographing workshops, studios, and tactile materials on location without artificial lighting rigs.',
    slug: 'documenting-architecture-craft-natural-window-light',
    category: 'Hardware & Gear',
    readTimeMinutes: 5,
    coverImageKey: 'camera',
    content: `Documentary photography on location often tempts travelers into packing heavy cases filled with stands and modifiers that never leave the hotel room. On a recent two-week assignment documenting independent craft studios, we worked exclusively with directional window light and a compact handheld setup.

Natural illumination at forty-five degrees consistently reveals texture across brushed metal, linen bookcloth, and stone surfaces without harsh specular glare. What cannot be improvised on the road, however, is disciplined daily archiving at the end of every shoot.

## Consistent End-of-Day Archiving Habits

Labeling folders by date, location, and subject immediately after each session turns evening selects into a fifteen-minute ritual rather than a multi-week backlog when returning home.

> Reliability in field documentation is measured by the absence of friction when daylight is fading and deadlines are fixed.

## Color Continuity Across Daylight Conditions

Balancing white point manually around 5200K preserves warm morning shadows and cool overcast afternoons alike, allowing a twelve-photo essay to read as a single cohesive visual narrative.

## Structuring Dispatches for Evergreen Discovery

Original field photographs compound in value when paired with clear technical notes, focal-length context, and honest observations that remain useful to readers years after publication.`,
    attachedOfferIds: [],
    disclosureText:
      'Independent Editorial Journal: Essays, field notes, and tutorials published by the Pickra editorial desk.',
    featured: false,
    status: 'published',
    publishedLabel: 'October 19, 2026',
    isSeed: true,
    createdAtMs: 1792760000000,
    updatedAtMs: 1792760000000,
  },
  {
    id: 'seed_post_delegating_creative_ops',
    authorId: 'editorial_desk',
    authorName: 'Pickra Editorial',
    title: 'Structuring Technical Documentation & Clear Creative Briefs for Distributed Teams',
    subtitle:
      'A practical framework for writing concise one-page specifications, defining acceptance criteria, and keeping async collaboration calm.',
    slug: 'structuring-technical-documentation-creative-briefs',
    category: 'Digital Systems',
    readTimeMinutes: 6,
    coverImageKey: 'service',
    content: `Every growing studio or publication eventually hits the same inflection point: ideas multiply faster than ad-hoc messages can track, and unrecorded decisions begin crowding out deep creative mornings.

The antidote is rarely more meetings. Instead, replacing scattered threads with a clear one-page brief separates repeatable internal checklists from bespoke creative problem-solving.

## Document Repeatable Workflows Once

Whenever a task repeats more than three times—whether preparing diagrams, verifying citations, or formatting code samples—capture the exact steps in a living checklist that anyone on the team can follow without guesswork.

## Write One-Page Specifications With Explicit Non-Goals

Great collaborators do their sharpest work when scope boundaries are unmistakable. State the core objective in two sentences, list concrete deliverables, attach two visual or structural references, and explicitly note what is out of scope before work begins.`,
    attachedOfferIds: [],
    disclosureText:
      'Independent Editorial Journal: Essays, field notes, and tutorials published by the Pickra editorial desk.',
    featured: false,
    status: 'published',
    publishedLabel: 'October 12, 2026',
    isSeed: true,
    createdAtMs: 1792720000000,
    updatedAtMs: 1792720000000,
  },
];
