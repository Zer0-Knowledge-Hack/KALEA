/** Kalea mark and wordmark. Rendered as static HTML by Astro, and reused inside islands. */
export function LogoMark({ class: className = "size-7" }: { class?: string }) {
  return (
    <svg viewBox="0 0 96 96" class={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 24c26 0 14 24 32 24s6-24 32-24M16 72c26 0 14-24 32-24s6 24 32 24" />
      </g>
      <circle cx="48" cy="48" r="8" fill="currentColor" />
    </svg>
  );
}

export function Logo() {
  return (
    <span class="flex items-center gap-2 text-lime">
      <LogoMark />
      <span class="text-lg font-bold tracking-tight text-paper">KALEA</span>
    </span>
  );
}
