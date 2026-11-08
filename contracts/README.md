# Soroban contracts: kalea-escrow

This directory will hold Kalea's Soroban smart contract implementation: **`kalea-escrow`**.

> **Status:** Implementation in progress in [PR #5](https://github.com/Zer0-Knowledge-Hack/KALEA/pull/5) on branch `feat/soroban-escrow`.

---

## 1. Role and Design Principles

The contract serves as a minimal, non-custodial per-order USDC escrow. Following Kalea's architectural boundaries:
- **Lightweight on-chain state:** The contract does NOT handle merchant matching, reputation scoring, fiat verification, or integrator fees. Those responsibilities remain strictly off-chain in the API and domain layers.
- **USDC settlement only:** Local fiat never touches Stellar or the contract; it flows strictly peer-to-peer over local payment rails between the end user and the merchant.

---

## 2. Order Escrow (`kalea-escrow`)

- **Single token:** Fixed to Stellar USDC (SAC / SEP-41).
- **Fixed amounts:** Set when locked (`recipient_amount + reward + insurance`).
- **Configurable timeouts:**
  - `payment_timeout`: If fiat is not marked sent, funds can be expired and refunded to the depositor.
  - `confirmation_timeout`: If fiat was marked sent but not confirmed, freezes to `Disputed`.
- **Atomic split on release:**
  1. `recipient`: Net USDC payout (end user on buy, merchant on sell).
  2. `merchant_reward_vault`: 1.5% merchant reward (locked in 7-day cycles for fraud buffer and retention).
  3. `insurance_fund`: ~0.1% dispute coverage fund.
- **Disputes:** Freezes the escrow; resolved by an authorized arbiter.
- **Symmetrical Buy/Sell:** The same contract handles Buy (on-ramp), Sell (off-ramp) and QR payments with inverted roles.

---

## 3. Gasless UX: Fee Sponsorship via CAP-0015 & Pollar

Interactions with `kalea-escrow` (`lock`, `mark_fiat_sent`, `release`, `cancel`, `expire`) are designed to be zero-gas for end users and merchants:
- Users sign inner transactions using their standard ed25519 keys (Freighter or mobile wallet).
- A relayer service (**Pollar / `pollar.xyz`**, planned) wraps transactions using Stellar's native **Fee-Bump Transactions ([CAP-0015](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0015.md))** and pays network fees.
- **Current status:** Architectural design planned; actual relayer SDK integration will follow MVP testnet deployment.

The detailed lifecycle these contracts enforce is documented in [docs/order-lifecycle.md](../docs/order-lifecycle.md).
