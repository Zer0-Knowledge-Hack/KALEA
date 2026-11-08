# Landing information architecture

- **Issue**: not opened yet. The user reviews the change locally first.
- **Branch**: `feat/landing-ia` (local only)

## Objective

Reorder and rewrite the landing so a B2B buyer understands it as quickly as the best ramp landings do (alfredpay, manteca, unigox). Kalea is a ramp for businesses that do not want complexity, built to support USDC and USDT across EVM and non-EVM chains.

## Constraints

- Product truth: only USDC on Stellar (testnet) is live, with 4 priced demo corridors (BO, BR, PE, MX). USDT, EVM and other non-EVM chains are roadmap and must be labeled that way.
- No invented metrics, customer logos or license claims (licensing is out of MVP scope).
- English copy. Follow the brand system in `brand/README.md`.

## Tasks

- [x] T1 new section order and copy, integrator-only (merchant content removed). Route: delegated writer.
- [x] T2 visual redesign: abstract and concise; no pills; typography, lines and whitespace instead of boxes; hero ornament as the protagonist; quote widget in its own section; about 8 sections. Route: delegated writer.
- [x] T3 i18n: en (`/`), neutral LATAM Spanish (`/es/`), Brazilian Portuguese (`/pt-br/`); language switcher, hreflang, localized quote widget; CONTRIBUTING language rule updated. Route: delegated writer.

## Checks

- `pnpm --filter @kalea/web typecheck`
- `pnpm --filter @kalea/web build`
- Visual review by the user on the local dev server.

## T1 evidence

Route: delegated writer. No runnable RED test applies (static Astro copy and layout); checks are typecheck, build, a CDP behavior check and visual review.

