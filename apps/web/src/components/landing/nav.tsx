"use client";

import Link from "next/link";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { ConnectButton } from "@/components/connect-button";

const links = [
  ["Cotizar", "#cotizar"],
  ["Cómo funciona", "#como-funciona"],
  ["Seguridad", "#seguridad"],
  ["Roadmap", "#roadmap"],
  ["FAQ", "#faq"],
];

export function Nav() {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => {
    setHidden(!open && y > 240 && y > (scrollY.getPrevious() ?? 0));
    setSolid(y > 24);
  });

  return (
    <motion.header
      animate={{ y: hidden ? -90 : 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed inset-x-0 top-0 z-50 transition-colors ${solid || open ? "border-b border-line bg-ink/90 backdrop-blur-lg" : ""}`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Kalea inicio"><Logo /></Link>
        <ul className="hidden gap-7 md:flex">
          {links.map(([t, h]) => (
            <li key={h}>
              <a href={h} className="font-mono text-[11px] uppercase tracking-[0.14em] text-soft transition hover:text-lime">{t}</a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <Link href="/app" className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-soft hover:text-paper sm:block">App</Link>
          <ConnectButton />
          <button onClick={() => setOpen(!open)} aria-label="Menú" aria-expanded={open}
            className="grid size-9 place-items-center rounded-full border border-line md:hidden">
            <span className="relative block h-3 w-4">
              <motion.span animate={open ? { rotate: 45, y: 5 } : { rotate: 0, y: 0 }} className="absolute left-0 top-0 h-px w-4 bg-paper" />
              <motion.span animate={open ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }} className="absolute bottom-0 left-0 h-px w-4 bg-paper" />
            </span>
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.ul initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden px-4 md:hidden">
            {[...links, ["App", "/app"]].map(([t, h], i) => (
              <motion.li key={h} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
                className="border-t border-line first:border-0">
                <a href={h} onClick={() => setOpen(false)} className="block py-4 text-2xl font-semibold">{t}</a>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
