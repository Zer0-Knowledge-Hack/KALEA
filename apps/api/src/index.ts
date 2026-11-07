import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { env } from "./env.js";
import { binanceP2P, manualRate, type RateProvider } from "./pricing/providers.js";
import { createRateService } from "./pricing/service.js";

const providers: RateProvider[] = env.priceSources.flatMap((s): RateProvider[] => {
  if (s === "binance") return [binanceP2P("USDT"), binanceP2P("USDC")];
  if (s === "manual" && env.manualRate) return [manualRate(env.manualRate.buy, env.manualRate.sell)];
  return [];
});

const rates = createRateService(providers, {
  onError: (name, e) => console.warn(`[rates] ${name}:`, e instanceof Error ? e.message : e),
});

serve({ fetch: createApp({ rates }).fetch, port: env.port }, (i) => console.log(`KALEA API → http://localhost:${i.port}`));
