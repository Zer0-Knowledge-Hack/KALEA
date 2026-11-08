# Agent instructions: Kalea

This guide is for AI coding agents (and humans working with them). It defines repository conventions, architecture, testing tiers, and non-negotiable rules.

---

## 1. What Kalea is (and is not)

Kalea is **B2B fiat <-> USDC ramp infrastructure on Stellar for Latin America**.

- **Customers:** Businesses and integrators (wallets, SaaS, checkout providers) that embed ramps via our API.
- **Liquidity:** Independent merchants (liquidity providers) move local fiat peer-to-peer under their own bank/fintech accounts.
- **Settlement:** Kalea settles only Stellar USDC through a per-order Soroban escrow (`kalea-escrow`).
- **Custody:** Kalea **never** holds local fiat. Never claim "no custody" or that anyone is "not responsible"; legal wording must remain accurate.
- **Framing:** **Never** frame Kalea as a consumer exchange, a wallet, or a P2P marketplace. See [docs/business-model.md](docs/business-model.md).

---

## 2. Architecture and boundaries

- **Off-chain (`apps/api`, `packages/shared`):**
  - Order matching and corridor routing (`selectMerchant`).
  - Reputation scoring and completion rates.
  - Pricing engine (all-in prices with spreads over mid-market reference).
  - Integrator fee accounting (debited off-chain from prefunded USDC balance).
- **On-chain (`contracts/escrow`):**
  - `kalea-escrow` v1: Minimal Soroban escrow enforcing canonical lifecycle (`created -> escrow_locked -> fiat_sent -> released`).
  - Exits: `cancel` (before fiat sent), `expire` (refund after payment timeout), `dispute` (freeze on timeout or conflict).
  - Atomic 3-way split on release: recipient USDC, merchant reward vault (1.5%), insurance fund (~0.1%).
- **Fee sponsorship:**
  - Stellar CAP-0015 Fee-Bump transactions sponsored by a relayer (Pollar, planned) for gasless UX.

---

## 3. Repository layout

| Directory | Role | Stack | Testing |
|---|---|---|---|
| `packages/shared/` | Domain types, corridor catalogs, order lifecycle state machine | Pure TypeScript | Vitest (Unit) |
| `apps/api/` | Integrator `/v1` API, merchant SEP-10 challenge/login, demo endpoints | Hono, Node.js, Zod | Vitest (Unit & Integration) |
| `apps/web/` | B2B landing page, interactive quote demo, merchant dashboard | Astro 5, Preact islands, Tailwind 4 | Playwright (E2E) |
| `contracts/` | Soroban smart contracts | Rust (`#![no_std]`), Soroban SDK 28 | `cargo test` (Host unit & mutation) |
| `docs/` | Architectural rationale, business model, order lifecycle specs | Markdown | Review |

---

## 4. Testing tiers & development workflow

The repository enforces a structured three-tier testing strategy:

### 4.1 Unit tests
- **Tools:** **Vitest** (TypeScript packages) & **Cargo test** (Rust contracts).
- **Scope:** Pure functions, calculations (spreads, amounts, fee tiers), Zod schema validations, and contract invariants.
- **Commands:**
  ```bash
  pnpm test:unit           # Runs unit tests in packages/shared and apps/api
  cargo test               # Runs Soroban smart contract host unit tests (in contracts/)
  ```

### 4.2 Integration tests
- **Tool:** **Vitest** with in-memory state and simulated cryptographic signers.
- **Scope:** Multi-step API flows and complete order lifecycle simulation:
  - Integrator requests `/v1/quotes` -> creates `/v1/orders`.
  - Escrow locking -> simulated fiat payment -> authorization & release.
  - Balance debits, timeout handling, dispute resolution, and error cases.
- **Command:**
  ```bash
  pnpm test:integration    # Runs full lifecycle simulation in apps/api/src/lifecycle.test.ts
  ```

### 4.3 End-to-end (E2E) tests
- **Tool:** **Playwright** (`@playwright/test`).
- **Scope:** Full browser testing of the web app (`apps/web`):
  - Page rendering, responsive layouts, navigation.
  - Interactive Preact islands (QuoteWidget country/rail selection, amount calculation, error boundaries).
- **Command:**
  ```bash
  pnpm test:e2e            # Runs Playwright E2E suite
  ```

### 4.4 All checks combined
Before opening any PR, run all checks locally:
```bash
pnpm typecheck
pnpm test
pnpm --filter @kalea/web build
cargo test                 # (if modifying contracts)
```

---

## 5. Non-negotiable agent rules

1. **Language:** English **only** for all artifacts: code, comments, identifiers, UI copy, docs, commit messages, and PR descriptions.
2. **Git provenance & conventional commits:**
   - Use Conventional Commits (`feat(scope): ...`, `fix(scope): ...`, `docs: ...`, `chore: ...`).
   - **Never add "Co-Authored-By" or AI attribution trailers** (Claude, Cursor, Antigravity, ChatGPT, Copilot, etc.). CI automatically rejects any PR containing AI attribution.
3. **Branch protection & PR policy:**
   - Direct pushes to `main` are disabled (`allow_force_pushes: false`, `enforce_admins: true`).
   - Every change must enter `main` through a pull request.
   - **At least 1 review approval from someone other than the author** is required before merge.
   - All three CI checks (`check`, `contracts`, `scan`) must be green.
4. **Secret hygiene:**
   - **Never commit secrets:** Stellar secret seeds (`S...`), private keys, passwords, or `.env` files.
   - Gitleaks (`.gitleaks.toml`, `.github/workflows/secrets.yml`) verifies every PR and push.
5. **State machine integrity:**
   - Order status transitions must strictly invoke `canTransition()` from `@kalea/shared`. Never hardcode state mutations in API endpoints or web components.
