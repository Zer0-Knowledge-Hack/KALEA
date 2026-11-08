import { COUNTRIES, DEMO_CORRIDOR_PRICING, DEMO_INTEGRATORS, QuoteError, computeQuote, type Country, type Rail } from "@kalea/shared";
import { ApiRequestError, api, type DemoQuote, type QuoteRequest } from "@/lib/api";
import { fallbackCorridors } from "@/lib/catalog";

/**
 * Landing "corridor quote demo" proxy. The integrator key is read from a server-only env var
 * (no NEXT_PUBLIC_ prefix) and never leaves this handler. Without a key, or when the API is
 * unreachable, quotes are computed locally from the shared demo pricing.
 */
export const dynamic = "force-dynamic";

const demoKey = () => process.env.KALEA_DEMO_INTEGRATOR_KEY;

const errorBody = (code: string, message: string) => ({ error: { code, message } });

/** Client errors from the API (bad input) are passed through; auth and server failures fall back to demo pricing. */
const passThrough = (e: unknown): e is ApiRequestError => e instanceof ApiRequestError && e.status === 400;

export async function GET() {
  const key = demoKey();
  if (key) {
    try {
      const { corridors } = await api.integrator.corridors(key);
      return Response.json({ corridors, source: "live" });
    } catch {
      // Fall through to the shared catalog.
    }
  }
  return Response.json({ corridors: fallbackCorridors(), source: "demo" });
}

function parse(raw: unknown): QuoteRequest | null {
  const b = raw as Partial<QuoteRequest> | null;
  if (!b || !COUNTRIES.includes(b.country as Country)) return null;
  if (b.side !== "buy" && b.side !== "sell") return null;
  if (b.amountIn !== "fiat" && b.amountIn !== "usdc") return null;
  if (typeof b.rail !== "string" || typeof b.amount !== "number") return null;
  return { country: b.country as Country, side: b.side, rail: b.rail as Rail, amount: b.amount, amountIn: b.amountIn };
}

const toDemo = ({ side, country, fiatCurrency, rail, rate, fiatAmount, usdcAmount, expiresAt }: DemoQuote): DemoQuote => ({
  side, country, fiatCurrency, rail, rate, fiatAmount, usdcAmount, expiresAt,
});

export async function POST(request: Request) {
  const input = parse(await request.json().catch(() => null));
  if (!input) return Response.json(errorBody("invalid_request", "country, side, rail, amount and amountIn are required"), { status: 400 });

  const key = demoKey();
  if (key) {
    try {
      const { quote } = await api.integrator.quote(key, input);
      return Response.json({ quote: toDemo(quote), source: "live" });
    } catch (e) {
      if (passThrough(e)) return Response.json(errorBody(e.code, e.message), { status: 400 });
    }
  }

  const pricing = DEMO_CORRIDOR_PRICING.find((p) => p.country === input.country);
  if (!pricing) return Response.json(errorBody("unsupported_country", `Country ${input.country} is not supported yet`), { status: 400 });
  try {
    const quote = computeQuote({ ...input, pricing, integrator: DEMO_INTEGRATORS[0], now: Date.now() });
    return Response.json({ quote: toDemo(quote), source: "demo" });
  } catch (e) {
    if (e instanceof QuoteError) return Response.json(errorBody(e.code, e.message), { status: 400 });
    throw e;
  }
}
