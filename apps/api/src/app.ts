import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import {
  COUNTRIES,
  COUNTRY_CATALOG,
  USDC_DECIMALS,
  computeQuote,
  isOrderKindAllowed,
  roundTo,
  selectMerchant,
  type Integrator,
  type RampOrder,
  type Rail,
} from "@kalea/shared";
import { env } from "./env.js";
import { createAuth, type Actor, type AppEnv, type AuthConfig } from "./auth.js";
import { ApiError, notFound, onError, parseBody } from "./errors.js";
import { EVENT_TYPES, applyEvent, committedUsdc, integratorView, merchantView, reservedFeesUsdc } from "./lifecycle.js";
import { createStore, type StoreSeed } from "./store.js";

export interface AppConfig extends AuthConfig, Partial<Pick<StoreSeed, "integrators" | "merchants" | "pricing">> {
  integratorKeys: StoreSeed["integratorKeys"];
  merchantAccounts: StoreSeed["merchantAccounts"];
  webOrigin: string;
  stellarNetwork: string;
  /** Epoch milliseconds; injectable so tests control quote expiry and reward unlock times. */
  now: () => number;
}

const quoteSchema = z.object({
  country: z.enum(COUNTRIES),
  side: z.enum(["buy", "sell"]),
  rail: z.string().min(1),
  // Positivity is checked by computeQuote so it surfaces as the shared `invalid_amount` QuoteError.
  amount: z.number(),
  amountIn: z.enum(["fiat", "usdc"]),
  kind: z.enum(["transfer", "qr_payment"]).default("transfer"),
});

const orderSchema = quoteSchema
  .extend({
    endUserRef: z.string().min(1).max(128),
    payee: z.object({ qrPayload: z.string().min(1).max(2048) }).optional(),
  })
  .refine((o) => (o.kind === "qr_payment") === (o.payee !== undefined), {
    path: ["payee"],
    message: "payee.qrPayload is required for qr_payment orders and not allowed otherwise",
  });

const eventSchema = z.object({ type: z.enum(EVENT_TYPES) });

