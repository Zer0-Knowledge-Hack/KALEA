"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { Country, Rail, Side } from "@kalea/shared";
import { api, type DemoQuote, type DemoSource } from "@/lib/api";
import { COUNTRY_NAMES, RAIL_NAMES, fallbackCorridors, formatFiat, formatNumber, type Corridor } from "@/lib/catalog";

const sideLabel: Record<Side, string> = { buy: "On-ramp", sell: "Off-ramp" };

function Rolling({ value }: { value: string }) {
  return (
    <span className="relative inline-flex overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={value} initial={{ y: "-100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}>{value}</motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Corridor quote demo: one all-in price for the end user, proxied through /api/demo-quote. */
export function QuoteWidget() {
  const [corridors, setCorridors] = useState<Corridor[]>(fallbackCorridors);
  const [country, setCountry] = useState<Country>(corridors[0]?.country ?? "BO");
  const [side, setSide] = useState<Side>("buy");
  const [rail, setRail] = useState<Rail | null>(null);
  const [amount, setAmount] = useState("1000");
  const [quote, setQuote] = useState<DemoQuote | null>(null);
  const [source, setSource] = useState<DemoSource>("demo");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.demo.corridors().then((r) => { if (r.corridors.length) setCorridors(r.corridors); }).catch(() => {});
  }, []);

  const corridor = useMemo(() => corridors.find((c) => c.country === country) ?? corridors[0], [corridors, country]);
  const activeRail = rail && corridor?.rails.includes(rail) ? rail : corridor?.rails[0];
  const fiatAmount = Number(amount);
  const valid = Number.isFinite(fiatAmount) && fiatAmount > 0;

  useEffect(() => {
    if (!valid || !corridor || !activeRail) { setQuote(null); return; }
    const t = setTimeout(() => {
      api.demo.quote({ country: corridor.country, side, rail: activeRail, amount: fiatAmount, amountIn: "fiat" })
        .then((r) => { setQuote(r.quote); setSource(r.source); setError(null); })
        .catch((e) => { setQuote(null); setError(e instanceof Error ? e.message : "Quote unavailable"); });
    }, 250);
    return () => clearTimeout(t);
  }, [corridor, side, activeRail, fiatAmount, valid]);

  const currency = corridor?.currency ?? "USD";
  const decimals = corridor?.fiatDecimals ?? 2;
  const shown = quote && quote.country === corridor?.country ? quote : null;

  return (
    <div className="rounded-3xl border border-line bg-ink-2 p-2 shadow-[0_40px_120px_-40px_rgba(200,242,58,.25)]">
      <LayoutGroup id="side">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-ink p-1">
          {(["buy", "sell"] as Side[]).map((s) => (
            <button key={s} onClick={() => setSide(s)} className="relative rounded-xl py-2.5 text-sm font-semibold">
              {side === s && <motion.span layoutId="side-pill" className="absolute inset-0 rounded-xl bg-lime" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <span className={`relative ${side === s ? "text-lime-ink" : "text-soft"}`}>{sideLabel[s]}</span>
            </button>
          ))}
        </div>
      </LayoutGroup>

      <div className="space-y-3 p-4">
        <label className="block rounded-2xl border border-line bg-ink p-4 focus-within:border-lime/60">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Country</span>
          <select value={corridor?.country} onChange={(e) => setCountry(e.target.value as Country)}
            className="mt-1 w-full bg-transparent text-lg font-semibold outline-none [&>option]:bg-ink">
            {corridors.map((c) => <option key={c.country} value={c.country}>{COUNTRY_NAMES[c.country]} · {c.currency}</option>)}
          </select>
        </label>

        <label className="block rounded-2xl border border-line bg-ink p-4 focus-within:border-lime/60">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">{side === "buy" ? "End user pays" : "End user receives"}</span>
          <div className="mt-1 flex items-center gap-2">
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              className="w-full bg-transparent text-3xl font-bold outline-none" aria-label={`Amount in ${currency}`} />
            <span className="rounded-full bg-ink-3 px-3 py-1 font-mono text-xs">{currency}</span>
          </div>
        </label>

        <div className="rounded-2xl border border-line bg-ink p-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">{side === "buy" ? "End user receives" : "End user sends"}</span>
          <div className="mt-1 flex items-center justify-between text-3xl font-bold">
            <Rolling value={shown ? formatNumber(shown.usdcAmount) : "—"} />
            <span className="rounded-full bg-ink-3 px-3 py-1 font-mono text-xs font-normal">USDC</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {corridor?.rails.map((r) => (
            <button key={r} onClick={() => setRail(r)}
              className={`flex-1 rounded-xl border px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition ${activeRail === r ? "border-lime text-lime" : "border-line text-soft hover:border-mute"}`}>{RAIL_NAMES[r]}</button>
          ))}
        </div>

        <dl className="space-y-1.5 rounded-xl border border-line px-3 py-3 text-sm">
          <div className="flex justify-between"><dt className="text-soft">All-in rate</dt>
            <dd className="font-mono">{shown ? `1 USDC = ${formatFiat(shown.rate, currency, Math.max(decimals, 2))}` : "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-soft">{side === "buy" ? "Fiat paid" : "Fiat received"}</dt>
            <dd className="font-mono">{shown ? formatFiat(shown.fiatAmount, currency, decimals) : "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-soft">Kalea fee to end user</dt><dd className="font-mono text-lime">None</dd></div>
        </dl>
        {!valid && <p className="p-1 text-sm text-coral">Enter a valid amount.</p>}
        {valid && error && <p className="rounded-xl border border-dashed border-coral/50 p-3 text-sm text-coral">{error}</p>}

        <p className="text-center font-mono text-[10px] uppercase tracking-[0.14em] text-mute">
          {source === "live" ? "Live quote · testnet API" : "Demo pricing · illustrative values"}
        </p>
      </div>
    </div>
  );
}
