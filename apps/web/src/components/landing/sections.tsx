"use client";

import { AnimatePresence, animate, motion, useInView, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { COUNTRIES, COUNTRY_CATALOG, DEFAULT_MERCHANT_REWARD_BPS } from "@kalea/shared";
import { COUNTRY_NAMES, DEMO_COUNTRIES, RAIL_NAMES } from "@/lib/catalog";
import { QuoteWidget } from "./quote-widget";

const eyebrow = "font-mono text-[11px] uppercase tracking-[0.18em] text-lime";
const REPO = "https://github.com/Zer0-Knowledge-Hack/KALEA";
const rewardPct = DEFAULT_MERCHANT_REWARD_BPS / 100;

/* Ticker — CSS marquee */
const ticks = ["One API", "8 LATAM countries", "Pix · SPEI · Yape · QR Simple", "Escrow-first orders", "USDC on Stellar", "One all-in price", "Prefunded integrator balance", "Soroban escrow"];
export function Ticker() {
  const row = [...ticks, ...ticks];
  return (
    <div className="overflow-hidden border-y border-line bg-ink-2 py-3">
      <div className="marquee flex w-max gap-10 whitespace-nowrap font-mono text-xs uppercase tracking-[0.16em] text-soft">
        {row.map((t, i) => <span key={i} className="flex items-center gap-10">{t}<span className="text-lime">✦</span></span>)}
      </div>
    </div>
  );
}

/* Quote demo — slide in from sides */
export function QuoteSection() {
  return (
    <section id="quote" className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-28 sm:px-6 lg:grid-cols-2">
      <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.7 }}>
        <p className={eyebrow}>Corridor quote demo</p>
        <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">One price.<br /><span className="text-soft">The exact amount, every time.</span></h2>
        <p className="mt-5 max-w-md text-soft">Your product asks for a quote by country, side and rail. Kalea answers with one all-in rate and fixed amounts for your end user. Matching a merchant happens behind the API.</p>
        <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-line pt-6">
          {[["5 min", "quote validity"], ["1", "all-in rate"], ["0", "Kalea fees to end users"]].map(([v, l]) => (
            <div key={l}><dt className="text-2xl font-bold">{v}</dt><dd className="font-mono text-[11px] uppercase tracking-wider text-mute">{l}</dd></div>
          ))}
        </dl>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 40, rotate: 2 }} whileInView={{ opacity: 1, y: 0, rotate: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
        <QuoteWidget />
      </motion.div>
    </section>
  );
}

