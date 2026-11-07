"use client";

import { AnimatePresence, animate, motion, useInView, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { QuoteWidget } from "./quote-widget";

const eyebrow = "font-mono text-[11px] uppercase tracking-[0.18em] text-lime";

/* Rate ticker — CSS marquee */
const ticks = ["USDC/BOB 9.62", "QR Simple", "Liquidación ~5 s", "Escrow Soroban", "Sin custodia", "Comisión transparente", "Operadores verificados", "Stellar"];
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

/* Quote section — slide in from sides */
export function QuoteSection() {
  return (
    <section id="cotizar" className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-28 sm:px-6 lg:grid-cols-2">
      <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.7 }}>
        <p className={eyebrow}>Cotizador</p>
        <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Todas las ofertas.<br /><span className="text-soft">Ordenadas por lo que recibes.</span></h2>
        <p className="mt-5 max-w-md text-soft">Kalea agrega las ofertas de operadores P2P y te muestra primero la que más te conviene para tu monto y tu método de pago. Sin buscar en grupos de WhatsApp.</p>
        <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-line pt-6">
          {[["5 min", "cotización fija"], ["0", "custodia"], ["2", "métodos locales"]].map(([v, l]) => (
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
  ["Cotiza", "Ingresa el monto en BOB y elige QR Simple o transferencia. Ves al instante cuánto USDC recibes con cada operador."],
  ["Bloquea en escrow", "El operador deposita USDC en un contrato Soroban. Nadie puede moverlo hasta que se cumpla la orden."],
  ["Paga en bolivianos", "Escaneas el QR o transfieres desde tu banco. Marcas el pago como enviado con tu comprobante."],
  ["Recibe en tu wallet", "El operador confirma, el escrow libera y el USDC llega a tu cuenta Stellar en segundos."],
];
export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 50%"] });
  const h = useSpring(useTransform(scrollYProgress, [0, 1], ["0%", "100%"]), { stiffness: 120, damping: 30 });
  return (
    <section id="como-funciona" className="border-t border-line bg-ink-2/40">
      <div className="mx-auto max-w-6xl px-4 py-28 sm:px-6">
        <p className={eyebrow}>Cómo funciona</p>
        <h2 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">Cuatro pasos. Una sola acción por pantalla.</h2>
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

/* Security — cursor spotlight cards */
const pillars = [
  ["Escrow on-chain", "Los fondos quedan en un contrato Soroban auditable. Ni Kalea ni el operador pueden retirarlos sin cumplir la orden."],
  ["Sin custodia", "Inicias sesión firmando con tu wallet (SEP-10). Nunca pedimos tu frase semilla ni guardamos tus llaves."],
  ["Operadores con reputación", "Cada operador muestra órdenes completadas, tiempo de respuesta y calificación verificable."],
  ["Disputas con evidencia", "Comprobantes y eventos de la orden quedan registrados para resolver cualquier conflicto."],
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
export function Security() {
  return (
    <section id="seguridad" className="mx-auto max-w-6xl px-4 py-28 sm:px-6">
      <p className={eyebrow}>Seguridad</p>
      <h2 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">Confianza que no depende de confiar.</h2>
      <div className="mt-14 grid gap-4 sm:grid-cols-2">{pillars.map(([t, d], i) => <Spotlight key={t} t={t} d={d} i={i} />)}</div>
    </section>
  );
}

/* Comparison — count-up numbers */
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (x) => `${Math.round(x)}${suffix}`);
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, to, { duration: 1.6, ease: "easeOut" });
    return () => c.stop();
  }, [inView, to, mv]);
  return <motion.span ref={ref}>{text}</motion.span>;
}
export function Comparison() {
  const rows: [string, string, string][] = [["Tiempo para encontrar oferta", "30+ min", "< 1 min"], ["Ofertas comparadas", "1–2", "Todas"], ["Riesgo de contraparte", "Alto", "Escrow"], ["Liquidación USDC", "Variable", "~5 s"]];
  return (
    <section className="border-y border-line bg-ink-2/40">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-28 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <p className={eyebrow}>El problema</p>
          <h2 className="mt-4 text-4xl font-bold tracking-tight">Cambiar USDC en Bolivia hoy es lento y opaco.</h2>
          <div className="mt-10 grid grid-cols-2 gap-6">
            <div><p className="text-5xl font-bold text-lime"><CountUp to={95} suffix="%" /></p><p className="mt-1 text-sm text-soft">menos tiempo buscando ofertas</p></div>
            <div><p className="text-5xl font-bold text-coral"><CountUp to={0} /></p><p className="mt-1 text-sm text-soft">llaves en nuestras manos</p></div>
          </div>
        </div>
        <div className="overflow-hidden rounded-3xl border border-line">
          <div className="grid grid-cols-3 gap-2 bg-ink-3 px-4 py-3 sm:px-5 font-mono text-[11px] uppercase tracking-wider text-mute"><span /><span>Sin Kalea</span><span className="text-lime">Con Kalea</span></div>
          {rows.map(([l, a, b], i) => (
            <motion.div key={l} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 * i }}
              className="grid grid-cols-3 items-center gap-2 border-t border-line px-4 py-4 text-xs sm:px-5 sm:text-sm">
              <span className="text-soft">{l}</span><span className="text-coral line-through decoration-coral/40">{a}</span><span className="font-semibold">{b}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Roadmap — sequential dot pop */
const phases = [
  ["Fase 0", "Prototipo", "Cotizador, flujo de orden y marca.", true],
  ["Fase 1", "Testnet", "Login SEP-10, API de órdenes, escrow Soroban en testnet.", false],
  ["Fase 2", "Piloto", "10 operadores en La Paz y Santa Cruz, KYC ligero, disputas.", false],
  ["Fase 3", "Mainnet", "Lanzamiento público, anchors SEP-24 y app móvil.", false],
] as const;
export function Roadmap() {
  return (
    <section id="roadmap" className="mx-auto max-w-6xl px-4 py-28 sm:px-6">
      <p className={eyebrow}>Roadmap · Stellar Community Fund</p>
      <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Del prototipo a mainnet.</h2>
      <div className="relative mt-16 grid gap-10 md:grid-cols-4 md:gap-6">
        <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: "easeInOut" }}
          className="absolute left-0 right-0 top-[11px] hidden h-px origin-left bg-gradient-to-r from-lime via-line to-line md:block" />
        {phases.map(([k, t, d, done], i) => (
          <div key={k} className="relative">
            <motion.span initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 400, damping: 14, delay: 0.3 + i * 0.25 }}
              className={`block size-6 rounded-full border-2 ${done ? "border-lime bg-lime" : "border-mute bg-ink"}`} />
            <p className="mt-5 font-mono text-[11px] uppercase tracking-wider text-mute">{k}</p>
            <h3 className="mt-1 text-xl font-semibold">{t}</h3>
            <p className="mt-2 text-sm text-soft">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* FAQ — height accordion */
const faqs = [
  ["¿Necesito una wallet?", "Sí, una wallet Stellar como Freighter. Inicias sesión firmando un mensaje, sin contraseñas."],
  ["¿Kalea guarda mis fondos?", "No. El USDC queda en un contrato de escrow en Stellar hasta que la orden se completa o se cancela."],
  ["¿Qué pasa si el operador no cumple?", "El escrow no libera fondos sin confirmación. Si hay conflicto, se abre una disputa con la evidencia registrada."],
  ["¿Cuánto cuesta?", "La tasa de cada operador ya incluye su margen y se muestra antes de confirmar. Las comisiones de red de Stellar son de fracciones de centavo."],
];
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="border-t border-line">
      <div className="mx-auto max-w-3xl px-4 py-28 sm:px-6">
        <p className={eyebrow}>FAQ</p>
        <h2 className="mt-4 text-4xl font-bold tracking-tight">Preguntas frecuentes</h2>
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
    <section className="px-4 pb-28 sm:px-6">
      <div className="grain relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-lime px-6 py-20 text-center text-lime-ink">
        <h2 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">El cambio que Bolivia necesitaba, sobre Stellar.</h2>
        <motion.a href="#cotizar" style={{ x: sx, y: sy }}
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); x.set((e.clientX - r.left - r.width / 2) * 0.35); y.set((e.clientY - r.top - r.height / 2) * 0.35); }}
          onMouseLeave={() => { x.set(0); y.set(0); }}
          className="mt-10 inline-block rounded-full bg-ink px-8 py-4 font-semibold text-paper">
          Empezar a cambiar →
        </motion.a>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 font-mono text-[11px] uppercase tracking-wider text-mute sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>© 2026 Kalea · Zer0 Knowledge Hack</span>
        <span>Construido sobre Stellar · Testnet</span>
        <a href="https://github.com/Zer0-Knowledge-Hack/KALEA" className="hover:text-lime">GitHub</a>
      </div>
    </footer>
  );
}
