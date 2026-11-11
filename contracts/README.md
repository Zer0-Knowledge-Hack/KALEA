# Soroban contracts: escrow, reward vault and insurance fund

> **Status:** `escrow/`, `reward-vault/` and `insurance-fund/` implement the lifecycle below. The reward vault credits releases into a per-merchant ledger, and the insurance fund pays resolved dispute losses. A testnet redeploy of the new set is pending; see [Remaining gaps](#4-remaining-gaps).

---

## 1. Role and Design Principles

The contract serves as a minimal, non-custodial per-order USDC escrow. Following Kalea's architectural boundaries:
- **Lightweight on-chain state:** The contract does NOT handle merchant matching, reputation scoring, fiat verification, or integrator fees. Those responsibilities remain strictly off-chain in the API and domain layers.
- **USDC settlement only:** Local fiat never touches Stellar or the contract; it flows strictly peer-to-peer over local payment rails between the end user and the merchant.

---

## 2. Order Escrow (`kalea-escrow` v1)

Per-order USDC escrow following [docs/order-lifecycle.md](../docs/order-lifecycle.md).

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

### Function reference

| Function | Signer | Effect |
|---|---|---|
| `lock` | depositor | Locks recipient amount + reward + insurance, all fixed at creation. Merchant must be the depositor (buy) or the recipient (sell). |
| `mark_paid` | recipient | `escrow_locked -> fiat_sent` before `payment_timeout`, stores a 32-byte evidence hash. |
| `release` | depositor | `fiat_sent` or `disputed -> released`: recipient amount to the recipient, reward transferred to the reward vault and credited to the merchant, insurance to the insurance fund. |
| `cancel` | recipient or operator | `escrow_locked -> cancelled`, full refund. Not allowed after fiat is sent. |
| `expire` | anyone | `escrow_locked` after `payment_timeout -> expired`, full refund. Never refunds after fiat is sent. |
| `dispute` | either party; anyone after `confirmation_timeout` | `fiat_sent -> disputed`. |
| `resolve` | arbiter | `disputed -> released` or `cancelled`. |

### Security & Trust assumptions

- **Security:** `require_auth` per role, terminal states, state saved before transfers, reward capped at 3% and insurance at 0.5% of the recipient amount, minimum order of 1 USDC, timeouts between 60 s and 7 days, pause blocks only new locks, single token set in the constructor, external reference unique per depositor (nobody can squat another party's reference), checked arithmetic, two-step admin transfer, events for every role and config change. The Kalea fee is not in the escrow: it is debited from the integrator's prefunded balance.
- **Reward vault:** only the registered escrow can credit, merchants withdraw only vested rewards, and the arbiter can slash unvested rewards only. Vested rewards are never moved by a slash.
- **Insurance fund:** only the admin can pay out, and a payout can never exceed the fund balance; every payout carries its case reference.
- **Time-locked upgrades:** `propose_upgrade` (admin) announces a wasm hash, `upgrade` applies it only after 3 days, and `cancel_upgrade` withdraws it.
- **Trust assumptions:**
  - The arbiter decides disputed orders.
  - The admin, meant to be a multisig, can change the code after the upgrade delay.
  - If the recipient cannot receive USDC (no trustline, or frozen by the issuer), `release` fails. The order can then be disputed and the arbiter refunds the depositor. The API must check the recipient's trustline before `lock`.

### Verification

Tests: 63 (45 escrow, 12 reward vault, 6 insurance fund), including buy and sell flows, every deadline edge, calls with no signatures and with the wrong signer, a frozen recipient, reference squatting, the upgrade time lock, vault vesting and slashing, insurance payouts, and a fund-conservation invariant over mixed orders. Mutation check: the security controls are exercised by dedicated negative tests.

The review followed the security checklist of the official Stellar skill ([stellar/stellar-dev-skill](https://github.com/stellar/stellar-dev-skill)). CI builds the wasm with `source_repo` metadata (SEP-55).

```bash
cargo test
stellar contract build
```

---

## 2.1 Merchant reward vault (`kalea-reward-vault` v1)

Per-merchant reward ledger with a 7-day vesting period. The escrow transfers the reward USDC into
the vault and calls `credit(merchant, reward)` in the same transaction.

| Function | Signer | Effect |
|---|---|---|
| `credit` | registered escrow | Adds a reward entry that vests after seven days. |
| `withdraw` | merchant | Pays every vested entry to the merchant and removes it from the ledger. |
| `slash` | arbiter | Applies a resolved dispute loss to unvested entries only; vested rewards are untouched. |
| `vested` / `unvested` / `total` | anyone | Read the merchant ledger. |
| `set_escrow` / `set_arbiter` | admin | Rotates the escrow or arbiter. Admin never moves rewards. |

Unvested entries are slashed oldest-first, which keeps the result deterministic. The vault stores
one persistent ledger per merchant and extends its TTL on every read or write.

## 2.2 Insurance fund (`kalea-insurance-fund` v1)

Receives the ~0.1% insurance contribution from each release. The admin, meant to be a multisig,
pays resolved dispute losses:

| Function | Signer | Effect |
|---|---|---|
| `payout(to, amount, case_ref)` | admin | Transfers covered losses up to the fund balance and emits the case reference. |
| `balance` | anyone | Returns the token balance held by the fund. |

The token balance is the fund balance: contributions arrive through ordinary token transfers from
the escrow, so there is no separate deposit ledger to reconcile.

---

## 3. Gasless UX: Fee Sponsorship via CAP-0015 & Pollar

Interactions with `kalea-escrow` (`lock`, `mark_paid`, `release`, `cancel`, `expire`) are designed to be zero-gas for end users and merchants:
- Users sign inner transactions using their standard ed25519 keys (Freighter or mobile wallet).
- A relayer service (**Pollar / `pollar.xyz`**, planned) wraps transactions using Stellar's native **Fee-Bump Transactions ([CAP-0015](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0015.md))** and pays network fees.
- **Current status:** Architectural design planned; actual relayer SDK integration will follow MVP testnet deployment.

The detailed lifecycle these contracts enforce is documented in [docs/order-lifecycle.md](../docs/order-lifecycle.md).

---

## 4. Remaining gaps

1. Default `payment_timeout` and `confirmation_timeout` values and who acts as arbiter are open decisions in the team docs.
2. The new escrow, reward vault and insurance fund set must be redeployed to testnet with explorer links.
3. Static analyzers (Scout, OpenZeppelin detectors), GitHub build attestation and an external audit are not done yet.
