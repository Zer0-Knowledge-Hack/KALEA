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
    note: "Testnet today: the escrow lifecycle is simulated while the on-chain contract is built.",
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
    github: "GitHub",
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
