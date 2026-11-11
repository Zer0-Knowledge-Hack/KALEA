//! Kalea merchant reward vault (Soroban), v1.
//!
//! The escrow credits a merchant reward when an order is released. The reward is held here for a
//! 7-day vesting period and can then be withdrawn by the merchant. A resolved dispute can slash
//! **unvested** rewards only, so already-vested merchant funds are never touched.
//!
//! Roles:
//! - **escrow**: the only address allowed to call `credit`.
//! - **merchant**: withdraws its own vested rewards.
//! - **arbiter**: applies a resolved dispute loss against unvested rewards.
//! - **admin**: configuration only; it never moves rewards, but it can rotate the escrow and arbiter.
//!
//! The vault holds USDC (the configured token). `credit` only records the ledger entry: the caller
//! must transfer the reward to the vault in the same transaction, which the escrow does on release.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env, Vec,
};

/// Rewards vest seven days after the release that credited them.
pub const VESTING_PERIOD_SECS: u64 = 7 * 24 * 60 * 60;

const DAY_LEDGERS: u32 = 17_280; // ~5 s per ledger
const INSTANCE_BUMP: u32 = 30 * DAY_LEDGERS;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY_LEDGERS;
const CREDITS_BUMP: u32 = 60 * DAY_LEDGERS;
const CREDITS_THRESHOLD: u32 = CREDITS_BUMP - DAY_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidAmount = 1,
    InsufficientUnvested = 2,
    NothingToWithdraw = 3,
    Overflow = 4,
    NotInitialized = 5,
}

/// One reward credit. `vest_at` is the ledger timestamp at which it becomes withdrawable.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Credit {
    pub amount: i128,
    pub vest_at: u64,
}

#[contracttype]
enum Key {
    Admin,
    Arbiter,
    Escrow,
    Token,
    Credits(Address),
}

#[contractevent]
pub struct Credited {
    #[topic]
    pub merchant: Address,
    pub amount: i128,
    pub vest_at: u64,
}

#[contractevent]
pub struct Withdrawn {
    #[topic]
    pub merchant: Address,
    pub amount: i128,
}

#[contractevent]
pub struct Slashed {
    #[topic]
    pub merchant: Address,
    pub amount: i128,
    pub to: Address,
}

#[contractevent]
pub struct EscrowChanged {
    pub escrow: Address,
}

#[contractevent]
pub struct ArbiterChanged {
    pub arbiter: Address,
}

#[contract]
pub struct KaleaRewardVault;

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
}

fn admin(env: &Env) -> Address {
    env.storage().instance().get(&Key::Admin).unwrap()
}

fn arbiter(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&Key::Arbiter)
        .ok_or(Error::NotInitialized)
}

fn escrow(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&Key::Escrow)
        .ok_or(Error::NotInitialized)
}

fn token_address(env: &Env) -> Address {
    env.storage().instance().get(&Key::Token).unwrap()
}

fn load_credits(env: &Env, merchant: &Address) -> Vec<Credit> {
    let key = Key::Credits(merchant.clone());
    let credits = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));
    if env.storage().persistent().has(&key) {
        env.storage()
            .persistent()
            .extend_ttl(&key, CREDITS_THRESHOLD, CREDITS_BUMP);
    }
    credits
}

fn save_credits(env: &Env, merchant: &Address, credits: &Vec<Credit>) {
    let key = Key::Credits(merchant.clone());
    env.storage().persistent().set(&key, credits);
    env.storage()
        .persistent()
        .extend_ttl(&key, CREDITS_THRESHOLD, CREDITS_BUMP);
}

fn vested_of(credits: &Vec<Credit>, now: u64) -> Result<i128, Error> {
    let mut total = 0i128;
    for credit in credits.iter() {
        if credit.vest_at <= now {
            total = total.checked_add(credit.amount).ok_or(Error::Overflow)?;
        }
    }
    Ok(total)
}

fn unvested_of(credits: &Vec<Credit>, now: u64) -> Result<i128, Error> {
    let mut total = 0i128;
    for credit in credits.iter() {
        if credit.vest_at > now {
            total = total.checked_add(credit.amount).ok_or(Error::Overflow)?;
        }
    }
    Ok(total)
}

#[contractimpl]
impl KaleaRewardVault {
    /// Runs once at deployment. `escrow` is set separately by the admin, so the vault can be
    /// deployed before the escrow and the escrow can point at the vault in its constructor.
    pub fn __constructor(env: Env, admin: Address, arbiter: Address, token: Address) {
        env.storage().instance().set(&Key::Admin, &admin);
        env.storage().instance().set(&Key::Arbiter, &arbiter);
        env.storage().instance().set(&Key::Token, &token);
        bump_instance(&env);
    }

