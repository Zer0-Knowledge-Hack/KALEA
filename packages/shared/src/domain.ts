/**
 * Kalea B2B LATAM ramp domain model (canonical).
 * Business rules: odd/tasks/b2b-latam-ramp.md ("Business model"), docs/business-model.md
 * and docs/order-lifecycle.md.
 */

// ---------------------------------------------------------------------------
// Countries, currencies and rails
// ---------------------------------------------------------------------------

/** Initial LATAM coverage, ISO 3166-1 alpha-2. */
export const COUNTRIES = ["BO", "AR", "BR", "CO", "PE", "MX", "CL", "EC"] as const;
export type Country = (typeof COUNTRIES)[number];

/** Per-country ISO 4217 currency, minor-unit decimals and local payment rails. */
export const COUNTRY_CATALOG = {
  BO: { currency: "BOB", fiatDecimals: 2, rails: ["qr_simple", "bank_transfer"] },
  AR: { currency: "ARS", fiatDecimals: 2, rails: ["alias_cbu"] },
  BR: { currency: "BRL", fiatDecimals: 2, rails: ["pix"] },
  CO: { currency: "COP", fiatDecimals: 2, rails: ["bank_transfer"] },
  PE: { currency: "PEN", fiatDecimals: 2, rails: ["yape", "cci"] },
  MX: { currency: "MXN", fiatDecimals: 2, rails: ["spei"] },
  CL: { currency: "CLP", fiatDecimals: 0, rails: ["bank_transfer"] },
  EC: { currency: "USD", fiatDecimals: 2, rails: ["bank_transfer"] },
} as const satisfies Record<Country, { currency: string; fiatDecimals: number; rails: readonly string[] }>;

type Catalog = typeof COUNTRY_CATALOG;
export type FiatCurrency = Catalog[Country]["currency"];
export type Rail = Catalog[Country]["rails"][number];
export type RailOf<C extends Country> = Catalog[C]["rails"][number];

export const railsFor = (country: Country): readonly Rail[] => COUNTRY_CATALOG[country].rails;
export const isRailSupported = (country: Country, rail: Rail): boolean => railsFor(country).includes(rail);

/** buy = on-ramp (end user pays fiat, receives USDC); sell = off-ramp (end user sends USDC, receives fiat). */
export type Side = "buy" | "sell";

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

/** A business embedding the ramp. Kalea's only customer; its fee is debited from a prefunded USDC balance. */
export interface Integrator {
  id: string;
  name: string;
  feeBps: number;
  prefundedBalanceUsdc: number;
}

/** A liquidity provider moving local fiat under its own accounts. */
export interface Merchant {
  id: string;
  alias: string;
  countries: Country[];
  rails: Rail[];
  rating: number;
  /** USDC-equivalent liquidity the merchant can commit to open orders (either side). */
  capacityUsdc: number;
}

// ---------------------------------------------------------------------------
// Pricing and quotes
// ---------------------------------------------------------------------------

/** Pricing for one country over a market reference (mid) rate in fiat per USDC. */
export interface CorridorPricing {
  country: Country;
  midRate: number;
  buyMarkupBps: number;
  sellDiscountBps: number;
  /** One reward for every order kind (buy, sell and QR payment). Launch default: 150 (1.5%). */
  merchantRewardBps: number;
  insuranceBps: number;
}

export interface QuoteBreakdown {
  midRate: number;
  /** Merchant reward, locked in the merchant vault (bps of the end-user USDC amount). */
  merchantRewardUsdc: number;
  /** Insurance fund contribution (bps of the end-user USDC amount). */
  insuranceUsdc: number;
  /** Total USDC locked in the order escrow. */
  escrowUsdc: number;
  /** USDC released to the recipient: the end user on buy, the merchant on sell. */
  recipientUsdc: number;
  /** Kalea fee debited from the integrator's prefunded balance. Never part of end-user amounts. */
  integratorFeeUsdc: number;
}

/** What the end user sees: one all-in rate and exact amounts. `breakdown` is internal. */
export interface Quote {
  side: Side;
  country: Country;
  fiatCurrency: FiatCurrency;
  rail: Rail;
  /** All-in fiat per USDC. */
  rate: number;
  fiatAmount: number;
  usdcAmount: number;
  breakdown: QuoteBreakdown;
  expiresAt: string;
}

