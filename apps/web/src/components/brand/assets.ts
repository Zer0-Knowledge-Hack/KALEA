/**
 * Downloadable brand files for the brand page. Copies of brand/logo and brand/elements served from
 * apps/web/public/brand, so the page at /brand/ and the files at /brand/*.svg share one folder.
 * Never link brand/archive here.
 */
/** Locale-neutral path of the brand page; localizedPath() adds the locale prefix. */
export const BRAND_PATH = "/brand/";

export const asset = (file: string) => `/brand/${file}`;

/** Download link: mono label with a dashed Apricot lane on hover and a visible focus ring. */
export const downloadLink =
  "inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] underline decoration-1 underline-offset-4 transition hover:decoration-apricot focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current";

/** Logo variants in the order of brand/README.md. `bg` is the preview background the file is made for. */
export const LOGO_VARIANTS = [
  { key: "default", bg: "bg-white ring-1 ring-inset ring-line", preview: "kalea-lockup.svg", files: { lockup: "kalea-lockup.svg", mark: "kalea-mark.svg" } },
  { key: "onDark", bg: "bg-deep", preview: "kalea-lockup-on-dark.svg", files: { lockup: "kalea-lockup-on-dark.svg", mark: "kalea-mark-on-dark.svg" } },
  { key: "monoInk", bg: "bg-white ring-1 ring-inset ring-line", preview: "kalea-lockup-mono-ink.svg", files: { lockup: "kalea-lockup-mono-ink.svg", mark: "kalea-mark-mono-ink.svg" } },
  { key: "monoWhite", bg: "bg-deep", preview: "kalea-mark-mono-white.svg", files: { mark: "kalea-mark-mono-white.svg" } },
  { key: "appIcon", bg: "bg-surface", preview: "kalea-app-icon.svg", files: { icon: "kalea-app-icon.svg" } },
] as const;

/** Brand colors with their WCAG 2.x ratio against white (from brand/README.md, recomputed from the hex values). */
export const SWATCHES = [
  { key: "ocean", name: "Ocean", hex: "#1E578F", vsWhite: "7.46", fg: "text-white" },
  { key: "apricot", name: "Apricot", hex: "#EE9E4F", vsWhite: "2.18", fg: "text-ink" },
  { key: "violet", name: "Violet", hex: "#8F62BC", vsWhite: "4.52", fg: "text-white" },
  { key: "lime", name: "Lime", hex: "#80B946", vsWhite: "2.35", fg: "text-ink" },
  { key: "deep", name: "Deep", hex: "#102941", vsWhite: "14.84", fg: "text-white" },
  { key: "ink", name: "Ink", hex: "#121A21", vsWhite: "17.57", fg: "text-white" },
] as const;
