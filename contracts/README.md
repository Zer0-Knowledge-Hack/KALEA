# Soroban contracts

> **Not implemented yet.** This folder will hold Kalea's Soroban contracts.

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
