# Feature: B2B LATAM ramp restructure

Locator: `odd/tasks/b2b-latam-ramp.md` · Engram mirror: `odd/b2b-latam-ramp/tasks` · Branch: `feat/b2b-latam-ramp` (from `main` @ `fb92a50`)

## Objective

Reposition Kalea from a consumer P2P USDC/BOB exchange (Bolivia only, Spanish) into **B2B fiat <-> USDC ramp infrastructure on Stellar for all of LATAM**, and make every artifact (docs, code, UI copy, tests) English.

## Problem

README, domain types, API, landing and tests all describe a consumer exchange for Bolivia: BOB-only fields (`amountBob`), per-operator ranked quotes, end-user SEP-10 login, Spanish copy, and three conflicting order lifecycles.

## Why

The business model was redefined (2026-11-07/08) and validated with on-chain evidence from p2p.me / P2PKit. The repo must tell the same story before building the Soroban escrow. Kalea is an independent project; funding applications are not part of the repository.

## Business model (source of truth for all tasks)

- **Actors**
  - **Integrators**: any business or system that embeds the ramp (wallets, payment collection, SaaS, auditors...). They are Kalea's only customers.
  - **End users**: the integrator's customers. They see one all-in price and receive or send the exact amount.
  - **Merchants / liquidity providers (LPs)**: they move local fiat under their own accounts and earn a reward.
  - **Kalea**: matching, pricing, escrow, disputes and the insurance fund.
- **Kalea never touches local fiat.** Fiat moves only between the end user and the merchant. Kalea settles only Stellar USDC through a per-order Soroban escrow with fixed amounts.
- **Pricing is per country and per side** over a market reference rate.
  - Buy (on-ramp): mid + markup.
  - Sell (off-ramp): mid - discount.
  - The spread funds the merchant reward and the insurance fund.
- **Merchant reward** (launch reference 1.5% on buys, configurable per country) is locked in 7-day cycles, which works both as a fraud buffer and as retention. The merchant receipt shows exact order amounts plus a separate "earned X USDC" line.
- **Kalea revenue is charged ONLY to integrators**: a per-transaction fee debited from a prefunded USDC balance, with volume tiers. End users and merchants never see a Kalea fee. Integrators may add their own markup.
- **Insurance fund**: about 0.1% per order.
- **Costs** (no salaries in this phase): about $500/month in operations.
- **Legal wording**: describe Kalea as infrastructure where fiat is handled by the merchants. Do NOT claim "Kalea is not responsible". Regulation is out of MVP scope.

## Scope

- In: README, `docs/`, `contracts/README.md`, `legacy/` note, `.gitignore`, shared domain model, API, web copy and flows, tests.
- Out: Soroban contract implementation, real integrations (Pollar, Didit, Reclaim), brand file renames, regulation.

## Delivery

- Strategy: `ask-on-risk`. The forecast is about 1,300-1,700 authored lines, which is above the ~400-line budget, so a chain strategy is required. Chain strategy: **feature-branch-chain** (user choice, 2026-11-08). `feat/b2b-latam-ramp` is the integration branch. Each task gets its own branch and a PR that targets the previous slice in the chain. The integration branch merges to `main` once, at the end. Slice boundaries and commits are recorded per task below.
- Units 2 -> 3 -> 4 depend on each other in order (the domain rename breaks the API and web typecheck).

## Tasks

- [x] **T1: Docs (English, B2B LATAM)**. Slice branch `feat/b2b-latam-ramp-t1-docs`. Checks: no Spanish characters (`rg` exit 1), no "not responsible" wording, all 18 relative links resolve. About 430 lines. TODOs left in the docs for open product decisions: volume tiers, how the integrator markup is collected, the sell-side reward, timeouts, dispute ownership. Follow-up commit removed all funding-application material (user request: Kalea is an independent project). Previous plan: Rewrite `README.md`. Add `docs/business-model.md`, `docs/architecture.md`, `docs/order-lifecycle.md`. Translate `contracts/README.md`, add `legacy/README.md`, and add `.atl/` to `.gitignore`. Route: delegated (2+ non-trivial files). Est. ~350-450 lines.
- [x] **T2: Shared domain model**. Slice branch `feat/b2b-latam-ramp-t2-domain`.
  - New `domain.ts` with one `merchantRewardBps` per corridor (150) and the `qr_payment` order kind. The old model stays in `legacy.ts` as deprecated.
  - The package root still exports the legacy `Order`, `Quote` and `OrderStatus`; the new ones are `RampOrder`, `RampQuote` and `RampOrderStatus` until T3/T4 migrate.
  - RED was observed (module missing). GREEN: shared 24/24, api 10/10, typecheck clean. Parent spot check re-ran `pnpm test` and `pnpm typecheck`.
  - About 420 lines; the legacy shim and the QR change pushed it over the estimate.
  - Previous plan: Add Country, FiatCurrency, Rail, Integrator and LiquidityProvider. Replace `amountBob` with `fiatAmount` + `fiatCurrency`. Add a quote with the price breakdown, a single `OrderStatus` lifecycle with escrow-first ordering, and LATAM demo data. Rewrite the tests in English. Route: delegated. Est. ~250-300 lines.
- [ ] **T3: API**. Add `/v1` integrator-scoped quotes and orders, integrator API-key auth (SEP-10 stays for LPs), prefunded balance and fee debit, English JSON errors, env and tests. Route: delegated. Est. ~300-400 lines.
- [ ] **T4: Web**. English B2B landing (integrators, coverage, how it works, LPs), `lang="en"`, a country picker with an all-in price, integrator/LP dashboard stubs, and English wallet and connect copy. Remove the "Roadmap · Stellar Community Fund" eyebrow in `sections.tsx:159` (no funding-application content in the project). Route: delegated. Est. ~400-500 lines.

## Acceptance criteria

- No Spanish left in tracked artifacts, except `legacy/prototype.html`, which is frozen and marked historical.
- One order lifecycle, used consistently in docs, shared, API and web.
- No artifact presents Kalea as a consumer exchange or as charging end users or merchants.
- `pnpm typecheck`, `pnpm test` and `pnpm --filter @kalea/web build` all pass.

## Checks

- T1: structural readback (links, headings, no Spanish, consistency with the business model above).
- T2-T4: `pnpm typecheck`, `pnpm test`, `pnpm --filter @kalea/web build`. Test-first applies to T2 and T3 (vitest).

## Progress

- 2026-11-08: Repo mapped (explorer). Branch created.
- 2026-11-08: T1 committed `dcee17f` on `feat/b2b-latam-ramp-t1-docs` (9 files, +495/-138). Native assessment: medium, `review_due` true (`slice_budget_reached`). Receipt-driven development is OFF (global), so no review was run (`disabled/unmanaged`). Verification: the writer's self-checks plus a parent spot check (Spanish `rg` exit 1).
- 2026-11-08: T2 started on `feat/b2b-latam-ramp-t2-domain` (branched from T1).
