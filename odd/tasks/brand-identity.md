# Brand identity v1

- **Issue**: #17
- **Integration branch**: `feat/brand-identity`
- **Delivery strategy**: `feature-branch-chain` (per CONTRIBUTING: one child PR per task, based on the previous one)

## Objective

Replace the generic crypto look (black, lime, coral, Schibsted Grotesk, JetBrains Mono) with Kalea's own identity: "the street + a hidden crown".

## Why

The current fonts are the same as another ramp product's, and the look does not fit B2B integrators. Integrators re-theme the widget, so the brand must be recognizable through its mark and "Powered by Kalea", not through color.

## Decisions (from the brand sessions on 2026-11-08)

- Story: *kalea* is Basque for "the street". Never use the Hawaiian "joy" reading; Hawaiian dictionaries define *kalea* as "to choke; whooping cough".
- Mark (A1 "Crowned street"), 48-unit grid:
  - left building `5,42 5,11 14,20 18.8,20 14.5,42`
  - right building `43,42 43,11 34,20 29.2,20 33.5,42`
  - street `24,6 31,42 17,42`
- Palette: Ocean `#1E578F` primary, Apricot `#EE9E4F` accent (never text on white), Violet `#8F62BC` and Lime `#80B946` support. Deep `hsl(210 60% 16%)` for dark covers. Neutrals are tinted to hue 210.
- Type: Funnel Display 700 (display), Golos Text (text/UI), Sometype Mono (data, code, eyebrows).
- Graphic elements: street perspective, city grid, crown pattern, street plates, lanes, building-cut shapes, and icons (1.8 stroke, one Apricot detail).

## Scope and acceptance

- [x] **T1 brand assets** (`brand/`): SVG mark, lockups (light, dark, mono), app icon, favicon; `tokens.json`; `README.md` usage guide; earlier explorations moved to `brand/archive/`.
  - Accept: SVGs are valid and render; the README covers the story, palette roles with contrast, type, graphic elements, co-branding, clear space and don'ts.
- [x] **T2 web foundation** (`apps/web`): tokens in `global.css`, self-hosted fonts (`@fontsource/funnel-display`, `@fontsource/golos-text`, `@fontsource/sometype-mono`), logo component, favicon, Open Graph image.
  - Accept: `pnpm --filter @kalea/web typecheck` and `build` pass, and no reference to the old fonts remains.
- [ ] **T3 landing restyle** (`apps/web/src/components/landing`, islands token usage).
  - Accept: typecheck and build pass, and screenshots look right at desktop and phone width.

## Checks

- `pnpm --filter @kalea/web typecheck`
- `pnpm --filter @kalea/web build`
- Test-first exception: these are visual and asset changes with no runnable unit behavior. Verification is the structural, build and visual checks above.

## Progress

| Task | Route | Commit | Status |
|------|-------|--------|--------|
| T1 | delegated writer (several non-trivial files) | see `git log feat/brand-identity-t1-assets` | done |
| T2 | delegated writer (15+ files) | see `git log feat/brand-identity-t2-web-foundation` | done (parent re-ran typecheck: 0 errors) |
| T3 | — | — | pending |

### T1 evidence

- All 12 SVGs parse and render (resvg); the parent reviewed the lockup and app icon renders.
- `tokens.json` parses.
- WCAG contrast vs white: Ocean 7.46, Apricot 2.18, Violet 4.52, Lime 2.35, Deep 14.84, Ink 17.57, Muted 4.85. Apricot on Deep: 6.81.
- The wordmark is outlined from Funnel Display 700 (Fontsource WOFF) with opentype.js. Path data is serialized manually because `toPathData` emitted NaN.

### T2 evidence

- Fonts self-hosted through `@fontsource/funnel-display` (600, 700), `@fontsource/golos-text` (400, 500, 600) and `@fontsource/sometype-mono` (400, 500), imported in `global.css`; the Google Fonts links are gone.
- `global.css` `@theme static` holds the `brand/tokens.json` colors, fonts and radii, plus derived dark-surface roles (`deep-2`, `deep-3`, `deep-line`, `deep-muted`, `deep-soft`, `error-on-dark`). Old utilities were renamed: `ink`→`deep`, `ink-2/3`→`deep-2/3`, `line`→`deep-line`, `mute`→`deep-muted`, `soft`→`deep-soft`, `paper`→`surface`, `lime`→`apricot`, `lime-ink`→`ink`, `coral`→`error-on-dark` (errors) or `violet` (highlights).
- Contrast on Deep: deep-muted 6.69, deep-soft 8.53, error-on-dark 6.87, Apricot 6.81, surface 13.57. Ink on Apricot buttons: 8.06. Violet on Deep is 3.28, so it is used only for large text and strokes.
- `logo.tsx` draws the A1 mark (exact polygons) and a live-text "Kalea" wordmark. Props: `size`, `tone` (`color` | `on-dark` | `mono`), `withWordmark`. Exports `Logo` and `LogoMark` keep their names.
- `public/favicon.svg`, `public/apple-touch-icon.png` (180×180) and `public/og.png` (1200×630, street perspective with the on-dark lockup) are rendered with resvg and wired in `Base.astro`, with `theme-color` set to `#1E578F` and Open Graph and Twitter meta.
- `pnpm --filter @kalea/web typecheck`: 0 errors, 0 warnings, 0 hints (26 files).
- `pnpm --filter @kalea/web build`: 2 pages built, and the fonts are emitted as woff2/woff in `dist/_astro`.
- A search for old identity references (schibsted, jetbrains, the old hex values, color-coral, color-paper, lime-ink, googleapis) found no matches in `apps/web/src`.
- Headless Chrome screenshots of `/` and `/app` show a Deep background, Apricot accents and buttons, Funnel Display headlines, Golos body text and Sometype Mono eyebrows. No black or lime is left.

## Next step

T3 landing restyle on `feat/brand-identity-t3-landing` (based on T2).
