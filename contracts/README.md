# Soroban contracts

> **Status:** `escrow/` v0 is implemented, tested (33 tests) and deployed on testnet ([deployments/testnet.md](deployments/testnet.md)). It does not yet match the canonical lifecycle below; see [Gaps](#gaps-between-escrow-v0-and-the-canonical-lifecycle).

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

## Implemented: `escrow` v0

Generic per-order escrow: a depositor locks USDC for a beneficiary while fiat moves off-chain.

- `create` (depositor), `release` (depositor, i.e. the fiat recipient), `cancel` (beneficiary), `dispute` (beneficiary), `resolve` (arbiter), `refund` (anyone, after expiry, only back to the depositor).
- Security: `require_auth` per role, terminal states, state saved before transfers, fee fixed per order with a 1% cap, pause blocks only new orders, single token set in the constructor, unique external reference, checked arithmetic (also in release), two-step admin transfer.
- 33 tests, including a fund-conservation invariant, plus a mutation check: removing each of 7 security controls makes the suite fail.

```bash
cargo test
stellar contract build
```

## Gaps between escrow v0 and the canonical lifecycle

1. No `fiat_sent` state. v0 has no "mark paid" step, so the `payment_timeout` refund and the "never auto-refund after fiat is sent" rule are not enforced.
2. Release split. v0 pays recipient + a Kalea fee to a treasury. Canonical: recipient + merchant reward (reward vault) + insurance fund, with fixed amounts set at creation. The Kalea fee is debited from the integrator balance, not from the escrow.
3. Disputes. v0 lets only the beneficiary dispute, before expiry, from `Locked`. Canonical: either party disputes from `fiat_sent`, and `confirmation_timeout` moves the order to `disputed`.
4. The merchant reward vault (7-day cycles) and the insurance fund contracts are not implemented.