export interface QuoteInput {
  pricing: CorridorPricing;
  integrator: Pick<Integrator, "feeBps">;
  side: Side;
  rail: Rail;
  amount: number;
  /** Which side of the conversion `amount` is fixed in. */
  amountIn: "fiat" | "usdc";
  /** Epoch milliseconds; injected to keep the function pure. */
  now: number;
}

export const QUOTE_TTL_MS = 5 * 60_000;

export class QuoteError extends Error {
  constructor(
    readonly code: "unsupported_rail" | "invalid_amount",
    message: string,
  ) {
    super(message);
    this.name = "QuoteError";
  }
}

/**
 * Rounding policy:
 * - USDC uses 7 decimals (Stellar stroop precision); fiat uses the currency's minor units.
 * - The variable side of the conversion rounds against the end user by at most one unit
 *   (received amounts down, paid or locked amounts up) so the escrow is never underfunded.
 * - Breakdown components (reward, insurance, integrator fee) round down to 7 decimals.
 * - The all-in rate rounds half-up to 6 decimals and amounts are derived from that rounded rate.
 * Display formatting (e.g. 2 USDC decimals) is a presentation concern.
 */
export const USDC_DECIMALS = 7;
const RATE_DECIMALS = 6;

type RoundMode = "floor" | "ceil" | "round";
export function roundTo(value: number, decimals: number, mode: RoundMode = "round"): number {
  const factor = 10 ** decimals;
  // toPrecision(15) strips binary noise such as 1.0000000000000002 before rounding.
  const scaled = Number((value * factor).toPrecision(15));
  return Math[mode](scaled) / factor;
}

const bps = (value: number, basisPoints: number) => roundTo((value * basisPoints) / 10_000, USDC_DECIMALS, "floor");

