/** Shared class strings and links for the landing sections. */
const eyebrowBase = "font-mono text-[11px] uppercase tracking-[0.2em]";
/** Eyebrow on Deep sections (Apricot is allowed on Deep, 6.8:1). */
export const eyebrow = `${eyebrowBase} text-apricot`;
/** Eyebrow on white and Surface sections (Apricot is never text on light backgrounds). */
export const eyebrowLight = `${eyebrowBase} text-ocean`;

/** Page container and section rhythm. */
export const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";
export const sectionY = "py-24 sm:py-32";
/** Section headline: large display type, tight leading. */
export const h2 = "text-[2.5rem] font-bold leading-[1.02] tracking-tight sm:text-5xl lg:text-[3.5rem]";

/** Rectangular buttons with a small radius (never pills). */
const btn = "inline-flex items-center gap-2.5 rounded-[6px] px-5 py-3 font-semibold transition";
export const btnPrimary = `${btn} bg-apricot text-ink hover:brightness-105`;
export const btnGhostDark = `${btn} border border-white/40 text-white hover:border-white`;

export const REPO = "https://github.com/Zer0-Knowledge-Hack/KALEA";
export const DOCS_URL = `${REPO}/tree/main/docs`;
// TODO: real contact channel. GitHub issues are a placeholder until a demo booking or sales inbox exists.
export const CONTACT_URL = `${REPO}/issues`;
