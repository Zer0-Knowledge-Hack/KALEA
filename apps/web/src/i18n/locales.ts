/** Landing locales. English is the source and the default, served unprefixed at `/`. */
export const LOCALES = ["en", "es", "pt-br"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

interface LocaleMeta {
  /** `<html lang>` value (BCP 47). */
  htmlLang: string;
  /** `hreflang` value for alternate links. */
  hreflang: string;
  /** Open Graph locale (language_TERRITORY). */
  ogLocale: string;
  /** Tag for `Intl` number and currency formatting. */
  intl: string;
  /** Short switcher label. */
  label: string;
  /** Language name in its own language, for assistive technology. */
  name: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { htmlLang: "en", hreflang: "en", ogLocale: "en_US", intl: "en-US", label: "EN", name: "English" },
  // es-419: Spanish as used in Latin America and the Caribbean. Open Graph has no 419 region; es_LA is its Latin American Spanish code.
  es: { htmlLang: "es-419", hreflang: "es", ogLocale: "es_LA", intl: "es-419", label: "ES", name: "Español" },
  "pt-br": { htmlLang: "pt-BR", hreflang: "pt-BR", ogLocale: "pt_BR", intl: "pt-BR", label: "PT", name: "Português (Brasil)" },
};
