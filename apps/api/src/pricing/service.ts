import { aggregateRates, type RateSample, type ReferenceRate } from "@kalea/shared";
import type { RateProvider } from "./providers.js";

export interface RateService {
  get(): Promise<ReferenceRate | null>;
}

interface Options {
  ttlMs?: number;
  staleAfterMs?: number;
  now?: () => Date;
  onError?: (provider: string, error: unknown) => void;
}

/**
 * Caches the blended reference for `ttlMs`, dedupes concurrent refreshes and keeps
 * each provider's last good sample, so one failing source degrades instead of breaking quotes.
 */
export function createRateService(providers: RateProvider[], opts: Options = {}): RateService {
  const { ttlMs = 60_000, staleAfterMs = 10 * 60_000, now = () => new Date(), onError } = opts;
  const lastGood = new Map<string, RateSample>();
  let cached: { at: number; value: ReferenceRate | null } | null = null;
  let inflight: Promise<ReferenceRate | null> | null = null;

  async function refresh() {
    const results = await Promise.allSettled(providers.map((p) => p.fetch()));
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value.depth > 0) lastGood.set(providers[i].name, r.value);
      else if (r.status === "rejected") onError?.(providers[i].name, r.reason);
    });
    const value = aggregateRates([...lastGood.values()], now(), staleAfterMs);
    cached = { at: now().getTime(), value };
    return value;
  }

  return {
    async get() {
      if (cached && now().getTime() - cached.at < ttlMs) return cached.value;
      inflight ??= refresh().finally(() => { inflight = null; });
      return inflight;
    },
  };
}
