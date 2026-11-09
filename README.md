# Kalea

**B2B fiat <-> USDC ramp infrastructure on Stellar for Latin America.**

Website: [getkalea.pages.dev](https://getkalea.pages.dev)

Kalea lets any business add local-currency on-ramps and off-ramps to its product through one API. Local fiat moves directly between end users and independent merchants (liquidity providers) under their own accounts. Kalea never holds local fiat: it matches orders, prices them per country, and settles only Stellar USDC through a per-order Soroban escrow with fixed amounts.

Kalea is not a consumer exchange, a wallet, or a P2P marketplace. Its customers are the businesses that integrate it.

> **Status:** early stage. The API and escrow lifecycle run as an in-memory simulation on testnet; the Soroban escrow v1 implements the canonical lifecycle and is deployed on testnet ([contracts/](contracts/README.md)); the reward vault and insurance fund contracts are pending. See [Current status](#current-status).

## Who does what

| Actor | Role | Sees | Pays | Earns |
| --- | --- | --- | --- | --- |
| **Integrator** | Business that embeds the ramp (wallet, payment collection, SaaS, others). Kalea's only customer. | API quotes, orders, balance and fee statements | Per-transaction fee from a prefunded USDC balance, with volume tiers | Its own optional markup on the end-user price |
| **End user** | The integrator's customer | One all-in price; receives or sends the exact amount | The all-in price only (no Kalea fee line) | — |
| **Merchant / LP** | Moves local fiat under their own accounts and provides USDC liquidity | Exact order amounts plus a separate "earned X USDC" line | Nothing to Kalea | Reward per order, locked in 7-day cycles |
| **Kalea** | Matching, pricing, escrow, disputes, insurance fund | All orders and settlement | — | Integrator fees |

Details: [docs/business-model.md](docs/business-model.md).

## How an order works

Every order is escrow-first: the USDC side is locked in a Soroban escrow before anyone sends fiat.

1. The integrator requests a quote for a country, side (buy or sell) and amount. Kalea returns one all-in price.
2. The integrator creates the order. Kalea matches it with a merchant.
3. The party that provides USDC locks it in the escrow (the merchant on a buy, the end user on a sell).
4. The party that provides fiat pays the other party through a local rail and marks the order as paid.
5. The fiat recipient confirms, and the escrow releases USDC, the merchant reward and the insurance contribution.
6. Timeouts refund the locked USDC; disputes freeze the escrow until resolved.

The canonical lifecycle is `created -> escrow_locked -> fiat_sent -> released`, with `cancelled`, `expired` and `disputed` as exits. See [docs/order-lifecycle.md](docs/order-lifecycle.md).

## Why Stellar

- **USDC on Stellar** is a widely used settlement asset with fast finality and very low network fees, which matters for small LATAM tickets.
- **SEP standards** (SEP-10 web authentication today, other SEPs as they fit) give merchants and wallets a shared way to authenticate and interoperate.
- **Soroban** smart contracts let the escrow enforce fixed amounts, timeouts and the fee/reward split on-chain.

Architecture: [docs/architecture.md](docs/architecture.md).

## Repository layout

```text
KALEA/
├── apps/
│   ├── web/        # Astro landing and merchant app (Preact islands)
│   └── api/        # Hono API: quotes, orders, SEP-10 auth
├── packages/
│   └── shared/     # Shared domain types and demo data
├── contracts/      # Soroban escrow v1 (reward vault, insurance pending)
├── legacy/         # Frozen historical prototype
├── brand/          # Logo and visual identity explorations
└── docs/           # Product and technical documentation
```

## Local development

Requirements: Node.js 22 and pnpm (version pinned in `package.json`).

```sh
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm dev          # web on :3000, api on :8787
```

| Command | What it does |
| --- | --- |
| `pnpm dev` | Runs all apps in parallel |
| `pnpm dev:web` | Runs only the web app |
| `pnpm dev:api` | Runs only the API |
| `pnpm typecheck` | Type-checks every package |
| `pnpm test` | Runs every package's tests |
| `pnpm build` | Builds every package |

The API needs `SERVER_SIGNING_SECRET` (a Stellar secret key used to sign SEP-10 challenges) and `JWT_SECRET` in `apps/api/.env`. Use testnet keys only.

Demo credentials use comma-separated `<id>:<value>` pairs:

- API `INTEGRATOR_API_KEYS`: integrator id and raw API key (at least 24 characters), e.g. `int_wallet:<key>,int_payments:<key>`. Keys are hashed at startup.
- API `MERCHANT_ACCOUNTS`: merchant id and the Stellar public key it signs SEP-10 challenges with, e.g. `mer_andes:G...,mer_rio:G...,mer_azteca:G...`.
- Web `PUBLIC_API_URL`: API base URL, inlined at build time (default `http://localhost:8787`). Set it in the environment or in `apps/web/.env`.

The web is a static Astro site; only the quote demo and the merchant dashboard ship JavaScript (Preact islands). The landing quote demo calls the API's public demo endpoints (`GET /v1/demo/corridors`, `POST /v1/demo/quote`), which are unauthenticated and rate limited per IP, so the web holds no integrator key. If the API is unreachable, the demo falls back to local demo pricing.

CI (`.github/workflows/ci.yml`) runs `pnpm typecheck`, `pnpm test` and the web build on every pull request.

## Current status

| Area | In code today | Planned |
| --- | --- | --- |
| Domain model | Countries, fiat currencies, rails, integrators, merchants, all-in quotes, QR payments, one order lifecycle (demo data) | Persistent storage |
| API | `/v1` integrator API (hashed API keys, corridors, quotes, orders, prefunded balance and fee debit), merchant SEP-10 login, simulated escrow lifecycle with a 7-day reward lock | Real Soroban escrow, webhooks, integrator SDK |
| Web | English B2B landing, corridor quote demo, merchant dashboard (orders and rewards) | Integrator dashboard |
| Escrow | Soroban per-order escrow v1 deployed on testnet; buy, sell, dispute and expiry flows verified on-chain ([deployments](contracts/deployments/testnet.md)) | API integration, mainnet deployment, merchant reward vault and insurance fund contracts ([contracts/README.md](contracts/README.md)) |
| Identity | Not implemented | KYC, liveness and social-proof providers behind ports |
| Regulation | Out of MVP scope | Licensing requirements will be assessed per country |

All prices and offers in the current code are demo data on testnet.

## Documentation

- [Business model](docs/business-model.md)
- [Architecture](docs/architecture.md)
- [Order lifecycle](docs/order-lifecycle.md)
- [Contributing](CONTRIBUTING.md)
- [Contracts](contracts/README.md)
- [Legacy prototype](legacy/README.md)

## License

[Apache 2.0](LICENSE).
