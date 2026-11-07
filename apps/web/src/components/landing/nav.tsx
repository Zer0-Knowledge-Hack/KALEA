"use client";

import Link from "next/link";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
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
  useMotionValueEvent(scrollY, "change", (y) => {
    setHidden(y > 240 && y > (scrollY.getPrevious() ?? 0));
    setSolid(y > 24);
  });

  return (
    <motion.header
      animate={{ y: hidden ? -90 : 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed inset-x-0 top-0 z-50 transition-colors ${solid ? "border-b border-line bg-ink/80 backdrop-blur-lg" : ""}`}
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
        </div>
      </nav>
    </motion.header>
  );
}