    /// Registers the escrow allowed to credit rewards. Admin only; the escrow never needs to sign
    /// an end-user transaction from here.
    pub fn set_escrow(env: Env, escrow: Address) -> Result<(), Error> {
        admin(&env).require_auth();
        env.storage().instance().set(&Key::Escrow, &escrow);
        bump_instance(&env);
        EscrowChanged { escrow }.publish(&env);
        Ok(())
    }

    /// Rotates the dispute arbiter. Admin only.
    pub fn set_arbiter(env: Env, arbiter: Address) -> Result<(), Error> {
        admin(&env).require_auth();
        env.storage().instance().set(&Key::Arbiter, &arbiter);
        bump_instance(&env);
        ArbiterChanged { arbiter }.publish(&env);
        Ok(())
    }

    /// Credits one reward to a merchant. Only the registered escrow may call this, in the same
    /// transaction that transfers the reward USDC into the vault.
    pub fn credit(env: Env, merchant: Address, amount: i128) -> Result<(), Error> {
        escrow(&env)?.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let now = env.ledger().timestamp();
        let vest_at = now
            .checked_add(VESTING_PERIOD_SECS)
            .ok_or(Error::Overflow)?;
        let mut credits = load_credits(&env, &merchant);
        credits.push_back(Credit { amount, vest_at });
        save_credits(&env, &merchant, &credits);
        bump_instance(&env);
        Credited {
            merchant,
            amount,
            vest_at,
        }
        .publish(&env);
        Ok(())
    }

    /// Pays every vested reward to the merchant. Unvested entries stay in the ledger.
    pub fn withdraw(env: Env, merchant: Address) -> Result<i128, Error> {
        merchant.require_auth();
        let now = env.ledger().timestamp();
        let credits = load_credits(&env, &merchant);
        let vested = vested_of(&credits, now)?;
        if vested == 0 {
            return Err(Error::NothingToWithdraw);
        }

        let mut remaining = Vec::new(&env);
        for credit in credits.iter() {
            if credit.vest_at > now {
                remaining.push_back(credit);
            }
        }
        save_credits(&env, &merchant, &remaining);
        bump_instance(&env);

        token::Client::new(&env, &token_address(&env)).transfer(
            &env.current_contract_address(),
            &merchant,
            &vested,
        );
        Withdrawn {
            merchant,
            amount: vested,
        }
        .publish(&env);
        Ok(vested)
    }

    /// Applies a resolved dispute loss to unvested rewards. Vested rewards are never touched.
    /// Unvested entries are consumed oldest-first, which keeps the ledger deterministic.
    pub fn slash(env: Env, merchant: Address, amount: i128, to: Address) -> Result<(), Error> {
        arbiter(&env)?.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let now = env.ledger().timestamp();
        let credits = load_credits(&env, &merchant);
        let unvested = unvested_of(&credits, now)?;
        if amount > unvested {
            return Err(Error::InsufficientUnvested);
        }

        let mut remaining_to_slash = amount;
        let mut kept = Vec::new(&env);
        for credit in credits.iter() {
            if remaining_to_slash > 0 && credit.vest_at > now {
                let take = if credit.amount < remaining_to_slash {
                    credit.amount
                } else {
                    remaining_to_slash
                };
                remaining_to_slash -= take;
                let left = credit.amount - take;
                if left > 0 {
                    kept.push_back(Credit {
                        amount: left,
                        vest_at: credit.vest_at,
                    });
                }
            } else {
                kept.push_back(credit);
            }
        }
        save_credits(&env, &merchant, &kept);
        bump_instance(&env);

        token::Client::new(&env, &token_address(&env)).transfer(
            &env.current_contract_address(),
            &to,
            &amount,
        );
        Slashed {
            merchant,
            amount,
            to,
        }
        .publish(&env);
        Ok(())
    }

    // ----- reads -----

    pub fn vested(env: Env, merchant: Address) -> Result<i128, Error> {
        let now = env.ledger().timestamp();
        vested_of(&load_credits(&env, &merchant), now)
    }

    pub fn unvested(env: Env, merchant: Address) -> Result<i128, Error> {
        let now = env.ledger().timestamp();
        unvested_of(&load_credits(&env, &merchant), now)
    }

    pub fn total(env: Env, merchant: Address) -> Result<i128, Error> {
        let now = env.ledger().timestamp();
        let credits = load_credits(&env, &merchant);
        vested_of(&credits, now)?
            .checked_add(unvested_of(&credits, now)?)
            .ok_or(Error::Overflow)
    }

    pub fn get_admin(env: Env) -> Address {
        admin(&env)
    }

    pub fn get_arbiter(env: Env) -> Result<Address, Error> {
        arbiter(&env)
    }

    pub fn get_escrow(env: Env) -> Result<Address, Error> {
        escrow(&env)
    }

    pub fn get_token(env: Env) -> Address {
        token_address(&env)
    }
}

#[cfg(test)]
mod test;