export function createApp(overrides: Partial<AppConfig> = {}) {
  const config: AppConfig = { ...env, now: Date.now, ...overrides };
  const store = createStore(config);
  const auth = createAuth(store, config);
  const { requireIntegrator, requireMerchant, requireActor } = auth;

  const integratorOf = (actor: Actor): Integrator => {
    if (actor.kind !== "integrator") throw new ApiError(401, "invalid_api_key", "Invalid API key");
    return actor.integrator;
  };

  function quote(integrator: Integrator, input: z.infer<typeof quoteSchema>) {
    const pricing = store.pricing.find((p) => p.country === input.country);
    if (!pricing) throw new ApiError(400, "unsupported_country", `Country ${input.country} is not supported yet`);
    if (!isOrderKindAllowed(input.side, input.kind)) {
      throw new ApiError(400, "unsupported_order_kind", `Order kind ${input.kind} is not available for ${input.side} orders`);
    }
    return computeQuote({ ...input, pricing, integrator, rail: input.rail as Rail, now: config.now() });
  }

  function findOrder(id: string, actor: Actor): RampOrder {
    const order = store.orders.get(id);
    const owned = actor.kind === "integrator" ? order?.integratorId === actor.integrator.id : order?.merchantId === actor.merchant.id;
    if (!order || !owned) throw new ApiError(404, "order_not_found", "Order not found");
    return order;
  }

  const balanceOf = (integrator: Integrator) => {
    const reservedUsdc = reservedFeesUsdc(store, integrator.id);
    const fees = store.feeLedger.filter((f) => f.integratorId === integrator.id);
    return {
      integratorId: integrator.id,
      feeBps: integrator.feeBps,
      balanceUsdc: integrator.prefundedBalanceUsdc,
      reservedUsdc,
      availableUsdc: roundTo(integrator.prefundedBalanceUsdc - reservedUsdc, USDC_DECIMALS),
      feesPaidUsdc: roundTo(fees.reduce((a, f) => a + f.amountUsdc, 0), USDC_DECIMALS),
      releasedOrders: fees.length,
    };
  };

  const v1 = new Hono<AppEnv>()
    .route("/merchants/auth", auth.merchantAuthRoutes)

    // ---- Integrator endpoints (API key) ----------------------------------
    .get("/corridors", requireIntegrator, (c) =>
      c.json({
        corridors: store.pricing.map(({ country }) => ({
          country,
          currency: COUNTRY_CATALOG[country].currency,
          fiatDecimals: COUNTRY_CATALOG[country].fiatDecimals,
          rails: COUNTRY_CATALOG[country].rails,
          sides: ["buy", "sell"],
          orderKinds: { buy: ["transfer"], sell: ["transfer", "qr_payment"] },
        })),
      }),
    )
    .post("/quotes", requireIntegrator, async (c) => {
      const input = await parseBody(c, quoteSchema);
      const { breakdown, ...q } = quote(integratorOf(c.get("actor")), input);
      return c.json({ quote: { ...q, kind: input.kind, integratorFeeUsdc: breakdown.integratorFeeUsdc } });
    })
    .post("/orders", requireIntegrator, async (c) => {
      const integrator = integratorOf(c.get("actor"));
      const { endUserRef, payee, kind, ...input } = await parseBody(c, orderSchema);
      const q = quote(integrator, { ...input, kind });

      // Merchants commit their escrow amount to each open order; only free capacity counts.
      const available = store.merchants.map((m) => ({ ...m, capacityUsdc: m.capacityUsdc - committedUsdc(store, m.id) }));
      const merchant = selectMerchant(available, { country: q.country, rail: q.rail, usdcAmount: q.breakdown.escrowUsdc });
      if (!merchant) throw new ApiError(409, "no_merchant_capacity", "No merchant can take this order right now");

      // 402: the prefunded balance (minus fees reserved by open orders) must cover this order's fee.
      if (balanceOf(integrator).availableUsdc < q.breakdown.integratorFeeUsdc) {
        throw new ApiError(402, "insufficient_balance", "Prefunded USDC balance does not cover the order fee");
      }

      const at = new Date(config.now()).toISOString();
      const order: RampOrder = {
        id: `ord_${crypto.randomUUID()}`,
        integratorId: integrator.id,
        endUserRef,
        merchantId: merchant.id,
        side: q.side,
        kind,
        ...(payee ? { payee } : {}),
        country: q.country,
        fiatCurrency: q.fiatCurrency,
        rail: q.rail,
        fiatAmount: q.fiatAmount,
        usdcAmount: q.usdcAmount,
        rate: q.rate,
        breakdown: q.breakdown,
        escrowId: null,
        status: "created",
        createdAt: at,
        updatedAt: at,
      };
      store.orders.set(order.id, order);
      return c.json({ order: integratorView(order) }, 201);
    })
    .get("/orders", requireIntegrator, (c) => {
      const { id } = integratorOf(c.get("actor"));
      return c.json({ orders: [...store.orders.values()].filter((o) => o.integratorId === id).map(integratorView) });
    })
    .get("/orders/:id", requireIntegrator, (c) => c.json({ order: integratorView(findOrder(c.req.param("id"), c.get("actor"))) }))
    .post("/orders/:id/cancel", requireIntegrator, (c) => {
      const actor = c.get("actor");
      const order = applyEvent(store, findOrder(c.req.param("id"), actor), "cancelled", actor, config.now());
      return c.json({ order: integratorView(order) });
    })
    .get("/balance", requireIntegrator, (c) => c.json(balanceOf(integratorOf(c.get("actor")))))

    // ---- Lifecycle simulation (integrator key or merchant JWT) -----------
    .post("/orders/:id/events", requireActor, async (c) => {
      const actor = c.get("actor");
      const { type } = await parseBody(c, eventSchema);
      const order = applyEvent(store, findOrder(c.req.param("id"), actor), type, actor, config.now());
      return c.json({ order: actor.kind === "integrator" ? integratorView(order) : merchantView(order) });
    })

    // ---- Merchant endpoints (SEP-10 JWT) ---------------------------------
    .get("/merchants/me/orders", requireMerchant, (c) => {
      const actor = c.get("actor");
      const id = actor.kind === "merchant" ? actor.merchant.id : "";
      return c.json({ orders: [...store.orders.values()].filter((o) => o.merchantId === id).map(merchantView) });
    })
    .get("/merchants/me/rewards", requireMerchant, (c) => {
      const actor = c.get("actor");
      const rewards = store.rewardVault.filter((r) => actor.kind === "merchant" && r.merchantId === actor.merchant.id);
      const now = config.now();
      const total = (locked: boolean) =>
        roundTo(rewards.filter((r) => Date.parse(r.unlockAt) > now === locked).reduce((a, r) => a + r.amountUsdc, 0), USDC_DECIMALS);
      return c.json({ rewards, lockedUsdc: total(true), unlockedUsdc: total(false) });
    });

  return new Hono()
    .use("*", cors({ origin: config.webOrigin, allowHeaders: ["Authorization", "Content-Type", "X-API-Key"] }))
    .get("/health", (c) => c.json({ ok: true, network: config.stellarNetwork }))
    .route("/v1", v1)
    .onError(onError)
    .notFound(notFound);
}

export const app = createApp();
