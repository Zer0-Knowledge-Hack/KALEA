# Brand page

- **Issue**: not opened yet. The user reviews the change locally first.
- **Branch**: `feat/brand-page` (local only)

## Objective

Publish a brand guidelines page on the Kalea site so future partners and collaborators know how to use the Kalea brand: logo, colors, typography, ornaments, do's and don'ts, and downloadable assets.

## Constraints

- Separate page at `/brand` (`/es/brand/`, `/pt-br/brand/`), linked from the footer. The landing stays integrator-only.
- Source of truth: `brand/README.md`, `brand/tokens.json`, `brand/logo/*`, `brand/elements/*`. Never use `brand/archive/`.
- English source copy; neutral LATAM Spanish and Brazilian Portuguese via the typed dictionaries (`Dictionary = typeof en`).
- Reuse the landing look: ornaments, no pills, Funnel Display / Golos Text / Sometype Mono.
- Apricot (#EE9E4F) is never used as text on white (2.18:1).
- Naming story: Basque "kalea" = "the street". Never the Hawaiian meaning.

## Tasks

- [x] T1 brand page in three locales: page sections (story, logo and clear space, logo variants with downloads, color palette with hex/contrast notes, typography, ornaments, do's and don'ts, contact), downloadable assets under `apps/web/public/brand/`, footer link, dictionaries in en/es/pt-br. Route: delegated writer (2+ non-trivial files).

## Checks

- `pnpm --filter @kalea/web typecheck`
- `pnpm --filter @kalea/web build` (expects `/brand/`, `/es/brand/`, `/pt-br/brand/`)
- `bash scripts/verify-commit-policy.sh origin/main feat/brand-page`
- Visual review by the user on the local dev server; no horizontal scroll at 1440 px and 390 px.

## Delivery

Forecast: about 450–600 authored changed lines (dictionaries in three locales are most of it). Strategy: `ask-on-risk`; decide single PR vs chain before opening PRs.

## Progress

- 2026-11-08: branch created from `origin/main` (6c82395), feature document created.
- 2026-11-08: T1 done by a delegated writer; checks below passed. Next: user visual review on the dev server, then decide single PR vs chain.

## T1 evidence

- **Route**: delegated writer (2+ non-trivial files; dictionaries in three locales plus nine new components).
- **Files**: `apps/web/src/components/brand/*` (BrandPage, BrandHeader, Intro, Story, LogoSection, ColorSection, TypeSection, ElementsSection, RulesSection, Contact, assets.ts), `apps/web/src/pages/brand.astro`, `pages/es/brand.astro`, `pages/pt-br/brand.astro`, `i18n/en.ts`, `i18n/es.ts`, `i18n/pt-br.ts` (`brand` block and `footer.brand`), `layouts/Base.astro` (new `path` prop for hreflang alternates), `components/landing/Footer.astro` (Brand link), `apps/web/public/brand/*.svg` (copies of `brand/logo` and `brand/elements`).
- **Assets**: served from `/brand/*.svg` next to `/brand/index.html`; no collision in the build or on the dev server (`/brand/` 200, `/brand/kalea-lockup.svg` 200 image/svg+xml).
- **Contrast**: ratios recomputed from hex (WCAG 2.x). Apricot on Deep 6.81:1, on Ink 8.06:1 (the README attributes 6.81:1 to "Ink or Deep"; 6.81 is Deep). Muted on Surface is 4.44:1, so small Muted text is used only on white.
- **Test-first exception**: static Astro page, no runnable RED test; structural checks below instead.
- `pnpm --filter @kalea/web typecheck`: 0 errors, 0 warnings, 0 hints (63 files).
- `pnpm --filter @kalea/web build`: 7 pages; dist has `brand/index.html`, `es/brand/index.html`, `pt-br/brand/index.html` and the 12 SVGs in `dist/brand/`; hreflang alternates point to `/brand/`, `/es/brand/`, `/pt-br/brand/`; `lang` es-419 and pt-BR; footer links to the localized brand page in all three landings.
- Key removal check: deleting `brand.typography.tabular` from es.ts fails typecheck with ts(2741); restored.
- Headless Chrome (CDP) against the dev server: scrollWidth equals clientWidth at 1440 and 390 px in all three locales; no non-SVG element extends past the viewport.
- **Size**: about 1,084 authored changed lines (1,245 insertions + 4 deletions, minus 129 lines of copied SVGs and 36 lines of this document). Over the ~400 heuristic because the copy exists in three locales (481 lines) and the page has eight sections.
