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
    title: 'The Independent Publisher’s Stack: Hardware, Direct Editions, and On-Demand Talent',
    subtitle:
      'How a single operator can run a high-margin publication by combining direct-to-reader goods, vetted affiliate gear, and specialist freelance sprints.',
    slug: 'independent-publishers-stack-hardware-digital-talent',
    category: 'Field Guides',
    readTimeMinutes: 7,
    coverImageKey: 'workspace',
    content: `Running a modern niche publication no longer requires a twenty-person masthead or an expensive downtown lease. Over the past eighteen months, we audited thirty-four independent media brands to understand exactly where capital produces measurable creative leverage—and where overhead quietly erodes margins.

The highest-performing publications combine two complementary revenue engines: recommending best-in-class partner instruments via [Amazon Studio Hardware](https://www.amazon.com/s?k=studio+reference+headphones) and [Digistore24 digital systems](https://www.digistore24.com/), while selling flagship physical monographs and proprietary templates directly from their own storefront.

## 01. Tactile Hardware & First-Party Studio Editions

Long-form writing, audio editing, and video color grading punish mediocre peripherals. Rather than cycling through disposable consumer headsets every year, an open-back planar magnetic reference setup paired with a clean desktop DAC reveals vocal sibilance immediately and stays breathable across six-hour sessions.

[[offer:seed_offer_planar_dac]]

Alongside third-party studio monitors, outlining essays on tactile paper before touching a keyboard sharpens structure dramatically—which is why we produced our own Smythe-sewn linen monograph sold directly through the Pickra Store:

[[product:seed_prod_monograph]]

> Invest in physical instruments at the exact point where your hands, eyes, and ears meet the work; keep everything behind the scenes ruthlessly modular.

![Field photography & portable NVMe backup kit arranged on archival linen paper](camera)

## 02. Standardizing the Editorial Calendar Before Scaling Output

Publishing frequency collapses when every article starts from a blank document. Before hiring writers or signing affiliate partnerships across multiple networks, establish a single source of truth for story stages, direct product launches, outbound link audits, and commission attribution.

[[offer:seed_offer_digistore_os]]

@[bookmark:FTC Endorsement & Affiliate Disclosure Guidelines — Official Compliance Guide | Essential reading on clear and conspicuous reader-supported affiliate disclosures across articles and videos. | Read Guide](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking)

When every affiliate URL, direct SKU, and publication date lives inside a structured workspace, updating seasonal buyer guides takes twenty minutes instead of an entire weekend.

## 03. Commissioning Specialist Sprints Instead of Fixed Overhead

Even the sharpest editorial voice loses readers if pages shift during load or typography feels generic. Instead of wrestling with custom performance bottlenecks yourself, bring in a dedicated full-stack engineer on a scoped milestone to tune Core Web Vitals and structured schema markup.

[[offer:seed_offer_upwork_architect]]

Pair that technical foundation with a cohesive visual identity—custom wordmark, archival color palette, and social specimen templates—commissioned once as a clean turnkey package.

[[offer:seed_offer_fiverr_brand]]

With those pillars in place, your weekly routine narrows back to what readers actually value: honest testing, clear prose, and original editions worth owning.`,
    attachedOfferIds: [
      'seed_offer_planar_dac',
      'seed_offer_digistore_os',
      'seed_offer_upwork_architect',
      'seed_offer_fiverr_brand',
    ],
    disclosureText: DEFAULT_DISCLOSURE,
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
    title: 'Two Weeks One-Bagging With a Minimalist Rangefinder & NVMe Backup Workflow',
    subtitle:
      'Our tested travel kit for photographing hardware reviews on location without carrying a heavy cinema rig or risking single-card data loss.',
    slug: 'minimalist-rangefinder-nvme-backup-workflow',
    category: 'Hardware & Gear',
    readTimeMinutes: 5,
    coverImageKey: 'camera',
    content: `Shooting product photography on location often tempts creators into packing redundant Pelicans filled with stands and modifiers that never leave the hotel room. On a recent two-week assignment documenting studio spaces, we pared our entire capture and backup kit down to a waxed canvas folio and a ruggedized 2TB NVMe drive.

Natural window illumination at forty-five degrees consistently outperforms portable LED panels when photographing brushed aluminum, linen bindings, and travertine surfaces. What cannot be improvised on the road, however, is off-camera redundancy at the end of every shoot day.

## Redundant Offload Speeds That Respect Deadlines

Transferring eighty gigabytes of uncompressed RAW frames over sluggish bus-powered drives turns evening edits into midnight bottlenecks. Moving to a forged-aluminum NVMe portable drive cut our ingest window to under three minutes while withstanding rain and concrete drops.

[[offer:seed_offer_field_ssd]]

> Reliability in field gear is measured by the absence of friction when light is fading and deadlines are fixed.

## Color Grading Tabletop Hardware With Natural Window Light

Once your RAW frames are backed up, consistent color grading turns simple tabletop shots into cohesive editorial essays. Our in-house archival LUT pack and lighting manual is available directly from the Pickra Store:

[[product:seed_prod_lut_monograph]]

## Structuring Location Dispatches for Long-Term Search Discovery

Great original photography compounds in value when paired with evergreen search intent. Rather than publishing fleeting social recaps that vanish in forty-eight hours, structure each field test around the concrete buyer questions readers type six months later.

[[offer:seed_offer_gumroad_seo]]

Original photographs prove you actually held the hardware in your hands—the single strongest trust signal in modern affiliate and direct-to-reader publishing.`,
    attachedOfferIds: ['seed_offer_field_ssd', 'seed_offer_gumroad_seo'],
    disclosureText: DEFAULT_DISCLOSURE,
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
    title: 'When to Buy Digital Frameworks vs. Hiring Vetted Freelancers on Upwork and Fiverr',
    subtitle:
      'A practical decision matrix for allocating a $1,000 quarterly growth budget across self-serve digital blueprints and specialist human execution.',
    slug: 'digital-frameworks-vs-hiring-vetted-freelancers',
    category: 'Freelance Talent',
    readTimeMinutes: 6,
    coverImageKey: 'service',
    content: `Every growing digital publisher hits the same inflection point: your article archive is earning consistent affiliate commissions and direct product sales, yet technical debt, inconsistent visual assets, and ad-hoc spreadsheets begin crowding out your writing mornings.

The mistake most solo operators make is either trying to learn every adjacent craft from scratch or hiring premature monthly retainers without a clear brief. A sharper rule of thumb separates repeatable internal systems from high-skill external deliverables.

## Buy Digital Blueprints for Repeatable Internal Systems

Never pay custom consulting rates to invent a content calendar, link audit table, or search brief format from zero. Mature digital templates give you eighty percent of the architecture immediately so you can adapt it in an afternoon.

[[product:seed_prod_publisher_kit]]

[[offer:seed_offer_digistore_os]]

[[offer:seed_offer_gumroad_seo]]

## Commission Specialists for High-Leverage Public Surfaces

Conversely, templates rarely substitute for bespoke engineering or visual identity when your publication needs to stand apart. Scoping a clear, fixed-deliverable brief for a vetted Identity Designer or Senior Web Engineer turns a modest one-time budget into a durable asset you use on every single dispatch.

[[offer:seed_offer_fiverr_brand]]

[[offer:seed_offer_upwork_architect]]

Write a one-page specification listing exact deliverables, reference benchmarks, and acceptance criteria before sending your first message—great specialists reward clarity with their best work.`,
    attachedOfferIds: [
      'seed_offer_digistore_os',
      'seed_offer_gumroad_seo',
      'seed_offer_fiverr_brand',
      'seed_offer_upwork_architect',
    ],
    disclosureText: DEFAULT_DISCLOSURE,
    featured: false,
    status: 'published',
    publishedLabel: 'October 12, 2026',
    isSeed: true,
    createdAtMs: 1792720000000,
    updatedAtMs: 1792720000000,
  },
];