/* How it works — scroll-linked progress rail */
const steps = [
  ["Quote", "Your backend requests a quote for a country, side (on-ramp or off-ramp), rail and amount. Your end user sees one all-in price."],
  ["Match and lock", "You create the order and Kalea matches it with a merchant. The USDC side is locked in a per-order Soroban escrow with fixed amounts before any fiat moves."],
  ["Fiat moves locally", "The end user and the merchant exchange local fiat over Pix, SPEI, Yape, QR Simple or a bank transfer, under the merchant's own accounts. Kalea never holds local fiat."],
  ["Release", "Once the fiat recipient confirms, the escrow releases USDC, credits the merchant reward and the insurance fund, and Kalea debits your fee from your prefunded balance."],
];
export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 50%"] });
  const h = useSpring(useTransform(scrollYProgress, [0, 1], ["0%", "100%"]), { stiffness: 120, damping: 30 });
  return (
    <section id="how-it-works" className="border-t border-line bg-ink-2/40">
      <div className="mx-auto max-w-6xl px-4 py-28 sm:px-6">
        <p className={eyebrow}>How it works</p>
        <h2 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">Escrow-first. Fiat stays local. Kalea settles only USDC.</h2>
        <div ref={ref} className="relative mt-16 pl-10 sm:pl-14">
          <div className="absolute left-3 top-0 h-full w-px bg-line sm:left-5" />
          <motion.div style={{ height: h }} className="absolute left-3 top-0 w-px bg-lime shadow-[0_0_12px_#c8f23a] sm:left-5" />
          <ol className="space-y-14">
            {steps.map(([t, d], i) => (
              <motion.li key={t} initial={{ opacity: 0.15 }} whileInView={{ opacity: 1 }} viewport={{ amount: 0.8 }} transition={{ duration: 0.4 }} className="relative">
                <span className="absolute -left-10 top-1 grid size-7 place-items-center rounded-full border border-lime bg-ink font-mono text-[11px] text-lime sm:-left-14">{i + 1}</span>
                <h3 className="text-2xl font-semibold">{t}</h3>
                <p className="mt-2 max-w-xl text-soft">{d}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* Coverage — country grid from the shared catalog */
export function Coverage() {
  return (
    <section id="coverage" className="mx-auto max-w-6xl px-4 py-28 sm:px-6">
      <p className={eyebrow}>LATAM coverage</p>
      <h2 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">Local rails, one integration.</h2>
      <p className="mt-5 max-w-xl text-soft">Each country has its own currency, rails and pricing. Corridors marked as demo have pricing on testnet today; the rest are next in line.</p>
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COUNTRIES.map((c, i) => {
          const live = DEMO_COUNTRIES.includes(c);
          return (
            <motion.div key={c} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.4 }}
              className="rounded-3xl border border-line p-6 transition-colors hover:border-lime/40">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-lime">{COUNTRY_CATALOG[c].currency}</span>
                <span className={live ? "text-lime" : "text-mute"}>{live ? "Demo corridor" : "Planned"}</span>
              </div>
              <h3 className="mt-6 text-xl font-semibold">{COUNTRY_NAMES[c]}</h3>
              <p className="mt-2 text-sm text-soft">{COUNTRY_CATALOG[c].rails.map((r) => RAIL_NAMES[r]).join(" · ")}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

/* Pricing — count-up numbers */
function CountUp({ to, decimals = 0, suffix = "" }: { to: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (x) => `${x.toFixed(decimals)}${suffix}`);
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, to, { duration: 1.6, ease: "easeOut" });
    return () => c.stop();
  }, [inView, to, mv]);
  return <motion.span ref={ref}>{text}</motion.span>;
}
export function Pricing() {
  const rows: [string, string, string][] = [
    ["End user", "One all-in price", "No Kalea fee line"],
    ["Integrator", "Per-transaction fee", "Debited from a prefunded USDC balance"],
    ["Merchant", `Earns ${rewardPct}% per order`, "Locked in 7-day cycles"],
    ["Insurance fund", "About 0.1% per order", "Funded from the spread"],
  ];
  return (
    <section id="pricing" className="border-y border-line bg-ink-2/40">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-28 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <p className={eyebrow}>Pricing</p>
          <h2 className="mt-4 text-4xl font-bold tracking-tight">Only integrators pay Kalea.</h2>
          <p className="mt-5 text-soft">Prices are set per country and side over a market reference rate. The spread funds the merchant reward and the insurance fund. You can add your own markup on top.</p>
          <div className="mt-10 grid grid-cols-2 gap-6">
            <div><p className="text-5xl font-bold text-lime"><CountUp to={rewardPct} decimals={1} suffix="%" /></p><p className="mt-1 text-sm text-soft">merchant reward per order</p></div>
            <div><p className="text-5xl font-bold text-coral"><CountUp to={7} /></p><p className="mt-1 text-sm text-soft">day reward lock cycle</p></div>
          </div>
        </div>
        <div className="overflow-hidden rounded-3xl border border-line">
          <div className="grid grid-cols-3 gap-2 bg-ink-3 px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-mute sm:px-5"><span>Who</span><span>What</span><span className="text-lime">How</span></div>
          {rows.map(([l, a, b], i) => (
            <motion.div key={l} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 * i }}
              className="grid grid-cols-3 items-center gap-2 border-t border-line px-4 py-4 text-xs sm:px-5 sm:text-sm">
              <span className="text-soft">{l}</span><span className="font-semibold">{a}</span><span className="text-soft">{b}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Merchants — cursor spotlight cards */
const pillars = [
  ["Your accounts, your fiat", "You receive and send local fiat through your own bank, wallet or QR accounts. Kalea never holds local fiat."],
  [`${rewardPct}% on every order`, "Each released order credits a reward to your vault, shown on the receipt as a separate line next to the exact order amounts."],
  ["7-day reward cycles", "Rewards unlock after a 7-day cycle, which protects every party against fraud and rewards steady liquidity."],
  ["Escrow before fiat", "USDC is held by the order's escrow contract under its rules before anyone sends fiat, and released only on confirmation or refunded on timeout."],
];
function Spotlight({ t, d, i }: { t: string; d: string; i: number }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.94 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.5 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
      }}
      className="rounded-3xl border border-line bg-[radial-gradient(320px_circle_at_var(--x,-999px)_var(--y,-999px),rgba(200,242,58,.12),transparent_60%)] p-6 transition-colors hover:border-lime/40 sm:p-7">
      <span className="font-mono text-xs text-lime">0{i + 1}</span>
      <h3 className="mt-6 text-xl font-semibold">{t}</h3>
      <p className="mt-2 text-sm leading-relaxed text-soft">{d}</p>
    </motion.div>
  );
}
export function Merchants() {
  return (
    <section id="merchants" className="mx-auto max-w-6xl px-4 py-28 sm:px-6">
      <p className={eyebrow}>For merchants / liquidity providers</p>
      <h2 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">Provide liquidity. Earn on every order.</h2>
      <div className="mt-14 grid gap-4 sm:grid-cols-2">{pillars.map(([t, d], i) => <Spotlight key={t} t={t} d={d} i={i} />)}</div>
      <a href="/app" className="mt-10 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-soft hover:text-lime">Merchant dashboard →</a>
    </section>
  );
}

/* FAQ — height accordion */
const faqs = [
  ["Who is Kalea for?", "Businesses that want local on-ramps, off-ramps or QR payments in their product: wallets, payment collection, SaaS platforms and others. Kalea does not serve consumers directly."],
  ["Does Kalea hold my users' money?", "Kalea never holds local fiat; it moves between the end user and the merchant. USDC is held by a per-order Soroban escrow contract under its rules until the order is released, refunded or resolved."],
  ["How does Kalea charge?", "Only integrators pay Kalea: a per-transaction fee debited from a prefunded USDC balance. End users see one all-in price, and merchants never pay Kalea."],
  ["What happens if a party does not deliver?", "The escrow does not release without confirmation. Timeouts refund the locked USDC, and disputes freeze the escrow until they are resolved with the recorded evidence."],
  ["Can I accept QR payments?", "Yes. A QR payment is an off-ramp variant: the end user locks USDC and a merchant pays the third-party QR in local currency."],
];
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="border-t border-line">
      <div className="mx-auto max-w-3xl px-4 py-28 sm:px-6">
        <p className={eyebrow}>FAQ</p>
        <h2 className="mt-4 text-4xl font-bold tracking-tight">Frequently asked questions</h2>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {faqs.map(([q, a], i) => (
            <div key={q}>
              <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center justify-between py-5 text-left text-lg font-medium">
                {q}
                <motion.span animate={{ rotate: open === i ? 45 : 0 }} className="text-2xl text-lime">+</motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                    <p className="pb-5 text-soft">{a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* CTA — magnetic button */
export function Cta() {
  const x = useMotionValue(0), y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 15 }), sy = useSpring(y, { stiffness: 200, damping: 15 });
  return (
    <section id="contact" className="px-4 pb-28 sm:px-6">
      <div className="grain relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-lime px-6 py-20 text-center text-lime-ink">
        <h2 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">Add LATAM ramps to your product with one API.</h2>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <motion.a href={`${REPO}/issues`} style={{ x: sx, y: sy }}
            onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); x.set((e.clientX - r.left - r.width / 2) * 0.35); y.set((e.clientY - r.top - r.height / 2) * 0.35); }}
            onMouseLeave={() => { x.set(0); y.set(0); }}
            className="inline-block rounded-full bg-ink px-8 py-4 font-semibold text-paper">
            Talk to us →
          </motion.a>
          <a href={`${REPO}/tree/main/docs`} className="inline-block rounded-full border border-lime-ink/30 px-8 py-4 font-semibold">Read the docs</a>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 font-mono text-[11px] uppercase tracking-wider text-mute sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>© 2026 Kalea · Zer0 Knowledge Hack</span>
        <span>Built on Stellar · Testnet</span>
        <a href={REPO} className="hover:text-lime">GitHub</a>
      </div>
    </footer>
  );
}
