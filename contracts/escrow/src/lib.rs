//! Kalea per-order USDC escrow (Soroban), v1.
//!
//! Implements the on-chain part of the canonical lifecycle in `docs/order-lifecycle.md`. The `created` status
//! lives in the API; an order exists on-chain from the moment the USDC provider locks funds.
//!
//! ```text
//! lock ──► EscrowLocked ──mark_paid──► FiatSent ──release──────────────► Released
//!              │   ├──cancel──► Cancelled      └──dispute / confirmation timeout──► Disputed
//!              │   └──expire (payment timeout)──► Expired               Disputed ──resolve──► Released | Cancelled
//! ```
//!
//! Roles per order (the same contract serves buys, sells and QR payments):
//! - **depositor**: provides the USDC and receives the fiat (the merchant on a buy, the end user on a sell).
//!   Only the depositor can confirm fiat receipt and release.
//! - **recipient**: receives the USDC and pays the fiat (the end user on a buy, the merchant on a sell).
//!   Marks the fiat as sent.
//! - **merchant**: whichever of the two is the liquidity provider; earns the reward.
//! - **operator**: Kalea's API key, acting for integrators (it can cancel before fiat is sent).
//! - **arbiter**: resolves disputes. **admin**: configuration only, never moves order funds.
//!
//! Amounts are fixed at lock: `recipient_amount + reward + insurance`. On release they go to the recipient, the
//! merchant reward vault and the insurance fund. Kalea's fee is never taken from the escrow: it is debited from
//! the integrator's prefunded balance.
//!
//! Security properties:
//! - Every transition requires the signature of the role allowed to make it.
//! - Strict state machine; `Released`, `Cancelled` and `Expired` are terminal, so an order settles exactly once.
//! - Once fiat is marked sent, the escrow is never refunded automatically: it can only be released or disputed.
//! - State is written before token transfers (checks-effects-interactions).
//! - Reward and insurance are capped relative to the recipient amount, so a bad quote cannot drain a lock.
//! - Pausing only blocks new locks; every exit path keeps working, so funds are never stuck.
//! - Single token fixed in the constructor (no front-runnable `init`); unique external reference per order;
//!   checked arithmetic (overflow checks are also on in release); two-step admin transfer.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, BytesN,
    ContractExecutable, Env,
};

#[cfg(test)]
mod test;

/// Reward cap: 3% of the recipient amount (the business model uses 1.5%).
pub const MAX_REWARD_BPS: i128 = 300;
/// Insurance cap: 0.5% of the recipient amount (the business model uses about 0.1%).
pub const MAX_INSURANCE_BPS: i128 = 50;
/// Bounds for `payment_timeout` and `confirmation_timeout`, in seconds.
pub const MIN_TIMEOUT_SECS: u64 = 60;
pub const MAX_TIMEOUT_SECS: u64 = 7 * 24 * 60 * 60;

