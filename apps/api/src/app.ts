import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { rankQuotes, toUsdc, type Order } from "@kalea/shared";
import { env } from "./env.js";
import { authRoutes, requireAuth, type AuthVars } from "./auth.js";
import { offers, operators, orders } from "./store.js";

export const app = new Hono<{ Variables: AuthVars }>();
app.use("*", cors({ origin: env.webOrigin, allowHeaders: ["Authorization", "Content-Type"] }));

app.get("/health", (c) => c.json({ ok: true, network: env.stellarNetwork }));
app.route("/auth", authRoutes);

const quoteSchema = z.object({
  side: z.enum(["buy", "sell"]),
  amountBob: z.coerce.number().positive(),
  method: z.enum(["qr_simple", "bank_transfer"]),
});

app.get("/quotes", (c) => {
  const parsed = quoteSchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: z.treeifyError(parsed.error) }, 400);
  return c.json({ quotes: rankQuotes(offers, operators, parsed.data) });
});

const orderSchema = z.object({ offerId: z.string(), amountBob: z.number().positive(), method: z.enum(["qr_simple", "bank_transfer"]) });

app.post("/orders", requireAuth, async (c) => {
  const body = orderSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: z.treeifyError(body.error) }, 400);
  const offer = offers.find((o) => o.id === body.data.offerId);
  if (!offer) throw new HTTPException(404, { message: "Oferta no encontrada" });
  const now = new Date().toISOString();
  const order: Order = {
    id: crypto.randomUUID(),
    userId: c.get("userId"),
    offerId: offer.id,
    side: offer.side,
    method: body.data.method,
    amountBob: body.data.amountBob,
    amountUsdc: toUsdc(body.data.amountBob, offer.rate),
    rate: offer.rate,
    status: "awaiting_fiat",
    createdAt: now,
    updatedAt: now,
  };
  orders.set(order.id, order);
  return c.json({ order }, 201);
});

app.get("/orders", requireAuth, (c) =>
  c.json({ orders: [...orders.values()].filter((o) => o.userId === c.get("userId")) }),
);

app.get("/orders/:id", requireAuth, (c) => {
  const order = orders.get(c.req.param("id"));
  if (!order || order.userId !== c.get("userId")) throw new HTTPException(404, { message: "Orden no encontrada" });
  return c.json({ order });
});
