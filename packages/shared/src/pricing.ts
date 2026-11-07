import type { Side } from "./index";

/** One market snapshot from a single source, in BOB per USD-stablecoin. */
export interface RateSample {
  source: string;
  /** What a user pays per unit when buying. */
  buy: number;
  /** What a user receives per unit when selling. */
  sell: number;
  /** Number of ads/quotes the snapshot is built from. */
  depth: number;
  fetchedAt: string;
}

export interface ReferenceRate {
  buy: number;
  sell: number;
  mid: number;
  sources: string[];
  updatedAt: string;
  stale: boolean;
}

export interface PricePolicy {
  /** Max fraction an offer may be worse than the reference before it is hidden. */
  maxPremium: number;
  /** Max fraction an offer may be better than the reference before it is treated as bait. */
  maxDiscount: number;
}

export const DEFAULT_POLICY: PricePolicy = { maxPremium: 0.02, maxDiscount: 0.015 };

export type PriceVerdict = "best" | "fair" | "rejected";

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

export function median(values: number[]): number {
  if (values.length === 0) throw new Error("median of empty list");
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Median of the best `n` prices, so one outlier ad cannot move the reference. */
export function topOfBook(prices: number[], side: Side, n = 5): number {
  const valid = prices.filter((p) => Number.isFinite(p) && p > 0);
  const sorted = [...valid].sort((a, b) => (side === "buy" ? a - b : b - a));
  return median(sorted.slice(0, n));
}

/** Depth-weighted blend of sources; sources with no liquidity are ignored. */
export function aggregateRates(samples: RateSample[], now = new Date(), staleAfterMs = 10 * 60_000): ReferenceRate | null {
  const live = samples.filter((s) => s.depth > 0 && s.buy > 0 && s.sell > 0);
  if (live.length === 0) return null;
  const weight = live.reduce((acc, s) => acc + s.depth, 0);
  const buy = round4(live.reduce((acc, s) => acc + s.buy * s.depth, 0) / weight);
  const sell = round4(live.reduce((acc, s) => acc + s.sell * s.depth, 0) / weight);
  const oldest = Math.min(...live.map((s) => Date.parse(s.fetchedAt)));
  return {
    buy,
    sell,
    mid: round4((buy + sell) / 2),
    sources: live.map((s) => s.source),
    updatedAt: new Date(oldest).toISOString(),
    stale: now.getTime() - oldest > staleAfterMs,
  };
}

/** Positive = worse for the user than the market, negative = better. */
export function spreadVsReference(side: Side, rate: number, ref: ReferenceRate): number {
  return round4(side === "buy" ? (rate - ref.buy) / ref.buy : (ref.sell - rate) / ref.sell);
}

export function priceVerdict(spread: number, policy: PricePolicy = DEFAULT_POLICY): PriceVerdict {
  if (spread > policy.maxPremium || spread < -policy.maxDiscount) return "rejected";
  return spread <= 0 ? "best" : "fair";
}