- Section order: Hero (with live quote widget) → Rails & countries strip → Who it is for → How it works → Use cases → Networks & stablecoins → Coverage → Safety by design → Developers → Pricing → Liquidity providers → FAQ (tabs) → Final CTA.
- New components: `Audience`, `RailsStrip`, `UseCases`, `Networks`, `Safety`, `Developers`, `StatusBadge`. Deleted: `QuoteSection`, `Ticker` (and the marquee CSS).
- Truth sources: priced demo corridors `packages/shared/src/domain.ts:288-293`; QR payments `apps/api/src/app.ts:54-65` and `domain.ts:240-245`; quote TTL `domain.ts:116`; quote request/response from `apps/api/src/app.ts:47-55,128-132` (sample computed with the shared `computeQuote`); webhooks and SDK planned `README.md:94`, `docs/architecture.md:230`; escrow simulated, contract not implemented `README.md:9,96`; fiat boundary `docs/business-model.md:14`; disputes `docs/order-lifecycle.md:150-156,188-193`; insurance fund `docs/business-model.md:36`; licensing out of scope `docs/business-model.md:104`.
- `pnpm --filter @kalea/web typecheck`: 0 errors, 0 warnings, 0 hints (38 files).
- `pnpm --filter @kalea/web build`: 2 pages built, complete.
- FAQ tabs (CDP): with JS the tab list shows, ArrowRight and End move selection and focus, one panel visible; with JS disabled all three groups are visible.
- Visual (dev server http://localhost:3000): 1440 px scrollWidth 1440, 390 px scrollWidth 390 (no horizontal scroll).
- Open: no real contact channel yet (`CONTACT_URL` in `components/landing/styles.ts` points to GitHub issues with a TODO).

## T1 follow-up evidence: integrator-only landing

Product decision: the landing serves only B2B integrators; liquidity providers get a separate surface later.

- Removed: Liquidity providers section (`Merchants.astro` deleted), FAQ "Liquidity providers" tab, nav "Merchant login" (desktop and mobile menu), the merchant card spotlight script, the merchant reward and 7-day lock hero numbers and the merchant pricing card. The `/app` route is untouched and unlinked.
- Pricing (now white, so it does not touch the Surface FAQ): end users get one all-in price with no Kalea fee line; the integrator pays a per-transaction fee from a prefunded balance; optional integrator markup; volume tiers (`docs/business-model.md:18-21`). Hero numbers: 5 min quote validity (`QUOTE_TTL_MS`, `packages/shared/src/domain.ts:116`) and 4 demo corridors (`DEMO_CORRIDOR_PRICING`, `domain.ts:288-293`).
- How it works, Safety and FAQ use the abstract "independent local liquidity partner". Merchant rewards, vaults, unvested rewards and SEP-10 sign-in are gone. The insurance fund moved to Safety only.
- Remaining liquidity wording: "liquidity partner" in How it works (steps 2-3), Safety (fiat point) and the FAQ (money custody), plus one code comment in `Faq.astro`.
- Rhythm: Deep hero → Deep-2 strip → white → Surface → white → Deep → Surface → white → Deep → white (Pricing) → Surface (FAQ) → Dusk CTA.
- `pnpm --filter @kalea/web typecheck`: 0 errors, 0 warnings.
- `pnpm --filter @kalea/web build`: complete.
- FAQ tabs (CDP): two tabs, ArrowRight/End move selection and focus; without JS both groups are visible.
- Visual (http://localhost:3000): 1440 px scrollWidth 1440, 390 px scrollWidth 390.

## T2 evidence

Route: delegated writer. No runnable RED test applies (static Astro layout and styling); checks are typecheck, build and a screenshot review against the brief.

- Sections (9 incl. CTA): Hero (Deep) → Value `#product` (white) → How it works + safety (Surface) → Live quote `#quote` (Deep) → Coverage & networks (white) → Developers (Deep) → Pricing (white) → FAQ (Surface) → Final CTA (Dusk) → Footer.
- Merged/deleted: `Audience` and `UseCases` into `Value`; `Safety` into `HowItWorks`; `Networks` and `RailsStrip` into `Coverage`; quote widget moved from the hero to `Quote.astro`. Deleted `RailsStrip`, `Audience`, `UseCases`, `Networks`, `Safety`, `StatusBadge`, ornaments `StreetPlate`, `StepBadge`, `Lane`. Street plates no longer appear.
- Pills replaced by: `StatusLabel` (mono word plus a solid or dashed short rule), underline text tabs (widget direction and rail, FAQ topics), rectangular 6 px buttons, hairline rows instead of cards. Only remaining `rounded-full` in the landing: the route stop rings in How it works.
- Ornaments (ported from the brand playground where missing): street perspective + street-flow (hero, sole protagonist below the horizon line; CTA lines); street highlight and lane underline (Value headline and sub); road arrows straight/split/turn (Value statements; CTA buttons; hero primary); route with stops (How it works layout); merge (fiat + stablecoin into one order); crop corners (quote widget frame); crown pattern (Quote margin); city grid with route (Coverage margin); intersection (networks Live vs Next); crown divider (Developers and FAQ section rules); dot-grid route (Developers margin); hero numbers with dashed lane rule (Pricing); skyline band (footer). Chamfer used once (quote widget).
- `pnpm --filter @kalea/web typecheck`: 0 errors, 0 warnings, 0 hints (40 files).
- `pnpm --filter @kalea/web build`: 2 pages built, complete.
- Visual (http://localhost:3000, quote island hydrated by scrolling): 1440 px scrollWidth 1440; 390 px scrollWidth 390.
- Open: `CONTACT_URL` is still a placeholder; Building bars ornament not used (it implies metrics the product does not have).

## T3 evidence

Route: delegated writer. Test-first exception: no runnable RED test exists for static copy; the type-level guard was proven by removing a key instead (below). Checks: typecheck, build, built-HTML grep, CDP switcher check and screenshots.

- Structure: `apps/web/src/i18n/` holds `locales.ts` (locale list and per-locale `html lang`, hreflang, `og:locale`, Intl tag, switcher label), `en.ts` (source of truth; `Dictionary = typeof en`), `es.ts` and `pt-br.ts` (typed `Dictionary`), `format.ts` (`fill`, `joinList`; island-safe) and `index.ts` (`getLocale`, `useTranslations`, `localizedPath`).
- Routing: Astro built-in `i18n` (`locales: ["en", "es", "pt-br"]`, `defaultLocale: "en"`, `prefixDefaultLocale: false`); pages `index.astro`, `es/index.astro`, `pt-br/index.astro` are identical thin wrappers that render `components/landing/Landing.astro` with `getLocale(Astro.currentLocale)`. `/app` untouched and English.
- One component set: every section takes `locale`; the quote widget receives its strings, Intl tag and localized country/rail names as island props (API values unchanged). Numbers: en-US `1,000.00`, es-419 `BOB 1,000.00` (CLDR es-419 uses period decimals), pt-BR `R$ 1.000,00`; the amount input accepts a comma decimal.
- Base: `<html lang>` en / es-419 / pt-BR, localized title, description, og/twitter and og:image:alt, `og:locale` (en_US, es_LA, pt_BR) plus `og:locale:alternate`, hreflang en / es / pt-BR / x-default. URLs are root-relative because `site` is not set (Google expects absolute hreflang URLs once the domain exists).
- Switcher: `EN · ES · PT` mono text links (current: white with an Apricot underline and `aria-current="true"`), in the bar from `sm`, inside the menu on phones. On click it appends the section in view; CDP: scrolled to `#pricing` on `/`, clicked ES → `/es/#pricing`, `lang=es-419`, ES marked current.
- Review fixes: Value "Local rails" reads "Pix, SPEI, Yape, QR Simple and bank transfer" (es "… y transferencia bancaria", pt "… e transferência bancária"); label contexts keep "Bank transfer". Coverage city grid shows at `w-20` on phones.
- `pnpm --filter @kalea/web typecheck`: 0 errors, 0 warnings, 0 hints (49 files). Removing `hero.primary` from `es.ts` → 1 error ts(2741) "Property 'primary' is missing"; restored.
- `pnpm --filter @kalea/web build`: 4 pages (`/`, `/es/`, `/pt-br/`, `/app`), complete; lang, titles and hreflang verified in `dist`.
- Leftover English: every `en.ts` string that differs from the translation was searched in the built es/pt-br HTML; the only hits were substrings of code, comments or translated words (for example "Product" inside "Producto").
- Visual (dev server): scrollWidth `/` 1440/390, `/es/` 1440/390, `/pt-br/` 1440/390; `/` at 1024 has no overflow. Fixed during review: widget rail tabs no longer wrap and the label column narrows on phones.
- Open: hreflang must become absolute once `site` is set; the widget shows the API's 400 error message as returned (English).
