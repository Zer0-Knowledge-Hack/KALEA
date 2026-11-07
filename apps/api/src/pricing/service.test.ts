import { describe, expect, it, vi } from "vitest";
import type { RateSample } from "@kalea/shared";
import { manualRate, type RateProvider } from "./providers";
import { createRateService } from "./service";

const fake = (name: string, impl: () => Promise<RateSample>): RateProvider & { calls: number } => {
  const p = { name, calls: 0, fetch: () => { p.calls++; return impl(); } };
  return p;
};
const ok = (name: string, buy: number, sell: number, depth = 5) => async (): Promise<RateSample> =>
  ({ source: name, buy, sell, depth, fetchedAt: new Date().toISOString() });

describe("createRateService", () => {
  it("combina proveedores y cachea durante el TTL", async () => {
    let t = 0;
    const a = fake("a", ok("a", 12, 11.9));
    const svc = createRateService([a, manualRate(12, 11.9)], { ttlMs: 1000, now: () => new Date(t) });
    expect((await svc.get())!.buy).toBe(12);
    t = 500;
    await svc.get();
    expect(a.calls).toBe(1);
    t = 1500;
    await svc.get();
    expect(a.calls).toBe(2);
  });

  it("agrupa pedidos concurrentes en una sola consulta", async () => {
    const a = fake("a", ok("a", 12, 11.9));
    const svc = createRateService([a]);
    await Promise.all([svc.get(), svc.get(), svc.get()]);
    expect(a.calls).toBe(1);
  });

  it("si una fuente falla usa su último valor bueno y reporta el error", async () => {
    let fail = false;
    const onError = vi.fn();
    let t = 0;
    const a = fake("a", async () => { if (fail) throw new Error("timeout"); return ok("a", 12, 11.9)(); });
    const svc = createRateService([a], { ttlMs: 0, onError, now: () => new Date(Date.now() + t) });
    await svc.get();
    fail = true;
    t = 1;
    const r = await svc.get();
    expect(r!.buy).toBe(12);
    expect(onError).toHaveBeenCalledWith("a", expect.any(Error));
  });

  it("devuelve null si ninguna fuente tiene liquidez", async () => {
    const svc = createRateService([fake("a", ok("a", 12, 11.9, 0))]);
    expect(await svc.get()).toBeNull();
  });
});
