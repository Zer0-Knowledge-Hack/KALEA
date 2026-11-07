import { topOfBook, type RateSample } from "@kalea/shared";

export interface RateProvider {
  name: string;
  fetch(): Promise<RateSample>;
}

const BINANCE_P2P = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

async function binanceSide(asset: string, tradeType: "BUY" | "SELL"): Promise<number[]> {
  const res = await fetch(BINANCE_P2P, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fiat: "BOB", asset, tradeType, page: 1, rows: 10, payTypes: [], publisherType: null }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new Error(`Binance P2P ${res.status}`);
  const body = (await res.json()) as { data?: { adv: { price: string } }[] };
  return (body.data ?? []).map((d) => Number(d.adv.price));
}

/** Binance "BUY" ads are what a user pays to buy; "SELL" ads are what a user receives. */
export function binanceP2P(asset: "USDT" | "USDC"): RateProvider {
  return {
    name: `binance-p2p:${asset}`,
    async fetch() {
      const [buys, sells] = await Promise.all([binanceSide(asset, "BUY"), binanceSide(asset, "SELL")]);
      const depth = Math.min(buys.length, sells.length);
      return {
        source: this.name,
        buy: depth ? topOfBook(buys, "buy") : 0,
        sell: depth ? topOfBook(sells, "sell") : 0,
        depth,
        fetchedAt: new Date().toISOString(),
      };
    },
  };
}

export function manualRate(buy: number, sell: number, depth = 1): RateProvider {
  return {
    name: "manual",
    async fetch() {
      return { source: "manual", buy, sell, depth, fetchedAt: new Date().toISOString() };
    },
  };
}
