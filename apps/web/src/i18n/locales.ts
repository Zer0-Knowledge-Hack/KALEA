/** Landing locales. English is the source and the default, served unprefixed at `/`. */
export const LOCALES = ["en"] as const;
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
};
