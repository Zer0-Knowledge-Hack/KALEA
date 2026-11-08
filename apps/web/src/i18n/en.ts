import type { Rail } from "@kalea/shared";
import { COUNTRY_NAMES, RAIL_NAMES } from "../lib/catalog";

/**
 * English landing copy: the source of truth. `Dictionary` is derived from this object, so every
 * other locale must provide exactly the same keys or `astro check` fails.
 * Text only: no markup, no functions (the quote widget strings are serialized into an island).
 * Placeholders use `{name}` and are filled with `fill()` from `./index`.
 */
export const en = {
  meta: {
    title: "Kalea · Stablecoin ramp infrastructure for LATAM businesses",
    description:
      "One API for fiat <-> stablecoin on-ramps, off-ramps and QR payments across Latin America, with fixed all-in quotes, local rails and on-chain settlement. Live on Stellar testnet.",
    ogImageAlt: "Kalea logo over a street in perspective",
  },
  nav: {
    product: "Product",
    howItWorks: "How it works",
    coverage: "Coverage",
    developers: "Developers",
    pricing: "Pricing",
    faq: "FAQ",
    cta: "Book a demo",
    menu: "Menu",
    home: "Kalea home",
    language: "Language",
  },
  hero: {
    status: "First live network — USDC on Stellar testnet",
    /** Headline lines, split into words for the rise animation; the second line is muted. */
    lines: [
      ["Ramps", "for", "LATAM", "businesses."],
      ["Without", "the", "complexity."],
    ],
    sub: "One API for on-ramps, off-ramps and QR payments across Latin America.",
    primary: "Get API access",
    secondary: "Book a demo",
  },
  value: {
    eyebrow: "Product",
    headline: { before: "Ramps as a", highlight: "feature,", after: "not a project." },
    sub: { before: "Move money in and out of stablecoins with", key: "one integration", after: "." },
    audienceLabel: "Built for",
    api: { title: "One API", body: "On-ramp, off-ramp and QR payments. Payouts next." },
    /** The body is the list of live rails, built from the catalog. */
    rails: { title: "Local rails" },
    settlement: { title: "Stablecoin settlement", body: "Fixed all-in quotes, settled on-chain." },
    audiences: ["Wallets & exchanges", "Fintechs & neobanks", "PSPs & payment apps", "Marketplaces & platforms"],
  },
  howItWorks: {
    eyebrow: "How it works",
    headline: "Escrow-first. Fiat stays local.",
    steps: [
      { title: "Quote", body: "Request a fixed all-in quote by country, side, rail and amount. Valid for 5 minutes." },
      { title: "Lock", body: "Kalea matches an independent local liquidity partner and locks the stablecoins in escrow." },
      { title: "Pay locally", body: "Fiat moves over Pix, SPEI, Yape, QR Simple or bank transfer, between your user and the partner." },
      { title: "Release", body: "On confirmation the escrow releases the stablecoins. Your fee comes from your prefunded balance." },
    ],
    safetyLabel: "Safety",
    safety: [
      "Fiat never touches Kalea.",
      "Every order gets its own escrow with fixed amounts.",
      "Disputes freeze the escrow; an insurance fund covers resolved losses.",
    ],
    mergeFiat: "Fiat · local rails",
    mergeCoin: "Stablecoin · on-chain",
    mergeOrder: "One order",
    note: "Testnet today: the Soroban escrow contract is deployed, and the API still runs the order lifecycle as a simulation while it is wired in.",
  },
  quote: {
    eyebrow: "Live quote",
    headline: "One price. The exact amount.",
    sub: "A fixed all-in quote from the testnet demo API. What your user sees is what they pay.",
  },
  quoteWidget: {
    buy: "On-ramp",
    sell: "Off-ramp",
    direction: "Direction",
    country: "Country",
    rail: "Rail",
    pays: "End user pays",
    receives: "End user receives",
    sends: "End user sends",
    rate: "All-in rate",
    fiatPaid: "Fiat paid",
    fiatReceived: "Fiat received",
    fee: "Kalea fee to end user",
    none: "None",
    amountIn: "Amount in {currency}",
    invalid: "Enter a valid amount.",
    unavailable: "Quote unavailable",
    rateLimited: "Too many quotes in a short time, showing local demo pricing.",
    sourceLive: "Live quote · testnet demo API",
    sourceDemo: "Demo pricing · illustrative values",
    poweredBy: "Powered by",
  },
  coverage: {
    eyebrow: "Coverage",
    headline: "Local rails, one integration.",
    sub: "Built to support USDC and USDT across EVM and non-EVM chains.",
    columns: ["Country", "Currency", "Rails", "Status"],
    legend: "Live: priced demo corridor on Stellar testnet.",
    networksLabel: "Stablecoins & networks",
    live: "Live",
    next: "Next",
    liveAsset: "USDC on Stellar",
    liveNote: "Testnet today.",
    nextGroups: [
      { label: "Stablecoins", items: "USDT" },
      { label: "EVM", items: "Ethereum, Base, Polygon, Arbitrum, BNB Chain" },
      { label: "Non-EVM", items: "Solana, Tron" },
    ],
  },
  developers: {
    eyebrow: "Developers",
    headline: { main: "One REST API.", soft: "Testnet sandbox today." },
    sub: "Quote, create an order, track it to release. Your fee stays on your side of the API.",
    features: ["API keys per integrator", "Corridors, quotes, orders and balance endpoints", "Public demo quote endpoint, no key needed"],
    featuresNext: ["Webhooks and an SDK"],
    next: "— next",
    docs: "Read the docs",
    key: "Request an API key",
    response: "Response",
    caption: "Demo pricing on testnet · illustrative values",
  },
  pricing: {
    eyebrow: "Pricing",
    headline: "Only integrators pay Kalea.",
    sub: "Set per country and side, over a market reference rate.",
    terms: [
      { term: "End users", detail: "One all-in price. No Kalea fee line." },
      { term: "You", detail: "A per-transaction fee from a prefunded balance, lower at volume." },
      { term: "Your markup", detail: "Optional. Set by you, on top." },
    ],
    quoteValidity: "quote validity",
    minutes: "min",
    corridors: "demo corridors on testnet",
  },
  faq: {
    eyebrow: "FAQ",
    headline: "Questions, answered.",
    topics: "FAQ topics",
    businesses: {
      title: "Businesses",
      items: [
        { q: "Who is Kalea for?", a: "Businesses that want local on-ramps, off-ramps or QR payments in their product: wallets, exchanges, fintechs, payment apps, marketplaces and platforms. Kalea does not serve consumers directly." },
        { q: "Which networks and stablecoins do you support?", a: "Today, USDC on the Stellar testnet. Kalea is built to support USDC and USDT across EVM networks (Ethereum, Base, Polygon, Arbitrum, BNB Chain) and non-EVM networks (Solana, Tron); those are next." },
        { q: "Which countries are covered?", a: "Bolivia, Brazil, Peru and Mexico have demo pricing on testnet. Argentina, Colombia, Chile and Ecuador are planned." },
        { q: "Does Kalea hold my users' money?", a: "Kalea never holds local fiat; it moves over local rails between your end user and an independent local liquidity partner. Stablecoins are held by a per-order escrow until the order is released, refunded or resolved." },
        { q: "Can I use Kalea with real funds today?", a: "Not yet. Kalea runs on testnet with demo pricing. Licensing requirements will be assessed per country before operating with real funds." },
      ],
    },
    developers: {
      title: "Developers",
      items: [
        { q: "How do I integrate?", a: "Your backend calls the REST API with an API key: list corridors, request a quote, create an order and follow it to release. The public demo quote endpoint needs no key." },
        { q: "Can I accept QR payments?", a: "Yes. A QR payment is an off-ramp variant: create a sell order with kind qr_payment and the QR payload. Your end user locks stablecoins and the third-party QR is paid in local currency." },
        { q: "Do you offer webhooks or an SDK?", a: "Not yet; both are next. Today you read an order's status from the orders endpoint." },
      ],
    },
  },
  cta: {
    headline: "Add LATAM ramps to your product.",
    sub: "Start on the testnet sandbox, or walk through your corridors with the team.",
    start: "Start building",
    demo: "Book a demo",
  },
  footer: {
    copyright: "© 2026 Kalea · Zer0 Knowledge Hack",
    status: "Live on Stellar testnet · more networks next",
    brand: "Brand",
    github: "GitHub",
  },
  /** Brand guidelines page (/brand/). Source: brand/README.md. Color names stay as token names. */
  brand: {
    meta: {
      title: "Kalea brand guidelines · Logo, color and typography",
      description:
        "How to use the Kalea name, logo, colors, typography and graphic elements when you partner with, integrate or write about Kalea. Includes downloadable SVG files.",
    },
    header: { label: "Brand guidelines", back: "Back to the site" },
    toc: {
      label: "On this page",
      story: "The idea",
      logo: "Logo",
      color: "Color",
      typography: "Typography",
      elements: "Graphic elements",
      rules: "Do and don't",
      contact: "Questions",
    },
    intro: {
      eyebrow: "Brand guidelines",
      headline: "Using the Kalea brand.",
      sub: "For partners, integrators and anyone writing about Kalea: which logo to use, which colors and fonts to apply, and the few rules that keep the brand recognizable.",
      downloads: "Every logo and element on this page links to its SVG and PNG files. Download the file you need instead of redrawing it, or take the whole kit.",
      downloadGuide: "Download guide (PDF)",
      downloadKit: "Download brand kit (ZIP)",
      kitContents: "Logos and elements in SVG and PNG, tokens.json and this guide as PDF in English, Spanish and Portuguese.",
    },
    story: {
      eyebrow: "The idea",
      headline: "The street with a hidden crown.",
      items: [
        { term: "Name", detail: "Kalea is Basque for “the street”: kale, “street”, plus the article -a." },
        { term: "Mark", detail: "A road running between two buildings: money moving through the city." },
        { term: "Hidden crown", detail: "The whole silhouette forms a three-point crown: the user's money, treated with respect." },
      ],
      note: "Basque is the only origin story for the name.",
    },
    logo: {
      eyebrow: "Logo",
      headline: "Mark and lockup.",
      sub: "The lockup pairs the mark with the outlined wordmark, so no font is needed. Use the mark alone where space is tight.",
      lockupAlt: "Kalea lockup: the crowned-street mark in Ocean and Apricot next to the Kalea wordmark in Ink",
      markAlt: "Kalea mark: two Ocean buildings with an Apricot street between them",
      clearSpaceLabel: "½ mark height",
      rules: [
        { term: "Clear space", detail: "Half the mark height on every side. Nothing else enters this area." },
        { term: "Minimum size, mark", detail: "16 px tall." },
        { term: "Minimum size, lockup", detail: "80 px wide." },
      ],
      variantsTitle: "Variants",
      lockupFile: "Lockup",
      markFile: "Mark",
      iconFile: "App icon",
      svg: "SVG",
      png: "PNG",
      variants: {
        default: {
          name: "Default",
          use: "White and light neutral backgrounds.",
          alt: "Default Kalea lockup on white",
        },
        onDark: {
          name: "On dark",
          use: "Ocean, Deep or dark photos.",
          alt: "Kalea lockup on Deep, with a white wordmark and buildings and the Apricot street",
        },
        monoInk: {
          name: "Mono ink",
          use: "One-color print, embossing and other low-fidelity contexts.",
          alt: "One-color Kalea lockup in Ink on white",
        },
        monoWhite: {
          name: "Mono white",
          use: "One-color contexts on dark backgrounds, such as a “Powered by Kalea” footer.",
          alt: "One-color Kalea mark in white on Deep",
        },
        appIcon: {
          name: "App icon",
          use: "App stores, home screens and social avatars (512 × 512).",
          alt: "Kalea app icon: the white and Apricot mark on a rounded Ocean square",
        },
      },
    },
    color: {
      eyebrow: "Color",
      headline: "Six brand colors.",
      sub: "About 60% neutrals, 30% Ocean (or Deep on dark pages) and 10% accents, Apricot first. One Apricot moment per view is usually enough.",
      contrastLabel: "vs white",
      swatches: {
        ocean: { role: "Primary", use: "Buildings in the mark, primary actions, links and headings on light backgrounds.", text: "Text on white: yes." },
        apricot: { role: "Accent", use: "The street in the mark, highlights and one detail per icon.", text: "Text on white: never." },
        violet: { role: "Support accent", use: "Illustrations, charts and secondary highlights.", text: "Text on white: barely passes; prefer Ocean." },
        lime: { role: "Support accent", use: "Illustrations and charts. Not a success color.", text: "Text on white: no." },
        deep: { role: "Dark surface", use: "Dark covers, hero backgrounds and dark-mode surfaces.", text: "Text on white: yes." },
        ink: { role: "Text", use: "Body text and the mono logo on light backgrounds.", text: "Text on white: yes." },
      },
      apricotRule: "Apricot is never used for text on white: it reaches only 2.18:1. Use it for the street, highlights and accents, or as text on Deep (6.81:1) or Ink (8.06:1).",
      threshold: "Contrast is the WCAG 2.x ratio. Body text needs at least 4.5:1; large text and UI shapes need at least 3:1.",
      tokens: "Neutrals, tints and semantic colors are in tokens.json. Take values from there instead of copying them by hand.",
    },
    typography: {
      eyebrow: "Typography",
      headline: "Three families, self-hosted.",
      sub: "All three are open-source families from Fontsource. Kalea serves them itself, with no calls to font CDNs.",
      families: {
        display: { role: "Display", use: "Headlines, hero numbers and the wordmark.", sample: "The street with a hidden crown." },
        text: { role: "Text", use: "UI labels, buttons and paragraphs.", sample: "Clear, calm text for labels, buttons and paragraphs." },
        mono: { role: "Mono", use: "Data, rates, code, transaction IDs and uppercase eyebrows." },
      },
      weightsLabel: "Weights",
      tabular: "Use tabular numbers for amounts and rates so columns align.",
    },
    elements: {
      eyebrow: "Graphic elements",
      headline: "Support the logo, never replace it.",
      sub: "These elements come from the geometry of the mark. Use them to frame and pace content; the logo still signs the page.",
      items: {
        perspective: { name: "Street perspective", use: "Covers, Open Graph images and hero backgrounds.", alt: "Street perspective: lines converging on a vanishing point over Deep, with the Apricot street" },
        pattern: { name: "Crown pattern", use: "A quiet texture on Ocean or Deep. Never behind text.", alt: "Crown pattern tile: repeated Kalea marks on Ocean" },
        plate: { name: "Street plate", use: "Coverage maps and country lists. Build production plates in HTML so they can be translated.", alt: "Street plate reading “Bolivia kalea”" },
        grid: { name: "City grid", use: "A quiet background texture that suggests city blocks." },
        skyline: { name: "Skyline band", use: "Building silhouettes cut from the mark, for section dividers and footers." },
        arrows: { name: "Road-marking arrows", use: "Bold directional arrows for steps and calls to action." },
        highlight: { name: "Street highlight and lanes", use: "An Apricot bar or a dashed lane under one key word. The word keeps its own color.", sample: "one key word" },
      },
      download: "Download",
    },
    rules: {
      eyebrow: "Do and don't",
      headline: "Keep the mark recognizable.",
      doTitle: "Do",
      dontTitle: "Don't",
      do: [
        "Pick the logo file that matches your background.",
        "Keep clear space of half the mark height on every side.",
        "Take colors, fonts and radii from tokens.json.",
        "In a “Kalea × Partner” lockup, set both logos at the same optical height.",
        "Inside a white-label widget, show Kalea only in the “Powered by Kalea” footer, in the host's muted text color.",
      ],
      dont: [
        "Recolor the street. It stays Apricot, except in the mono versions.",
        "Stretch, skew, rotate or re-space the mark and wordmark.",
        "Add effects: shadows, glows, outlines, gradients or bevels.",
        "Place the logo on busy areas of patterns or photos.",
        "Use Apricot for text on white.",
        "Alter the crown or the street geometry, or redraw the mark.",
        "Make the Kalea logo larger than partner logos on co-branding walls.",
      ],
      examplesLabel: "Misuse examples",
      examples: {
        recolor: "Recolored",
        stretch: "Stretched",
        rotate: "Rotated",
        effects: "Shadow added",
      },
      exampleAlt: "Incorrect use of the Kalea lockup: {example}",
    },
    contact: {
      eyebrow: "Questions",
      headline: "Co-branding, or something not covered here?",
      sub: "Open an issue on GitHub and tell us where and how you plan to use the brand. For co-branding, use only files from each partner's official press kit, and never redraw or recolor a partner logo.",
      cta: "Open a GitHub issue",
    },
  },
  /** Display names only; API values (country codes, rail ids) never change. */
  countries: COUNTRY_NAMES,
  /** Rail names as labels (table cells, tabs). */
  rails: RAIL_NAMES,
  /** Rail names inside running text, where a generic rail is lowercase. */
  railsInline: { bank_transfer: "bank transfer" } as Partial<Record<Rail, string>>,
  /** Last separator of an inline list ("Pix, SPEI and bank transfer"). */
  and: "and",
};

export type Dictionary = typeof en;
