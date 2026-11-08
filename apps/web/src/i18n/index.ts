import { en, type Dictionary } from "./en";
export { fill, joinList } from "./format";
import { DEFAULT_LOCALE, LOCALES, LOCALE_META, type Locale } from "./locales";

export { DEFAULT_LOCALE, LOCALES, LOCALE_META, type Dictionary, type Locale };

const dictionaries: Record<Locale, Dictionary> = { en };

export const isLocale = (value: string | undefined): value is Locale => LOCALES.some((l) => l === value);

/** Locale from `Astro.currentLocale` (set by the `i18n` config), falling back to the default. */
export const getLocale = (value: string | undefined): Locale => (isLocale(value) ? value : DEFAULT_LOCALE);

/** The landing dictionary for a locale. */
export const useTranslations = (locale: Locale): Dictionary => dictionaries[locale];

/** Root-relative path for a locale: the default locale is unprefixed (`/`), others get `/<locale>/`. */
export const localizedPath = (locale: Locale, path = "/"): string => {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return locale === DEFAULT_LOCALE ? clean : `/${locale}${clean}`;
};
