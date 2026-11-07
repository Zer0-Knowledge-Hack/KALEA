import { describe, expect, it } from "vitest";
import { aggregateRates, median, priceVerdict, spreadVsReference, topOfBook, type RateSample, type ReferenceRate } from "./pricing";
import { DEMO_OFFERS, DEMO_OPERATORS, rankQuotes } from "./index";

const at = "2026-11-07T12:00:00.000Z";
const sample = (source: string, buy: number, sell: number, depth = 10, fetchedAt = at): RateSample => ({ source, buy, sell, depth, fetchedAt });
const ref = (buy: number, sell: number): ReferenceRate => ({ buy, sell, mid: (buy + sell) / 2, sources: ["t"], updatedAt: at, stale: false });

describe("median / topOfBook", () => {
  it("calcula la mediana con cantidad par e impar", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("usa las mejores ofertas de cada lado e ignora un anuncio atípico", () => {
    expect(topOfBook([11.97, 11.96, 15, 11.98, 11.97, 11.99], "buy", 5)).toBe(11.97);
    expect(topOfBook([12.2, 11.92, 11.92, 11.94, 11.91, 9], "sell", 5)).toBe(11.92);
  });

  it("descarta precios inválidos", () => {
    expect(topOfBook([0, NaN, 12], "buy")).toBe(12);
  });
});

describe("aggregateRates", () => {
  it("pondera por profundidad de cada fuente", () => {
    const r = aggregateRates([sample("a", 12, 11.9, 9), sample("b", 13, 12.9, 1)], new Date(at))!;
    expect(r.buy).toBe(12.1);
    expect(r.sell).toBe(12);
    expect(r.mid).toBe(12.05);
    expect(r.sources).toEqual(["a", "b"]);
  });

  it("ignora fuentes sin liquidez y devuelve null si no queda ninguna", () => {
    expect(aggregateRates([sample("a", 12, 11.9, 0)])).toBeNull();
    expect(aggregateRates([sample("a", 12, 11.9, 0), sample("b", 11, 10.9, 4)], new Date(at))!.sources).toEqual(["b"]);
  });

  it("marca la referencia como desactualizada según la muestra más vieja", () => {
    const old = "2026-11-07T11:00:00.000Z";
    const r = aggregateRates([sample("a", 12, 11.9, 5, old), sample("b", 12, 11.9)], new Date(at), 10 * 60_000)!;
    expect(r.stale).toBe(true);
    expect(r.updatedAt).toBe(old);
  });
});

describe("spread y veredicto", () => {
  const r = ref(12, 11.9);

  it("en compra, pagar más que el mercado es spread positivo", () => {
    expect(spreadVsReference("buy", 12.12, r)).toBe(0.01);
    expect(spreadVsReference("buy", 11.88, r)).toBe(-0.01);
  });

  it("en venta, recibir menos que el mercado es spread positivo", () => {
    expect(spreadVsReference("sell", 11.781, r)).toBe(0.01);
    expect(spreadVsReference("sell", 12.019, r)).toBe(-0.01);
  });

  it("clasifica mejor que mercado, justo y rechazado (caro o carnada)", () => {
    const policy = { maxPremium: 0.02, maxDiscount: 0.015 };
    expect(priceVerdict(-0.005, policy)).toBe("best");
    expect(priceVerdict(0, policy)).toBe("best");
    expect(priceVerdict(0.015, policy)).toBe("fair");
    expect(priceVerdict(0.021, policy)).toBe("rejected");
    expect(priceVerdict(-0.02, policy)).toBe("rejected");
  });
});

describe("rankQuotes con referencia", () => {
  const q = { side: "buy" as const, amountBob: 1000, method: "qr_simple" as const };

  it("adjunta spread y veredicto a cada cotización", () => {
    const quotes = rankQuotes(DEMO_OFFERS, DEMO_OPERATORS, q, { reference: ref(11.98, 11.92) });
    expect(quotes.length).toBeGreaterThan(0);
    quotes.forEach((x) => {
      expect(x.spread).toEqual(expect.any(Number));
      expect(x.verdict).not.toBe("rejected");
    });
  });

  it("oculta ofertas fuera de la banda de mercado", () => {
    expect(rankQuotes(DEMO_OFFERS, DEMO_OPERATORS, q, { reference: ref(11, 10.9) })).toEqual([]);
  });

  it("sin referencia no filtra ni agrega spread", () => {
    const quotes = rankQuotes(DEMO_OFFERS, DEMO_OPERATORS, q);
    expect(quotes.length).toBe(2);
    expect(quotes[0].spread).toBeUndefined();
  });
});
