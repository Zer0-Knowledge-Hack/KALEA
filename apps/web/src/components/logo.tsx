export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 24c26 0 14 24 32 24s6-24 32-24M16 72c26 0 14-24 32-24s6 24 32 24" />
      </g>
      <circle cx="48" cy="48" r="8" fill="currentColor" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-lime">
      <LogoMark />
      <span className="text-lg font-bold tracking-tight text-paper">KALEA</span>
    </span>
  );
}
