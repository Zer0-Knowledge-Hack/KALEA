import { useEffect, useMemo, useState } from "preact/hooks";
import type { Country, Rail, Side } from "@kalea/shared";
import { ApiRequestError, api, type DemoQuote, type QuoteRequest } from "../../lib/api";
import { LogoMark } from "../logo";
import { COUNTRY_NAMES, RAIL_NAMES, fallbackCorridors, formatFiat, formatNumber, localDemoQuote, type Corridor } from "../../lib/catalog";

const sideLabel: Record<Side, string> = { buy: "On-ramp", sell: "Off-ramp" };

/** Where the shown quote came from: the API's public demo endpoint, or local demo pricing. */
type Source = "live" | "demo";

/** Remounts on every value change so the CSS roll-in animation replays. */
function Rolling({ value }: { value: string }) {
  return <span class="relative inline-flex overflow-hidden"><span key={value} class="roll">{value}</span></span>;
}

/** Live quote from the public demo endpoint; falls back to local demo pricing when the API is unreachable or rate limited. */
async function fetchQuote(input: QuoteRequest): Promise<{ quote: DemoQuote; source: Source; notice: string | null }> {
  try {
    const { quote } = await api.demo.quote(input);
    return { quote, source: "live", notice: null };
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 400) throw e;
    const notice = e instanceof ApiRequestError && e.status === 429 ? "Too many quotes in a short time, showing local demo pricing." : null;
    return { quote: localDemoQuote(input), source: "demo", notice };
  }
}

/** Corridor quote demo: one all-in price for the end user, from the API's public demo endpoint. */
export default function QuoteWidget() {
  const [corridors, setCorridors] = useState<Corridor[]>(fallbackCorridors);
  const [country, setCountry] = useState<Country>(corridors[0]?.country ?? "BO");
  const [side, setSide] = useState<Side>("buy");
  const [rail, setRail] = useState<Rail | null>(null);
  const [amount, setAmount] = useState("1000");
  const [quote, setQuote] = useState<DemoQuote | null>(null);
  const [source, setSource] = useState<Source>("demo");
  const [notice, setNotice] = useState<string | null>(null);
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
    let cancelled = false;
    const t = setTimeout(() => {
      fetchQuote({ country: corridor.country, side, rail: activeRail, amount: fiatAmount, amountIn: "fiat" })
        .then((r) => { if (!cancelled) { setQuote(r.quote); setSource(r.source); setNotice(r.notice); setError(null); } })
        .catch((e) => { if (!cancelled) { setQuote(null); setError(e instanceof Error ? e.message : "Quote unavailable"); } });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [corridor, side, activeRail, fiatAmount, valid]);

  const currency = corridor?.currency ?? "USD";
  const decimals = corridor?.fiatDecimals ?? 2;
  const shown = quote && quote.country === corridor?.country ? quote : null;

  // White-label look: neutral surfaces and an Ocean primary control, so integrators can re-theme it.
  // Kalea's only mark inside the widget is the "Powered by Kalea" footer in the muted text color.
  return (
    <div class="rounded-3xl border border-line bg-white p-2 text-ink shadow-[0_40px_120px_-40px_rgba(0,0,0,.6)]">
      <div class="relative grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1">
        <span aria-hidden="true"
          class={`absolute inset-y-1 left-1 w-[calc(50%-0.375rem)] rounded-xl bg-ocean transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${side === "sell" ? "translate-x-[calc(100%+0.25rem)]" : ""}`} />
        {(["buy", "sell"] as Side[]).map((s) => (
          <button key={s} type="button" onClick={() => setSide(s)} aria-pressed={side === s} class="relative rounded-xl py-2.5 text-sm font-semibold">
            <span class={`relative transition-colors ${side === s ? "text-white" : "text-ink/70"}`}>{sideLabel[s]}</span>
          </button>
        ))}
      </div>

      <div class="space-y-3 p-4">
        <label class="block rounded-2xl border border-line bg-white p-4 focus-within:border-ocean">
          <span class="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Country</span>
          <select value={corridor?.country} onChange={(e) => setCountry(e.currentTarget.value as Country)}
            class="mt-1 w-full bg-transparent text-lg font-semibold outline-none">
            {corridors.map((c) => <option key={c.country} value={c.country}>{COUNTRY_NAMES[c.country]} · {c.currency}</option>)}
          </select>
        </label>

        <label class="block rounded-2xl border border-line bg-white p-4 focus-within:border-ocean">
          <span class="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{side === "buy" ? "End user pays" : "End user receives"}</span>
          <div class="mt-1 flex items-center gap-2">
            <input inputMode="decimal" value={amount} onInput={(e) => setAmount(e.currentTarget.value.replace(/[^\d.]/g, ""))}
              class="w-full min-w-0 bg-transparent text-3xl font-bold tabular-nums outline-none" aria-label={`Amount in ${currency}`} />
            <span class="rounded-full bg-surface px-3 py-1 font-mono text-xs">{currency}</span>
          </div>
        </label>

        <div class="rounded-2xl border border-line bg-white p-4">
          <span class="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{side === "buy" ? "End user receives" : "End user sends"}</span>
          <div class="mt-1 flex items-center justify-between text-3xl font-bold tabular-nums">
            <Rolling value={shown ? formatNumber(shown.usdcAmount) : "—"} />
            <span class="rounded-full bg-surface px-3 py-1 font-mono text-xs font-normal">USDC</span>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          {corridor?.rails.map((r) => (
            <button key={r} type="button" onClick={() => setRail(r)} aria-pressed={activeRail === r}
              class={`flex-1 rounded-xl border px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition ${activeRail === r ? "border-ocean bg-ocean-100 text-ocean" : "border-line text-ink/70 hover:border-muted"}`}>{RAIL_NAMES[r]}</button>
          ))}
        </div>

        <dl class="space-y-1.5 rounded-xl border border-line px-3 py-3 text-sm">
          <div class="flex justify-between gap-3"><dt class="text-ink/70">All-in rate</dt>
            <dd class="font-mono tabular-nums">{shown ? `1 USDC = ${formatFiat(shown.rate, currency, Math.max(decimals, 2))}` : "—"}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-ink/70">{side === "buy" ? "Fiat paid" : "Fiat received"}</dt>
            <dd class="font-mono tabular-nums">{shown ? formatFiat(shown.fiatAmount, currency, decimals) : "—"}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-ink/70">Kalea fee to end user</dt><dd class="font-mono text-ocean">None</dd></div>
        </dl>
        {!valid && <p class="p-1 text-sm text-error">Enter a valid amount.</p>}
        {valid && error && <p role="alert" class="rounded-xl border border-dashed border-error/50 p-3 text-sm text-error">{error}</p>}
        {valid && !error && notice && <p class="rounded-xl border border-dashed border-line p-3 text-sm text-ink/70">{notice}</p>}

        <p class="text-center font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          {source === "live" ? "Live quote · testnet demo API" : "Demo pricing · illustrative values"}
        </p>
      </div>

      <p class="flex items-center justify-center gap-1.5 border-t border-line px-4 py-3 text-xs text-muted">
        Powered by <LogoMark size={14} tone="mono" /> <span class="font-semibold">Kalea</span>
      </p>
    </div>
  );
}
