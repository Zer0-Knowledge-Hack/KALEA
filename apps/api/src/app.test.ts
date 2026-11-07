import { describe, expect, it } from "vitest";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { app } from "./app";

async function login(kp = Keypair.random(), signer = kp) {
  const res = await app.request(`/auth/challenge?account=${kp.publicKey()}`);
  const { transaction, networkPassphrase } = await res.json();
  const tx = TransactionBuilder.fromXDR(transaction, networkPassphrase);
  tx.sign(signer);
  return app.request("/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: tx.toXDR() }),
  });
}

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
});

describe("GET /health", () => {
  it("responde ok con la red", async () => {
    const res = await app.request("/health");
    expect(await res.json()).toEqual({ ok: true, network: "testnet" });
  });
});

describe("GET /quotes", () => {
  it("devuelve cotizaciones ordenadas", async () => {
    const res = await app.request("/quotes?side=buy&amountBob=1000&method=qr_simple");
    const { quotes } = await res.json();
    expect(res.status).toBe(200);
    expect(quotes[0].amountUsdc).toBeGreaterThanOrEqual(quotes[1].amountUsdc);
  });

  it("rechaza parámetros inválidos", async () => {
    expect((await app.request("/quotes?side=x&amountBob=-1&method=qr_simple")).status).toBe(400);
  });
});

describe("auth SEP-10", () => {
  it("rechaza una cuenta inválida", async () => {
    expect((await app.request("/auth/challenge?account=nope")).status).toBe(400);
  });

  it("emite un JWT cuando la wallet firma el reto", async () => {
    const kp = Keypair.random();
    const res = await login(kp);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.account).toBe(kp.publicKey());
    expect(body.token).toEqual(expect.any(String));
  });

  it("rechaza un reto firmado por otra llave", async () => {
    expect((await login(Keypair.random(), Keypair.random())).status).toBe(401);
  });

  it("rechaza un reto sin firmar", async () => {
    const res = await app.request("/auth/token", { method: "POST", body: JSON.stringify({}) });
    expect(res.status).toBe(400);
  });
});

describe("órdenes", () => {
  it("exige token", async () => {
    expect((await app.request("/orders")).status).toBe(401);
    expect((await app.request("/orders", authed("basura"))).status).toBe(401);
  });

  it("crea, lista y aísla órdenes por usuario", async () => {
    const { token } = await (await login()).json();
    const created = await app.request("/orders", authed(token, {
      method: "POST",
      body: JSON.stringify({ offerId: "of_1", amountBob: 1000, method: "qr_simple" }),
    }));
    const { order } = await created.json();
    expect(created.status).toBe(201);
    expect(order).toMatchObject({ status: "awaiting_fiat", amountUsdc: 103.95, rate: 9.62 });

    const mine = await (await app.request("/orders", authed(token))).json();
    expect(mine.orders.map((o: { id: string }) => o.id)).toContain(order.id);

    const { token: other } = await (await login()).json();
    expect((await app.request(`/orders/${order.id}`, authed(other))).status).toBe(404);
    expect((await app.request(`/orders/${order.id}`, authed(token))).status).toBe(200);
  });

  it("devuelve 404 para una oferta inexistente", async () => {
    const { token } = await (await login()).json();
    const res = await app.request("/orders", authed(token, {
      method: "POST",
      body: JSON.stringify({ offerId: "of_x", amountBob: 1000, method: "qr_simple" }),
    }));
    expect(res.status).toBe(404);
  });
});
