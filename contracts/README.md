# Soroban contracts

> **Status:** `escrow/` v1 implements the canonical lifecycle below, with 37 tests, and is deployed on testnet ([deployments/testnet.md](deployments/testnet.md)). The reward vault and insurance fund contracts are still pending; see [Remaining gaps](#remaining-gaps).

## Planned: per-order USDC escrow

- One escrow per order, in Stellar USDC.
- Fixed amounts set when the order is created.
- Configurable timeouts: refund to the depositor when an order expires before fiat is marked sent.
- On release, splits the locked amount between the recipient, the merchant reward vault and the insurance fund.
- Freezes on dispute until resolved.

## Planned: merchant reward vault

- Receives merchant rewards on release.
- Locks rewards in 7-day cycles before withdrawal (fraud buffer and retention).

## Planned: insurance fund

- Receives about 0.1% per order.
- Covers losses from resolved disputes.

The lifecycle these contracts enforce is defined in [docs/order-lifecycle.md](../docs/order-lifecycle.md).

## Implemented: `escrow` v1

Per-order USDC escrow following [docs/order-lifecycle.md](../docs/order-lifecycle.md).

| Function | Signer | Effect |
|---|---|---|
| `lock` | depositor | Locks recipient amount + reward + insurance, all fixed at creation. Merchant must be the depositor (buy) or the recipient (sell). |
| `mark_paid` | recipient | `escrow_locked -> fiat_sent` before `payment_timeout`, stores a 32-byte evidence hash. |
| `release` | depositor | `fiat_sent` or `disputed -> released`: recipient amount to the recipient, reward to the reward vault, insurance to the insurance fund. |
| `cancel` | recipient or operator | `escrow_locked -> cancelled`, full refund. Not allowed after fiat is sent. |
| `expire` | anyone | `escrow_locked` after `payment_timeout -> expired`, full refund. Never refunds after fiat is sent. |
| `dispute` | either party; anyone after `confirmation_timeout` | `fiat_sent -> disputed`. |
| `resolve` | arbiter | `disputed -> released` or `cancelled`. |

Security: `require_auth` per role, terminal states, state saved before transfers, reward capped at 3% and insurance at 0.5% of the recipient amount, timeouts between 60 s and 7 days, pause blocks only new locks, single token set in the constructor, unique external reference, checked arithmetic, two-step admin transfer. The Kalea fee is not in the escrow: it is debited from the integrator's prefunded balance.

Tests: 37, including buy and sell flows, every deadline edge, calls with no signatures and with the wrong signer, and a fund-conservation invariant over mixed orders. Mutation check: removing each of 16 security controls makes the suite fail, except the admin signature on `upgrade` (the test cannot upload a real wasm, so `upgrade` fails either way).

```bash
cargo test
stellar contract build
```

## Remaining gaps

1. The merchant reward vault (7-day cycles) and the insurance fund are plain accounts on testnet; their contracts are not implemented.
2. Default `payment_timeout` and `confirmation_timeout` values and who acts as arbiter are open decisions in the team docs.
3. `upgrade` lacks a test that proves the admin signature is required.
