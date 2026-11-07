import { describe, expect, it } from "vitest";
import { DEMO_OFFERS, DEMO_OPERATORS, rankQuotes, toUsdc } from "./index";

describe("toUsdc", () => {
  it("convierte BOB a USDC truncando a 2 decimales", () => {
    expect(toUsdc(1000, 9.62)).toBe(103.95);
    expect(toUsdc(100, 3)).toBe(33.33);
  });
});

describe("rankQuotes", () => {
  const rank = (side: "buy" | "sell", amountBob: number, method: "qr_simple" | "bank_transfer") =>
    rankQuotes(DEMO_OFFERS, DEMO_OPERATORS, { side, amountBob, method });

  it("en compra ordena primero la oferta que entrega más USDC", () => {
    const quotes = rank("buy", 1000, "qr_simple");
    expect(quotes.map((q) => q.offer.id)).toEqual(["of_2", "of_1"]);
    expect(quotes[0].amountUsdc).toBeGreaterThan(quotes[1].amountUsdc);
  });

  it("en venta ordena primero la oferta que pide menos USDC", () => {
    const quotes = rank("sell", 1000, "qr_simple");
    expect(quotes[0].amountUsdc).toBeLessThanOrEqual(quotes[1].amountUsdc);
  });

  it("filtra por método de pago", () => {
    expect(rank("buy", 1000, "bank_transfer").every((q) => q.offer.methods.includes("bank_transfer"))).toBe(true);
  });

  it("respeta los límites mínimos y máximos de cada oferta", () => {
    expect(rank("buy", 10, "qr_simple")).toEqual([]);
    expect(rank("buy", 10_000, "qr_simple").map((q) => q.offer.id)).toEqual(["of_1"]);
  });

  it("adjunta el operador y una expiración futura", () => {
    const [q] = rank("buy", 1000, "qr_simple");
    expect(q.operator.id).toBe(q.offer.operatorId);
    expect(Date.parse(q.expiresAt)).toBeGreaterThan(Date.now());
  });
});
