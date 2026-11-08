# SCF application

Kalea is applying to the **Stellar Community Fund (SCF) Instaward** track ($5K, 30 days) to build the first testnet version of its B2B fiat <-> USDC ramp for LATAM.

Confirm the current call, conditions and submission channel with the regional Stellar Ambassadors chapter and the SCF portal before submitting. [Stellar Community Fund](https://communityfund.stellar.org/)

## Summary for the form

> Kalea is B2B fiat <-> USDC ramp infrastructure on Stellar for Latin America. Integrators such as wallets, payment collection and SaaS platforms embed one API to offer local-currency on-ramps and off-ramps. Local fiat moves directly between end users and independent merchants under their own accounts; Kalea settles only Stellar USDC through a per-order Soroban escrow with fixed amounts and timeouts. Kalea charges integrators only, through a per-transaction fee from a prefunded USDC balance.

## Use of funds

The full $5K goes to development. No salaries and no marketing spend.

| Item | Purpose |
| --- | --- |
| Services | Hosting, RPC/infrastructure and third-party services needed for the testnet MVP |
| AI tooling | Development and review tooling |
| Traction work | Integrator and merchant interviews, pilot preparation |

TODO (open decision): amount per item.

## 30-day plan

| Week | Deliverable | Evidence |
| --- | --- | --- |
| 1 | Restructured repo: English B2B docs, shared domain model, one order lifecycle | Merged pull requests, passing CI |
| 2 | `/v1` integrator API: API keys, quotes per country, orders, prefunded balance and fee debit | API tests, example requests |
| 3 | Soroban per-order escrow on testnet: lock, release with fee/reward/insurance split, refund on timeout | Contract tests, testnet transaction hashes |
| 4 | End-to-end demo of one buy and one sell; integrator and merchant interviews | Demo video, interview notes with dates |

## How Stellar is used

- USDC on Stellar as the settlement asset for every order.
- Soroban for the per-order escrow, the merchant reward vault and the insurance fund.
- SEP-10 for merchant authentication.
- A diagram of the fiat/on-chain boundary is in [architecture.md](architecture.md).

## Market

Kalea targets multiple LATAM countries through one integrator API. Bolivia is one example of a first corridor; the corridor order is not fixed. TODO (open decision): first corridors for the pilot.

## Demo script

1. State the problem in one sentence: businesses need local-currency ramps across LATAM without becoming exchanges.
2. Request a quote for a country and show the all-in price.
3. Create a buy order: the merchant locks USDC in the testnet escrow, the end user marks fiat sent, the merchant confirms and the escrow releases. Show the transaction hashes.
4. Show the merchant receipt with exact amounts and the separate "earned X USDC" line.
5. Repeat briefly for a sell order, and show a timeout refund.
6. Close with the funded milestones and what is simulated versus on testnet.

## Pilot metrics

Capture a baseline before setting targets. Suggested metrics: share of quotes with an available merchant, share of orders released, time to release, and number of cancellations, expirations and disputes. State the period, denominator and source of each metric.

## Risks

| Risk | Mitigation |
| --- | --- |
| Merchant liquidity per country | Recruit merchants per corridor before opening it |
| Fiat payment fraud | Escrow-first flow, 7-day reward lock, insurance fund, identity providers |
| Disputes | Defined dispute flow and evidence log ([order-lifecycle.md](order-lifecycle.md)) |
| Regulation | Out of MVP scope; requirements will be assessed per country before real funds |

## Before submitting

- Verify the demo from a signed-out session and record the tested commit SHA.
- Confirm team members, roles and verifiable links.
- Replace every TODO above with approved figures.
