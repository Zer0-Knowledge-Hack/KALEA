import { useEffect, useMemo, useState } from "preact/hooks";
import type { Country, Rail, Side } from "@kalea/shared";
import type { Dictionary } from "../../i18n/en";
import { fill } from "../../i18n/format";
import { ApiRequestError, api, type DemoQuote, type QuoteRequest } from "../../lib/api";
import { LogoMark } from "../logo";
import { fallbackCorridors, formatFiat, formatNumber, localDemoQuote, type Corridor } from "../../lib/catalog";

interface Props {
  /** Localized widget strings, passed from the page (src/i18n). */
  t: Dictionary["quoteWidget"];
  /** Intl tag for number and currency formatting (en-US, es-419, pt-BR). */
  intl: string;
  /** Display names per locale; the API values (country codes, rail ids) never change. */
  countries: Record<Country, string>;
  rails: Record<Rail, string>;
}

/** Where the shown quote came from: the API's public demo endpoint, or local demo pricing. */
type Source = "live" | "demo";

/** Remounts on every value change so the CSS roll-in animation replays. */
function Rolling({ value }: { value: string }) {
  return <span class="relative inline-flex overflow-hidden"><span key={value} class="roll">{value}</span></span>;
}

/** Live quote from the public demo endpoint; falls back to local demo pricing when the API is unreachable or rate limited. */
async function fetchQuote(input: QuoteRequest): Promise<{ quote: DemoQuote; source: Source; rateLimited: boolean }> {
  try {
    const { quote } = await api.demo.quote(input);
    return { quote, source: "live", rateLimited: false };
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 400) throw e;
    const rateLimited = e instanceof ApiRequestError && e.status === 429;
    return { quote: localDemoQuote(input), source: "demo", rateLimited };
  }
}

const label = "font-mono text-[11px] uppercase tracking-[0.16em] text-muted";
const row = "block border-b border-line py-4 transition-colors focus-within:border-ocean";
/** Underline text tab: the selected option gets an Ocean rule, never a filled pill. */
const tab = (on: boolean) =>
  `-mb-px border-b-2 transition-colors ${on ? "border-ocean text-ink" : "border-transparent text-ink/70 hover:text-ink"}`;

/** Corridor quote demo: one all-in price for the end user, from the API's public demo endpoint. */
export default function QuoteWidget({ t, intl, countries, rails }: Props) {
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
    const timer = setTimeout(() => {
      fetchQuote({ country: corridor.country, side, rail: activeRail, amount: fiatAmount, amountIn: "fiat" })
        .then((r) => { if (!cancelled) { setQuote(r.quote); setSource(r.source); setNotice(r.rateLimited ? t.rateLimited : null); setError(null); } })
        .catch((e) => { if (!cancelled) { setQuote(null); setError(e instanceof Error ? e.message : t.unavailable); } });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [corridor, side, activeRail, fiatAmount, valid, t]);

  const currency = corridor?.currency ?? "USD";
  const decimals = corridor?.fiatDecimals ?? 2;
  const shown = quote && quote.country === corridor?.country ? quote : null;

  // White-label look: neutral surfaces, hairline rows and an Ocean selection rule, so integrators can re-theme it.
  // Kalea's only mark inside the widget is the "Powered by Kalea" footer in the muted text color.
  return (
    <div class="cut-tr bg-white text-ink [--cut:22px]">
      <div role="group" aria-label={t.direction} class="flex gap-8 border-b border-line px-6 pt-5 sm:px-8">
        {(["buy", "sell"] as Side[]).map((s) => (
          <button key={s} type="button" onClick={() => setSide(s)} aria-pressed={side === s} class={`${tab(side === s)} pb-3.5 text-[15px] font-semibold`}>
            {s === "buy" ? t.buy : t.sell}
          </button>
        ))}
      </div>

      <div class="px-6 sm:px-8">
        <label class={`${row} grid grid-cols-[5rem_minmax(0,1fr)] sm:grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-4`}>
          <span class={label}>{t.country}</span>
          <select value={corridor?.country} onChange={(e) => setCountry(e.currentTarget.value as Country)}
            class="w-full min-w-0 cursor-pointer bg-transparent text-base font-semibold outline-none">
            {corridors.map((c) => <option key={c.country} value={c.country}>{countries[c.country]} · {c.currency}</option>)}
          </select>
        </label>

        <label class={row}>
          <span class={label}>{side === "buy" ? t.pays : t.receives}</span>
          <span class="mt-1 flex items-baseline gap-3">
            <input inputMode="decimal" value={amount} onInput={(e) => setAmount(e.currentTarget.value.replace(",", ".").replace(/[^\d.]/g, ""))}
              class="w-full min-w-0 bg-transparent font-display text-4xl font-bold tabular-nums outline-none" aria-label={fill(t.amountIn, { currency })} />
            <span class="font-mono text-sm text-muted">{currency}</span>
          </span>
        </label>

        <div class="border-b border-line py-4">
          <span class={label}>{side === "buy" ? t.receives : t.sends}</span>
          <div class="mt-1 flex items-baseline justify-between gap-3 font-display text-4xl font-bold tabular-nums">
            <Rolling value={shown ? formatNumber(shown.usdcAmount, 2, intl) : "—"} />
            <span class="font-mono text-sm font-normal text-muted">USDC</span>
          </div>
        </div>

        <div role="group" aria-label={t.rail} class="grid grid-cols-[5rem_minmax(0,1fr)] sm:grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-4 border-b border-line pt-4">
          <span class={`${label} pb-3`}>{t.rail}</span>
          <div class="flex flex-wrap gap-x-6">
            {corridor?.rails.map((r) => (
              <button key={r} type="button" onClick={() => setRail(r)} aria-pressed={activeRail === r}
                class={`${tab(activeRail === r)} whitespace-nowrap pb-3 text-sm font-semibold`}>{rails[r]}</button>
            ))}
          </div>
        </div>

        <dl class="space-y-2 py-5 text-sm">
          <div class="flex justify-between gap-3"><dt class="text-ink/70">{t.rate}</dt>
            <dd class="whitespace-nowrap font-mono tabular-nums">{shown ? `1 USDC = ${formatFiat(shown.rate, currency, Math.max(decimals, 2), intl)}` : "—"}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-ink/70">{side === "buy" ? t.fiatPaid : t.fiatReceived}</dt>
            <dd class="whitespace-nowrap font-mono tabular-nums">{shown ? formatFiat(shown.fiatAmount, currency, decimals, intl) : "—"}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-ink/70">{t.fee}</dt><dd class="font-mono text-ocean">{t.none}</dd></div>
        </dl>
        {!valid && <p class="pb-4 text-sm text-error">{t.invalid}</p>}
        {valid && error && <p role="alert" class="border-l-2 border-error pb-1 pl-3 text-sm text-error">{error}</p>}
        {valid && !error && notice && <p class="border-l-2 border-line pl-3 text-sm text-ink/70">{notice}</p>}

        <p class={`${label} pb-5 pt-3 text-[10px]`}>{source === "live" ? t.sourceLive : t.sourceDemo}</p>
      </div>

      <p class="flex items-center gap-1.5 border-t border-line px-6 py-3.5 text-xs text-muted sm:px-8">
        {t.poweredBy} <LogoMark size={14} tone="mono" /> <span class="font-semibold">Kalea</span>
      </p>
    </div>
  );
}
