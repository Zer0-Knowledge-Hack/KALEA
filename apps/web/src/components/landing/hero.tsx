"use client";

import { motion, useInView, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

const words = ["Local", "ramps", "for", "LATAM,", "one", "API."];

const wavePaths = Array.from({ length: 9 }, (_, i) => {
  const o = i * 38;
  return `M-50 ${180 + o} C 250 ${40 + o}, 450 ${420 + o}, 720 ${200 + o} S 1150 ${20 + o}, 1500 ${260 + o}`;
});

// Lines draw in once; the idle drift is a cheap compositor-only transform on the group, paused off-screen.
function Waves() {
  const reduce = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const visible = useInView(ref);
  return (
    <svg ref={ref} viewBox="0 0 1440 700" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
      <motion.g
        animate={reduce || !visible ? undefined : { x: [0, -40, 0], y: [0, 18, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        style={{ willChange: "transform" }}
      >
        {wavePaths.map((d, i) => (
          <motion.path key={i} d={d} fill="none" stroke={i % 4 === 0 ? "#ff7a70" : "#c8f23a"}
            strokeWidth={i % 4 === 0 ? 1.2 : 0.8} vectorEffect="non-scaling-stroke"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.35 }}
            transition={{ duration: 2, delay: 0.3 + i * 0.08, ease: "easeInOut" }}
          />
        ))}
      </motion.g>
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
          Stellar testnet · B2B ramp infrastructure
        </motion.span>
        <h1 className="max-w-4xl text-[clamp(2.6rem,7.5vw,6rem)] font-bold leading-[0.95] tracking-tight">
          {words.map((w, i) => (
            <span key={i} className="mr-[0.22em] inline-block overflow-hidden pb-[0.08em] align-bottom">
              <motion.span className={`inline-block ${w === "LATAM," ? "text-lime" : ""}`}
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
          Embed fiat on-ramps, off-ramps and QR payments across Latin America. Independent merchants move local fiat under their own accounts; Kalea settles only USDC on Stellar through a per-order escrow.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.95, duration: 0.6 }}
          className="mt-9 flex flex-wrap items-center gap-4">
          <a href="#quote" className="rounded-full bg-lime px-6 py-3 font-semibold text-lime-ink transition hover:-translate-y-0.5 hover:shadow-[0_10px_40px_-10px_#c8f23a]">Try a corridor quote</a>
          <a href="#how-it-works" className="group flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-soft hover:text-paper">
            How it works <span className="transition group-hover:translate-x-1">→</span>
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
