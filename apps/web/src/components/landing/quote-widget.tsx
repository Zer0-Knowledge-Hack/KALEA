"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useState } from "react";
import { DEMO_OFFERS, DEMO_OPERATORS, rankQuotes, type PaymentMethod, type Quote, type ReferenceRate, type Side } from "@kalea/shared";
import { api } from "@/lib/api";
import { useWallet } from "@/lib/wallet";

const methods: [PaymentMethod, string][] = [["qr_simple", "QR Simple"], ["bank_transfer", "Transferencia"]];
const fmt = (n: number, d = 2) => n.toLocaleString("es-BO", { minimumFractionDigits: d, maximumFractionDigits: d });

function SpreadChip({ spread }: { spread?: number }) {
  if (spread === undefined) return null;
  const pct = Math.abs(spread * 100).toLocaleString("es-BO", { maximumFractionDigits: 2 });
  if (Math.abs(spread) < 0.0005) return <span className="font-mono text-[10px] text-mute">= mercado</span>;
  return spread < 0
    ? <span className="font-mono text-[10px] text-lime">{pct}% mejor que mercado</span>
    : <span className="font-mono text-[10px] text-mute">+{pct}% vs mercado</span>;
}

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

export function QuoteWidget() {
  const [side, setSide] = useState<Side>("buy");
  const [method, setMethod] = useState<PaymentMethod>("qr_simple");
  const [amount, setAmount] = useState("1000");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [live, setLive] = useState(false);
  const [reference, setReference] = useState<ReferenceRate | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { token, connect, account } = useWallet();

  const amountBob = Number(amount);
  const valid = Number.isFinite(amountBob) && amountBob > 0;

  useEffect(() => {
    if (!valid) { setQuotes([]); return; }
    const q = { side, amountBob, method };
    const t = setTimeout(() => {
      api.quotes(side, amountBob, method)
        .then((r) => { setQuotes(r.quotes); setReference(r.reference); setLive(true); })
        .catch(() => { setQuotes(rankQuotes(DEMO_OFFERS, DEMO_OPERATORS, q)); setReference(null); setLive(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [side, method, amountBob, valid]);

  useEffect(() => { setPicked(quotes[0]?.offer.id ?? null); }, [quotes]);
  const best = quotes.find((q) => q.offer.id === picked) ?? quotes[0];

  async function order() {
    setNotice(null);
    if (!account || !token) return connect();
    if (!best) return;
    try {
      const { order } = await api.createOrder(token, { offerId: best.offer.id, amountBob, method });
      setNotice(`Orden ${order.id.slice(0, 8)} creada · esperando pago en BOB`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "No se pudo crear la orden");
    }
  }

  return (
    <div className="rounded-3xl border border-line bg-ink-2 p-2 shadow-[0_40px_120px_-40px_rgba(200,242,58,.25)]">
      <LayoutGroup id="side">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-ink p-1">
          {(["buy", "sell"] as Side[]).map((s) => (
            <button key={s} onClick={() => setSide(s)} className="relative rounded-xl py-2.5 text-sm font-semibold">
              {side === s && <motion.span layoutId="side-pill" className="absolute inset-0 rounded-xl bg-lime" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <span className={`relative ${side === s ? "text-lime-ink" : "text-soft"}`}>{s === "buy" ? "Comprar USDC" : "Vender USDC"}</span>
            </button>
          ))}
        </div>
      </LayoutGroup>

      <div className="space-y-3 p-4">
        <label className="block rounded-2xl border border-line bg-ink p-4 focus-within:border-lime/60">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">{side === "buy" ? "Pagas" : "Recibes"}</span>
          <div className="mt-1 flex items-center gap-2">
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              className="w-full bg-transparent text-3xl font-bold outline-none" aria-label="Monto en bolivianos" />
            <span className="rounded-full bg-ink-3 px-3 py-1 font-mono text-xs">BOB</span>
          </div>
        </label>

        <div className="rounded-2xl border border-line bg-ink p-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">{side === "buy" ? "Recibes" : "Entregas"}</span>
          <div className="mt-1 flex items-center justify-between text-3xl font-bold">
            <Rolling value={best ? fmt(best.amountUsdc) : "—"} />
            <span className="rounded-full bg-ink-3 px-3 py-1 font-mono text-xs font-normal">USDC</span>
          </div>
        </div>

        <div className="flex gap-2">
          {methods.map(([m, t]) => (
            <button key={m} onClick={() => setMethod(m)}
              className={`flex-1 rounded-xl border px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition ${method === m ? "border-lime text-lime" : "border-line text-soft hover:border-mute"}`}>{t}</button>
          ))}
        </div>

        {reference && (
          <div className="flex items-center justify-between rounded-xl bg-ink px-3 py-2 font-mono text-[11px] text-mute">
            <span className="flex items-center gap-1.5">
              <span className={`size-1.5 rounded-full ${reference.stale ? "bg-coral" : "bg-lime"}`} />
              Mercado P2P {reference.stale && "(desactualizado)"}
            </span>
            <span className="text-paper">{fmt(side === "buy" ? reference.buy : reference.sell)} BOB/USDC</span>
          </div>
        )}

        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {quotes.map((q, i) => (
              <motion.li key={q.offer.id} layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                transition={{ type: "spring", stiffness: 400, damping: 34 }}>
                <button onClick={() => setPicked(q.offer.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition ${picked === q.offer.id ? "border-lime/70 bg-lime/5" : "border-line hover:border-mute"}`}>
                  <span>
                    <span className="font-semibold">{q.operator.alias}</span>
                    {i === 0 && <span className="ml-2 rounded bg-lime px-1.5 py-0.5 font-mono text-[10px] text-lime-ink">MEJOR</span>}
                    <span className="block font-mono text-[11px] text-mute">★ {q.operator.rating} · {q.operator.completedOrders} órdenes</span>
                  </span>
                  <span className="flex flex-col items-end gap-0.5">
                    <span className="font-mono text-xs text-soft">{fmt(q.offer.rate)} BOB</span>
                    <SpreadChip spread={q.spread} />
                  </span>
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
          {valid && quotes.length === 0 && <li className="rounded-xl border border-dashed border-coral/50 p-3 text-sm text-coral">Sin ofertas a precio de mercado para ese monto y método.</li>}
          {!valid && <li className="p-1 text-sm text-coral">Ingresa un monto válido.</li>}
        </ul>

        <button onClick={order} disabled={!best}
          className="w-full rounded-2xl bg-lime py-3.5 font-semibold text-lime-ink transition hover:brightness-110 disabled:opacity-40">
          {account ? "Crear orden" : "Conectar wallet para continuar"}
        </button>
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.14em] text-mute">
          {notice ?? (live ? "Ofertas en vivo · testnet" : "Ofertas de demostración")}
        </p>
      </div>
    </div>
  );
}
