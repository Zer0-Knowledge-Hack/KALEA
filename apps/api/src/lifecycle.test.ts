import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { decodeJwt } from "jose";
import { KEYS, T0, buyBo, sellBo, setup } from "./test-helpers";

const DAY = 24 * 60 * 60_000;

async function withOrder(body: object = buyBo, ctx = setup()) {
  const { order } = await (await ctx.call("/v1/orders", { key: KEYS.wallet, body: { endUserRef: "u1", ...body } })).json();
  const { token } = await (await ctx.merchantLogin()).json();
  const asMerchant = (type: string) => ctx.call(`/v1/orders/${order.id}/events`, { token, body: { type } });
  const asIntegrator = (type: string) => ctx.call(`/v1/orders/${order.id}/events`, { key: KEYS.wallet, body: { type } });
  return { ...ctx, order, token, asMerchant, asIntegrator };
}

describe("merchant SEP-10 auth", () => {
  it("issues a merchant JWT whose subject is the Stellar account", async () => {
    const { merchantLogin, merchantKp } = setup();
    const res = await merchantLogin();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ account: merchantKp.publicKey(), merchantId: "mer_andes" });
    expect(decodeJwt(body.token)).toMatchObject({ sub: merchantKp.publicKey(), role: "merchant" });
  });

  it("rejects invalid accounts, unknown merchants, wrong signers and missing transactions", async () => {
    const { app, merchantLogin } = setup();
    expect((await app.request("/v1/merchants/auth/challenge?account=nope")).status).toBe(400);
    const unknown = await merchantLogin(Keypair.random());
    expect(unknown.status).toBe(403);
    expect((await unknown.json()).error.code).toBe("unknown_merchant");
    const kp = Keypair.random();
    expect((await merchantLogin(undefined, kp)).status).toBe(401);
    const missing = await app.request("/v1/merchants/auth/token", { method: "POST", body: JSON.stringify({}) });
    expect(missing.status).toBe(400);
  });

  it("keeps merchant and integrator credentials separate", async () => {
    const ctx = setup();
    const { token } = await (await ctx.merchantLogin()).json();
    expect((await ctx.call("/v1/balance", { token })).status).toBe(401);
    expect((await ctx.call("/v1/merchants/me/orders", { key: KEYS.wallet })).status).toBe(401);
  });
});

describe("buy lifecycle simulation", () => {
  it("runs created -> escrow_locked -> fiat_sent -> released with the right actors", async () => {
    const { asMerchant, asIntegrator } = await withOrder();
    const locked = await (await asMerchant("escrow_locked")).json();
    expect(locked.order).toMatchObject({ status: "escrow_locked", escrowId: expect.stringMatching(/^sim_/) });
    expect((await (await asIntegrator("fiat_sent")).json()).order.status).toBe("fiat_sent");
    expect((await (await asMerchant("released")).json()).order.status).toBe("released");
  });

  it("forbids the wrong actor and invalid transitions", async () => {
    const { asMerchant, asIntegrator } = await withOrder();
    const wrongActor = await asIntegrator("escrow_locked");
    expect(wrongActor.status).toBe(403);
    expect((await wrongActor.json()).error.code).toBe("forbidden_actor");
    const skip = await asMerchant("released");
    expect(skip.status).toBe(409);
    expect((await skip.json()).error.code).toBe("invalid_transition");
  });

  it("treats a repeated transition as an idempotent retry", async () => {
    const { asMerchant } = await withOrder();
    const first = await (await asMerchant("escrow_locked")).json();
    const retry = await asMerchant("escrow_locked");
    expect(retry.status).toBe(200);
    expect((await retry.json()).order).toEqual(first.order);
  });

  it("debits the integrator fee and credits a 7-day locked merchant reward on release", async () => {
    const { call, clock, token, asMerchant, asIntegrator } = await withOrder();
    await asMerchant("escrow_locked");
    await asIntegrator("fiat_sent");
    await asMerchant("released");

    const balance = await (await call("/v1/balance", { key: KEYS.wallet })).json();
    expect(balance).toMatchObject({ balanceUsdc: 4999.7, reservedUsdc: 0, availableUsdc: 4999.7, feesPaidUsdc: 0.3, releasedOrders: 1 });

    const vault = await (await call("/v1/merchants/me/rewards", { token })).json();
    expect(vault.rewards).toEqual([
      expect.objectContaining({ amountUsdc: 1.5, releasedAt: new Date(T0).toISOString(), unlockAt: new Date(T0 + 7 * DAY).toISOString() }),
    ]);
    expect(vault).toMatchObject({ lockedUsdc: 1.5, unlockedUsdc: 0 });
    clock.now = T0 + 7 * DAY;
    expect(await (await call("/v1/merchants/me/rewards", { token })).json()).toMatchObject({ lockedUsdc: 0, unlockedUsdc: 1.5 });
  });

  it("reserves the fee of open orders without debiting it", async () => {
    const { call } = await withOrder();
    const balance = await (await call("/v1/balance", { key: KEYS.wallet })).json();
    expect(balance).toMatchObject({ balanceUsdc: 5000, reservedUsdc: 0.3, availableUsdc: 4999.7, feesPaidUsdc: 0 });
  });
});

