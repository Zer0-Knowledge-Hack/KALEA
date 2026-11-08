# Feature: Astro web with Preact islands

Locator: `odd/tasks/astro-web.md` · Engram mirror: `odd/astro-web/tasks` · Integration branch: `feat/astro-web` (from `main` @ `0012cc4`)

## Objective

Replace the Next.js frontend with **Astro + Preact islands**. The landing page becomes static HTML, and only the interactive parts ship JavaScript: the corridor quote demo, the Freighter sign-in and the merchant dashboard. The backend stays on Node.js with Hono (user decision: keep Hono, it is only a router on Node).

## Why

Next.js is more than the product needs: a mostly static B2B landing plus three small interactive widgets. Astro gives smaller pages, better SEO and a simpler build.

## Decisions

- Frontend: Astro + `@astrojs/preact` islands (user choice, 2026-11-08). Static output with no server adapter.
- The demo quote moves to the API as a **public demo endpoint with rate limiting**. The web no longer holds any integrator key, and the `/api/demo-quote` Next proxy and `KALEA_DEMO_INTEGRATOR_KEY` go away.
- Keep the visual identity (palette tokens, fonts, layout). Motion (React) animations are ported to CSS, or to a Preact island where interaction needs them.
- All artifacts stay in English.

## Scope

- In: `apps/api` (public demo endpoints + tests), `apps/web` (full migration), README local-dev section, CI only if the build command changes.
- Out: new product copy, the BO demo mid-rate correction (pending user decision), the integrator dashboard.

## Delivery

- Forecast: about 150 lines (T1) plus about 700-900 lines (T2, a framework migration that rewrites roughly 1,000 lines of TSX).
- Strategy: `ask-on-risk`. Chain strategy: **feature-branch-chain**, reusing the user's choice from feature `b2b-latam-ramp`. `feat/astro-web` is the integration branch, with one slice branch and PR per task. `main` is protected, so everything lands through PRs.

## Tasks

- [x] **T1: Public demo endpoints in the API**. Commit `7636528` on `feat/astro-web-t1-demo-api`.
  - Both demo routes share one per-IP budget (30 requests / 60 s); a 429 carries `Retry-After`.
  - RED observed (6 failing with 404). GREEN: api 35/35, typecheck clean. Parent spot check re-ran the api tests.
  - Previous plan:
  - Add `GET /v1/demo/corridors` and `POST /v1/demo/quote`. Both are unauthenticated, use the demo corridor pricing, have a per-IP in-memory rate limit, and return the end-user quote with no integrator fee.
  - CORS stays limited to `WEB_ORIGIN`. Add tests.
  - Route: delegated (writer). Est. ~150 lines. Test-first (vitest).
- [x] **T2: Astro + Preact islands web**. Slice branch `feat/astro-web-t2-web`.
  - Versions: astro 7.4.7, @astrojs/preact 6.1.2, preact 11.2.0, @tailwindcss/vite 4.3.5.
  - The web package pins TypeScript 6.0.3 because `astro check` refuses TypeScript 7.
  - Dev and preview run on port 3000 to match the API's CORS default.
  - Island JS: about 11.6 KB gzip on the landing, loaded only when the quote section becomes visible. Freighter loads on demand.
  - Checks: `astro check` 0 errors, tests 24 + 35 passed, build OK (2 static pages). Smoke run: live demo quote with CORS OK. Parent spot check re-ran typecheck and build.
  - `apps/web/.env.example` now holds only `PUBLIC_API_URL`.
  - Follow-ups: self-host fonts (now Google Fonts); scroll-driven animations degrade to static on browsers without `animation-timeline`.
  - Previous plan:
  - Replace the Next app with Astro: `.astro` pages for `/` and `/app`, static landing sections, and Preact islands for the quote demo, the connect button/wallet and the merchant dashboard. The islands call the T1 demo endpoints and the merchant `/v1` endpoints.
  - Remove the Next files, dependencies and `AGENTS.md`. Update the README dev/env section.
  - Route: delegated (writer). Est. ~700-900 lines. No web tests exist; checks are typecheck (`astro check`), build and a smoke run.

## Acceptance criteria

- `apps/web` has no `next`, `react` or `react-dom` dependencies. Pages build statically with `astro build`.
- The landing renders the same sections and copy as today. The quote demo works against the API's public demo endpoint, and the merchant dashboard works with SEP-10.
- No integrator key is used by the web.
- `pnpm typecheck`, `pnpm test` and `pnpm --filter @kalea/web build` pass.

## Checks

- T1: `pnpm --filter @kalea/api test` (RED then GREEN), `pnpm typecheck`.
- T2: `pnpm typecheck`, `pnpm --filter @kalea/web build`, a smoke run (`astro preview` + API, `curl` plus a headless Chrome screenshot).

## Progress

- 2026-11-08: Feature created. Dev servers stopped. T1 next.