export function computeQuote(input: QuoteInput): Quote {
  const { pricing, integrator, side, rail, amount, amountIn, now } = input;
  const { country } = pricing;
  const { currency, fiatDecimals } = COUNTRY_CATALOG[country];

  if (!isRailSupported(country, rail)) throw new QuoteError("unsupported_rail", `Rail ${rail} is not available in ${country}`);
  if (!Number.isFinite(amount) || amount <= 0) throw new QuoteError("invalid_amount", "Amount must be a positive number");

  const adjustBps = side === "buy" ? pricing.buyMarkupBps : -pricing.sellDiscountBps;
  const rate = roundTo((pricing.midRate * (10_000 + adjustBps)) / 10_000, RATE_DECIMALS);

  // buy: end user receives USDC (round down) and pays fiat (round up).
  // sell: end user receives fiat (round down) and locks USDC (round up).
  let fiatAmount: number;
  let usdcAmount: number;
  if (amountIn === "fiat") {
    fiatAmount = roundTo(amount, fiatDecimals);
    usdcAmount = roundTo(fiatAmount / rate, USDC_DECIMALS, side === "buy" ? "floor" : "ceil");
  } else {
    usdcAmount = roundTo(amount, USDC_DECIMALS);
    fiatAmount = roundTo(usdcAmount * rate, fiatDecimals, side === "buy" ? "ceil" : "floor");
  }

  const merchantRewardUsdc = bps(usdcAmount, pricing.merchantRewardBps);
  const insuranceUsdc = bps(usdcAmount, pricing.insuranceBps);
  // buy: the merchant locks end-user amount + reward + insurance.
  // sell: the end user locks the amount; reward and insurance come out of the merchant's share.
  const escrowUsdc = side === "buy" ? roundTo(usdcAmount + merchantRewardUsdc + insuranceUsdc, USDC_DECIMALS) : usdcAmount;
  const recipientUsdc = side === "buy" ? usdcAmount : roundTo(usdcAmount - merchantRewardUsdc - insuranceUsdc, USDC_DECIMALS);

  return {
    side,
    country,
    fiatCurrency: currency,
    rail,
    rate,
    fiatAmount,
    usdcAmount,
    breakdown: {
      midRate: pricing.midRate,
      merchantRewardUsdc,
      insuranceUsdc,
      escrowUsdc,
      recipientUsdc,
      integratorFeeUsdc: bps(usdcAmount, integrator.feeBps),
    },
    expiresAt: new Date(now + QUOTE_TTL_MS).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Merchant selection
// ---------------------------------------------------------------------------

export interface MerchantCriteria {
  country: Country;
  rail: Rail;
  /** USDC the merchant must be able to commit (use the escrow amount on buy). */
  usdcAmount: number;
}

/** Best-rated merchant serving the country and rail with enough capacity; ties go to the larger capacity. */
export function selectMerchant(merchants: readonly Merchant[], criteria: MerchantCriteria): Merchant | undefined {
  return merchants
    .filter((m) => m.countries.includes(criteria.country) && m.rails.includes(criteria.rail))
    .filter((m) => m.capacityUsdc >= criteria.usdcAmount)
    .sort((a, b) => b.rating - a.rating || b.capacityUsdc - a.capacityUsdc)[0];
}

// ---------------------------------------------------------------------------
// Orders and lifecycle (docs/order-lifecycle.md)
// ---------------------------------------------------------------------------

export const ORDER_STATUSES = ["created", "escrow_locked", "fiat_sent", "released", "cancelled", "expired", "disputed"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  created: ["escrow_locked", "cancelled", "expired"],
  escrow_locked: ["fiat_sent", "cancelled", "expired"],
  fiat_sent: ["released", "disputed"],
  disputed: ["released", "cancelled"],
  released: [],
  cancelled: [],
  expired: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean => ORDER_TRANSITIONS[from].includes(to);
export const isTerminalStatus = (status: OrderStatus): boolean => ORDER_TRANSITIONS[status].length === 0;

/**
 * transfer: fiat moves between the end user and the merchant.
 * qr_payment: a sell variant where the merchant pays a third-party QR (the payee) instead of the end user.
 */
export type OrderKind = "transfer" | "qr_payment";

export const isOrderKindAllowed = (side: Side, kind: OrderKind): boolean => kind === "transfer" || side === "sell";

/** Amounts are fixed at creation and never change afterwards. */
export interface Order {
  id: string;
  integratorId: string;
  /** Opaque end-user reference supplied by the integrator. */
  endUserRef: string;
  merchantId: string;
  side: Side;
  /** Defaults to "transfer". */
  kind?: OrderKind;
  /** Third-party QR to pay; required when kind is "qr_payment". */
  payee?: { qrPayload: string };
  country: Country;
  fiatCurrency: FiatCurrency;
  rail: Rail;
  fiatAmount: number;
  usdcAmount: number;
  rate: number;
  breakdown: QuoteBreakdown;
  /** Soroban escrow identifier; null until the escrow is created. */
  escrowId: string | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Demo data (illustrative values only, not market quotes)
// ---------------------------------------------------------------------------

export const DEFAULT_MERCHANT_REWARD_BPS = 150;

const demoPricing = (country: Country, midRate: number): CorridorPricing => ({
  country,
  midRate,
  buyMarkupBps: 200,
  sellDiscountBps: 150,
  merchantRewardBps: DEFAULT_MERCHANT_REWARD_BPS,
  insuranceBps: 10,
});

export const DEMO_CORRIDOR_PRICING: CorridorPricing[] = [
  demoPricing("BO", 9.6),
  demoPricing("BR", 5.4),
  demoPricing("PE", 3.75),
  demoPricing("MX", 18.5),
];

export const DEMO_INTEGRATORS: Integrator[] = [
  { id: "int_wallet", name: "Demo Wallet", feeBps: 30, prefundedBalanceUsdc: 5_000 },
  { id: "int_payments", name: "Demo Payments", feeBps: 20, prefundedBalanceUsdc: 25_000 },
];

export const DEMO_MERCHANTS: Merchant[] = [
  { id: "mer_andes", alias: "Andes Liquidity", countries: ["BO", "PE"], rails: ["qr_simple", "bank_transfer", "yape"], rating: 4.9, capacityUsdc: 20_000 },
  { id: "mer_rio", alias: "Rio Liquidity", countries: ["BR"], rails: ["pix"], rating: 4.8, capacityUsdc: 50_000 },
  { id: "mer_azteca", alias: "Azteca Liquidity", countries: ["MX"], rails: ["spei"], rating: 4.7, capacityUsdc: 15_000 },
];