const DAY_LEDGERS: u32 = 17_280; // ~5 s per ledger
const INSTANCE_BUMP: u32 = 30 * DAY_LEDGERS;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY_LEDGERS;
const ORDER_BUMP: u32 = 60 * DAY_LEDGERS;
const ORDER_THRESHOLD: u32 = ORDER_BUMP - DAY_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidAmount = 1,
    InvalidTimeout = 2,
    SameParties = 3,
    InvalidMerchant = 4,
    OrderNotFound = 5,
    InvalidState = 6,
    DeadlinePassed = 7,
    NotExpired = 8,
    Paused = 9,
    DuplicateRef = 10,
    NoPendingAdmin = 11,
    Overflow = 12,
    NotAllowed = 13,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Status {
    EscrowLocked,
    FiatSent,
    Disputed,
    Released,
    Cancelled,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Order {
    pub depositor: Address,
    pub recipient: Address,
    pub merchant: Address,
    pub recipient_amount: i128,
    pub reward: i128,
    pub insurance: i128,
    pub payment_deadline: u64,
    pub confirmation_timeout: u64,
    /// Set when the fiat is marked sent; 0 before that.
    pub confirmation_deadline: u64,
    /// Hash of the payment receipt attached when marking the fiat as sent (zeros before that).
    pub evidence: BytesN<32>,
    pub status: Status,
    pub external_ref: BytesN<32>,
}

impl Order {
    pub fn total(&self) -> Result<i128, Error> {
        self.recipient_amount
            .checked_add(self.reward)
            .and_then(|x| x.checked_add(self.insurance))
            .ok_or(Error::Overflow)
    }
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    pub arbiter: Address,
    pub operator: Address,
    pub token: Address,
    pub reward_vault: Address,
    pub insurance_fund: Address,
    pub paused: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LockParams {
    pub depositor: Address,
    pub recipient: Address,
    pub merchant: Address,
    pub recipient_amount: i128,
    pub reward: i128,
    pub insurance: i128,
    pub payment_timeout: u64,
    pub confirmation_timeout: u64,
    pub external_ref: BytesN<32>,
}

#[contracttype]
enum Key {
    Config,
    PendingAdmin,
    NextId,
    Order(u64),
    Ref(BytesN<32>),
}

// ---------- events ----------

#[contractevent]
pub struct Locked {
    #[topic]
    pub id: u64,
    pub depositor: Address,
    pub recipient: Address,
    pub merchant: Address,
    pub total: i128,
    pub payment_deadline: u64,
}

#[contractevent]
pub struct FiatSent {
    #[topic]
    pub id: u64,
    pub evidence: BytesN<32>,
    pub confirmation_deadline: u64,
}

#[contractevent]
pub struct Released {
    #[topic]
    pub id: u64,
    pub merchant: Address,
    pub recipient_amount: i128,
    pub reward: i128,
    pub insurance: i128,
}

#[contractevent]
pub struct Refunded {
    #[topic]
    pub id: u64,
    pub status: Status,
    pub amount: i128,
}

#[contractevent]
pub struct Disputed {
    #[topic]
    pub id: u64,
    pub by: Address,
}

#[contractevent]
pub struct ConfigChanged {
    pub paused: bool,
}

// ---------- helpers ----------

#[contract]
pub struct KaleaEscrow;

fn config(env: &Env) -> Config {
    env.storage().instance().get(&Key::Config).unwrap()
}

fn save_config(env: &Env, c: &Config) {
    env.storage().instance().set(&Key::Config, c);
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
    ConfigChanged { paused: c.paused }.publish(env);
}

fn load(env: &Env, id: u64) -> Result<Order, Error> {
    let key = Key::Order(id);
    let o: Order = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::OrderNotFound)?;
    env.storage()
        .persistent()
        .extend_ttl(&key, ORDER_THRESHOLD, ORDER_BUMP);
    Ok(o)
}

fn save(env: &Env, id: u64, o: &Order) {
    let key = Key::Order(id);
    env.storage().persistent().set(&key, o);
    env.storage()
        .persistent()
        .extend_ttl(&key, ORDER_THRESHOLD, ORDER_BUMP);
}

/// `part <= base * cap_bps / 10_000`, with checked arithmetic.
pub fn within_cap(part: i128, base: i128, cap_bps: i128) -> Result<bool, Error> {
    let lhs = part.checked_mul(10_000).ok_or(Error::Overflow)?;
    let rhs = base.checked_mul(cap_bps).ok_or(Error::Overflow)?;
    Ok(lhs <= rhs)
}

fn check_timeout(t: u64) -> Result<(), Error> {
    if (MIN_TIMEOUT_SECS..=MAX_TIMEOUT_SECS).contains(&t) {
        Ok(())
    } else {
        Err(Error::InvalidTimeout)
    }
}

/// Pays the release split. The order must already be saved as `Released`.
fn pay_release(env: &Env, c: &Config, id: u64, o: &Order) {
    let tk = token::Client::new(env, &c.token);
    let me = env.current_contract_address();
    tk.transfer(&me, &o.recipient, &o.recipient_amount);
    if o.reward > 0 {
        tk.transfer(&me, &c.reward_vault, &o.reward);
    }
    if o.insurance > 0 {
        tk.transfer(&me, &c.insurance_fund, &o.insurance);
    }
    Released {
        id,
        merchant: o.merchant.clone(),
        recipient_amount: o.recipient_amount,
        reward: o.reward,
        insurance: o.insurance,
    }
    .publish(env);
}

/// Returns the full locked amount to the depositor. The order must already be saved as `Cancelled` or `Expired`.
fn pay_refund(env: &Env, c: &Config, id: u64, o: &Order) -> Result<(), Error> {
    let total = o.total()?;
    token::Client::new(env, &c.token).transfer(
        &env.current_contract_address(),
        &o.depositor,
        &total,
    );
    Refunded {
        id,
        status: o.status,
        amount: total,
    }
    .publish(env);
    Ok(())
}

#[contractimpl]
impl KaleaEscrow {
    /// Runs once at deployment, so there is no `init` a third party could call first.
    pub fn __constructor(
        env: Env,
        admin: Address,
        arbiter: Address,
        operator: Address,
        token: Address,
        reward_vault: Address,
        insurance_fund: Address,
    ) {
        let c = Config {
            admin,
            arbiter,
            operator,
            token,
            reward_vault,
            insurance_fund,
            paused: false,
        };
        env.storage().instance().set(&Key::Config, &c);
        env.storage().instance().set(&Key::NextId, &0u64);
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
    }

    // ----- order lifecycle -----

    /// `created -> escrow_locked`: the USDC provider locks the fixed total. Returns the on-chain order id.
    pub fn lock(env: Env, p: LockParams) -> Result<u64, Error> {
        p.depositor.require_auth();
        let c = config(&env);
        if c.paused {
            return Err(Error::Paused);
        }
        if p.depositor == p.recipient {
            return Err(Error::SameParties);
        }
        if p.merchant != p.depositor && p.merchant != p.recipient {
            return Err(Error::InvalidMerchant);
        }
        if p.recipient_amount <= 0 || p.reward < 0 || p.insurance < 0 {
            return Err(Error::InvalidAmount);
        }
        if !within_cap(p.reward, p.recipient_amount, MAX_REWARD_BPS)?
            || !within_cap(p.insurance, p.recipient_amount, MAX_INSURANCE_BPS)?
        {
            return Err(Error::InvalidAmount);
        }
        check_timeout(p.payment_timeout)?;
        check_timeout(p.confirmation_timeout)?;
        let ref_key = Key::Ref(p.external_ref.clone());
        if env.storage().persistent().has(&ref_key) {
            return Err(Error::DuplicateRef);
        }
        let payment_deadline = env
            .ledger()
            .timestamp()
            .checked_add(p.payment_timeout)
            .ok_or(Error::Overflow)?;
        let id: u64 = env.storage().instance().get(&Key::NextId).unwrap_or(0);
        let next = id.checked_add(1).ok_or(Error::Overflow)?;
        let o = Order {
            depositor: p.depositor.clone(),
            recipient: p.recipient.clone(),
            merchant: p.merchant.clone(),
            recipient_amount: p.recipient_amount,
            reward: p.reward,
            insurance: p.insurance,
            payment_deadline,
            confirmation_timeout: p.confirmation_timeout,
            confirmation_deadline: 0,
            evidence: BytesN::from_array(&env, &[0; 32]),
            status: Status::EscrowLocked,
            external_ref: p.external_ref,
        };
        let total = o.total()?;

        // effects before the token interaction
        env.storage().instance().set(&Key::NextId, &next);
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
        save(&env, id, &o);
        env.storage().persistent().set(&ref_key, &id);
        env.storage()
            .persistent()
            .extend_ttl(&ref_key, ORDER_THRESHOLD, ORDER_BUMP);

        token::Client::new(&env, &c.token).transfer(
            &p.depositor,
            env.current_contract_address(),
            &total,
        );
        Locked {
            id,
            depositor: p.depositor,
            recipient: p.recipient,
            merchant: p.merchant,
            total,
            payment_deadline,
        }
        .publish(&env);
        Ok(id)
    }

    /// `escrow_locked -> fiat_sent`: the fiat payer (the recipient) marks the local payment as sent, before the
    /// payment deadline, attaching the receipt hash. From here the escrow is never refunded automatically.
    pub fn mark_paid(env: Env, id: u64, evidence: BytesN<32>) -> Result<(), Error> {
        let mut o = load(&env, id)?;
        o.recipient.require_auth();
        if o.status != Status::EscrowLocked {
            return Err(Error::InvalidState);
        }
        let now = env.ledger().timestamp();
        if now >= o.payment_deadline {
            return Err(Error::DeadlinePassed);
        }
        o.status = Status::FiatSent;
        o.confirmation_deadline = now
            .checked_add(o.confirmation_timeout)
            .ok_or(Error::Overflow)?;
        o.evidence = evidence.clone();
        save(&env, id, &o);
        FiatSent {
            id,
            evidence,
            confirmation_deadline: o.confirmation_deadline,
        }
        .publish(&env);
        Ok(())
    }

    /// `fiat_sent -> released`: the fiat recipient (the depositor) confirms receipt. Also valid while disputed
    /// (the depositor concedes).
    pub fn release(env: Env, id: u64) -> Result<(), Error> {
        let mut o = load(&env, id)?;
        o.depositor.require_auth();
        if o.status != Status::FiatSent && o.status != Status::Disputed {
            return Err(Error::InvalidState);
        }
        o.status = Status::Released;
        save(&env, id, &o);
        pay_release(&env, &config(&env), id, &o);
        Ok(())
    }

    /// `escrow_locked -> cancelled`: the counterparty (the recipient) or the operator acting for the integrator
    /// cancels before fiat is sent. The full total goes back to the depositor.
    pub fn cancel(env: Env, id: u64, caller: Address) -> Result<(), Error> {
        caller.require_auth();
        let c = config(&env);
        let mut o = load(&env, id)?;
        if caller != o.recipient && caller != c.operator {
            return Err(Error::NotAllowed);
        }
        if o.status != Status::EscrowLocked {
            return Err(Error::InvalidState);
        }
        o.status = Status::Cancelled;
        save(&env, id, &o);
        pay_refund(&env, &c, id, &o)
    }

    /// `escrow_locked -> expired`: after the payment timeout, anyone can return the funds to the depositor (the
    /// only possible destination).
    pub fn expire(env: Env, id: u64) -> Result<(), Error> {
        let mut o = load(&env, id)?;
        if o.status != Status::EscrowLocked {
            return Err(Error::InvalidState);
        }
        if env.ledger().timestamp() < o.payment_deadline {
            return Err(Error::NotExpired);
        }
        o.status = Status::Expired;
        save(&env, id, &o);
        pay_refund(&env, &config(&env), id, &o)
    }

    /// `fiat_sent -> disputed`: either party can dispute at any time; after the confirmation timeout anyone can
    /// (the canonical "confirmation_timeout -> disputed" rule).
    pub fn dispute(env: Env, id: u64, caller: Address) -> Result<(), Error> {
        caller.require_auth();
        let mut o = load(&env, id)?;
        if o.status != Status::FiatSent {
            return Err(Error::InvalidState);
        }
        let party = caller == o.depositor || caller == o.recipient;
        if !party && env.ledger().timestamp() < o.confirmation_deadline {
            return Err(Error::NotAllowed);
        }
        o.status = Status::Disputed;
        save(&env, id, &o);
        Disputed { id, by: caller }.publish(&env);
        Ok(())
    }

    /// `disputed -> released | cancelled`, decided by the arbiter.
    pub fn resolve(env: Env, id: u64, fiat_was_paid: bool) -> Result<(), Error> {
        let c = config(&env);
        c.arbiter.require_auth();
        let mut o = load(&env, id)?;
        if o.status != Status::Disputed {
            return Err(Error::InvalidState);
        }
        if fiat_was_paid {
            o.status = Status::Released;
            save(&env, id, &o);
            pay_release(&env, &c, id, &o);
            Ok(())
        } else {
            o.status = Status::Cancelled;
            save(&env, id, &o);
            pay_refund(&env, &c, id, &o)
        }
    }

    // ----- administration (never moves order funds) -----

    pub fn set_paused(env: Env, paused: bool) {
        let mut c = config(&env);
        c.admin.require_auth();
        c.paused = paused;
        save_config(&env, &c);
    }

    pub fn set_arbiter(env: Env, arbiter: Address) {
        let mut c = config(&env);
        c.admin.require_auth();
        c.arbiter = arbiter;
        save_config(&env, &c);
    }

    pub fn set_operator(env: Env, operator: Address) {
        let mut c = config(&env);
        c.admin.require_auth();
        c.operator = operator;
        save_config(&env, &c);
    }

    pub fn set_reward_vault(env: Env, reward_vault: Address) {
        let mut c = config(&env);
        c.admin.require_auth();
        c.reward_vault = reward_vault;
        save_config(&env, &c);
    }

    pub fn set_insurance_fund(env: Env, insurance_fund: Address) {
        let mut c = config(&env);
        c.admin.require_auth();
        c.insurance_fund = insurance_fund;
        save_config(&env, &c);
    }

    /// Step 1 of the admin transfer: the current admin proposes.
    pub fn propose_admin(env: Env, new_admin: Address) {
        config(&env).admin.require_auth();
        env.storage().instance().set(&Key::PendingAdmin, &new_admin);
    }

    /// Step 2: the proposed admin accepts by signing (a mistyped address can never take control).
    pub fn accept_admin(env: Env) -> Result<(), Error> {
        let pending: Address = env
            .storage()
            .instance()
            .get(&Key::PendingAdmin)
            .ok_or(Error::NoPendingAdmin)?;
        pending.require_auth();
        let mut c = config(&env);
        c.admin = pending;
        env.storage().instance().remove(&Key::PendingAdmin);
        save_config(&env, &c);
        Ok(())
    }

    /// Upgrades the contract code (admin only). Storage and funds are kept.
    pub fn upgrade(env: Env, wasm_hash: BytesN<32>) {
        config(&env).admin.require_auth();
        env.deployer()
            .update_current_contract(ContractExecutable::Wasm(wasm_hash));
    }

    // ----- reads -----

    pub fn get_order(env: Env, id: u64) -> Result<Order, Error> {
        load(&env, id)
    }

    pub fn order_by_ref(env: Env, external_ref: BytesN<32>) -> Result<u64, Error> {
        env.storage()
            .persistent()
            .get(&Key::Ref(external_ref))
            .ok_or(Error::OrderNotFound)
    }

    pub fn get_config(env: Env) -> Config {
        config(&env)
    }
}
