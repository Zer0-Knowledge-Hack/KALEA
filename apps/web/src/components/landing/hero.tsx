"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

const words = ["Tus", "dólares", "digitales,", "en", "bolivianos", "al", "toque."];

function Waves() {
  const reduce = useReducedMotion();
  const paths = Array.from({ length: 14 }, (_, i) => {
    const o = i * 26;
    return `M-50 ${180 + o} C 250 ${40 + o}, 450 ${420 + o}, 720 ${200 + o} S 1150 ${20 + o}, 1500 ${260 + o}`;
  });
  return (
    <svg viewBox="0 0 1440 700" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
      {paths.map((d, i) => (
        <motion.path key={i} d={d} fill="none" stroke={i % 5 === 0 ? "#ff7a70" : "#c8f23a"}
          strokeWidth={i % 5 === 0 ? 1.2 : 0.7}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={reduce ? { pathLength: 1, opacity: 0.35 } : { pathLength: 1, opacity: [0, 0.5, 0.25], pathOffset: [0, 0.04, 0] }}
          transition={{ duration: 2.4, delay: 0.3 + i * 0.07, ease: "easeInOut",
            pathOffset: { duration: 8 + i, repeat: Infinity, repeatType: "mirror" },
            opacity: { duration: 2.4 + i * 0.1 } }}
        />
      ))}
    </svg>
  );
}

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section ref={ref} className="grain relative flex min-h-[92svh] items-center overflow-hidden pt-24">
      <motion.div style={{ y }} className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_70%_40%,black_20%,transparent_75%)]">
        <Waves />
      </motion.div>
      <motion.div style={{ opacity: fade }} className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
        <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-ink-2/80 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-soft">
          <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-60" /><span className="relative size-2 rounded-full bg-lime" /></span>
          Stellar testnet · Bolivia
        </motion.span>
        <h1 className="max-w-4xl text-[clamp(2.6rem,7.5vw,6rem)] font-bold leading-[0.95] tracking-tight">
          {words.map((w, i) => (
            <span key={i} className="mr-[0.22em] inline-block overflow-hidden pb-[0.08em] align-bottom">
              <motion.span className={`inline-block ${w === "bolivianos" ? "text-lime" : ""}`}
                initial={{ y: "110%", rotate: 6, filter: "blur(6px)" }}
                animate={{ y: 0, rotate: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8, delay: 0.15 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}>
                {w}
              </motion.span>
            </span>
          ))}
        </h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.6 }}
          className="mt-6 max-w-xl text-lg text-soft">
          Compara operadores P2P, paga con QR Simple o transferencia y recibe USDC en tu wallet Stellar. Con escrow on-chain, sin custodia.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.95, duration: 0.6 }}
          className="mt-9 flex flex-wrap items-center gap-4">
          <a href="#cotizar" className="rounded-full bg-lime px-6 py-3 font-semibold text-lime-ink transition hover:-translate-y-0.5 hover:shadow-[0_10px_40px_-10px_#c8f23a]">Cotizar ahora</a>
          <a href="#como-funciona" className="group flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-soft hover:text-paper">
            Ver cómo funciona <span className="transition group-hover:translate-x-1">→</span>
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
