import { COUNTRY_CATALOG, DEMO_CORRIDOR_PRICING, DEMO_INTEGRATORS, computeQuote, type Country, type Rail } from "@kalea/shared";
import type { DemoQuote, QuoteRequest } from "./api";

export const COUNTRY_NAMES: Record<Country, string> = {
  BO: "Bolivia",
  AR: "Argentina",
  BR: "Brazil",
  CO: "Colombia",
  PE: "Peru",
  MX: "Mexico",
  CL: "Chile",
  EC: "Ecuador",
};

export const RAIL_NAMES: Record<Rail, string> = {
  qr_simple: "QR Simple",
  bank_transfer: "Bank transfer",
  alias_cbu: "Alias / CBU",
  pix: "Pix",
  yape: "Yape",
  cci: "CCI",
  spei: "SPEI",
};

/** Countries with demo pricing in the shared catalog (the API serves the same set by default). */
export const DEMO_COUNTRIES: Country[] = DEMO_CORRIDOR_PRICING.map((p) => p.country);

export interface Corridor {
  country: Country;
  currency: string;
  fiatDecimals: number;
  rails: readonly Rail[];
}

export const fallbackCorridors = (): Corridor[] =>
  DEMO_COUNTRIES.map((country) => ({ country, ...COUNTRY_CATALOG[country] }));

export const formatNumber = (n: number, decimals = 2) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);

export const formatFiat = (n: number, currency: string, decimals = 2) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

/**
 * Offline fallback for the landing demo when the API is unreachable: the same shared demo pricing
 * the API's public demo endpoint uses. Throws `QuoteError` for invalid input.
 */
export function localDemoQuote(input: QuoteRequest): DemoQuote {
  const pricing = DEMO_CORRIDOR_PRICING.find((p) => p.country === input.country);
  if (!pricing) throw new Error(`Country ${input.country} is not supported yet`);
  const { side, country, fiatCurrency, rail, rate, fiatAmount, usdcAmount, expiresAt } = computeQuote({
    ...input,
    pricing,
    integrator: DEMO_INTEGRATORS[0],
    now: Date.now(),
  });
  return { side, country, fiatCurrency, rail, rate, fiatAmount, usdcAmount, expiresAt };
}