describe("sell lifecycle simulation", () => {
  it("lets the integrator lock and confirm and the merchant mark fiat sent", async () => {
    const { asMerchant, asIntegrator } = await withOrder(sellBo);
    expect((await asMerchant("escrow_locked")).status).toBe(403);
    expect((await asIntegrator("escrow_locked")).status).toBe(200);
    expect((await asIntegrator("fiat_sent")).status).toBe(403);
    expect((await asMerchant("fiat_sent")).status).toBe(200);
    expect((await (await asIntegrator("released")).json()).order.status).toBe("released");
  });

  it("allows either party to dispute after fiat is sent but not to resolve the dispute", async () => {
    const { asMerchant, asIntegrator } = await withOrder(sellBo);
    await asIntegrator("escrow_locked");
    await asMerchant("fiat_sent");
    expect((await (await asMerchant("disputed")).json()).order.status).toBe("disputed");
    expect((await asIntegrator("released")).status).toBe(403);
  });
});

describe("cancellation and scoping", () => {
  it("cancels before fiat is sent and refuses afterwards", async () => {
    const first = await withOrder();
    const cancelled = await first.call(`/v1/orders/${first.order.id}/cancel`, { key: KEYS.wallet, body: {} });
    expect((await cancelled.json()).order.status).toBe("cancelled");

    const second = await withOrder();
    await second.asMerchant("escrow_locked");
    await second.asIntegrator("fiat_sent");
    const late = await second.call(`/v1/orders/${second.order.id}/cancel`, { key: KEYS.wallet, body: {} });
    expect(late.status).toBe(409);
    expect((await late.json()).error.code).toBe("invalid_transition");
  });

  it("hides orders from other integrators and other merchants", async () => {
    const ctx = setup();
    const { order, token } = await withOrder({ ...buyBo, country: "BR", rail: "pix" }, ctx);
    expect((await ctx.call(`/v1/orders/${order.id}/events`, { token, body: { type: "escrow_locked" } })).status).toBe(404);
    expect((await ctx.call(`/v1/orders/${order.id}/cancel`, { key: KEYS.payments, body: {} })).status).toBe(404);
    expect((await (await ctx.call("/v1/merchants/me/orders", { token })).json()).orders).toEqual([]);
  });

  it("shows merchants their orders with the reward but never the Kalea fee", async () => {
    const { call, token } = await withOrder();
    const { orders } = await (await call("/v1/merchants/me/orders", { token })).json();
    expect(orders[0]).toMatchObject({ status: "created", usdcAmount: 100, merchantRewardUsdc: 1.5, escrowUsdc: 101.6 });
    expect(orders[0].integratorFeeUsdc).toBeUndefined();
    expect(orders[0].integratorId).toBeUndefined();
  });
});
