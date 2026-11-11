//! Kalea insurance fund (Soroban), v1.
//!
//! Receives the ~0.1% insurance contribution from every released order. The fund admin, meant to
//! be a multisig, pays a resolved dispute loss to a named recipient. The token balance is the fund
//! balance: contributions arrive through ordinary token transfers from the escrow.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, BytesN, Env,
};

const DAY_LEDGERS: u32 = 17_280; // ~5 s per ledger
const INSTANCE_BUMP: u32 = 30 * DAY_LEDGERS;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidAmount = 1,
    InsufficientBalance = 2,
    NotInitialized = 3,
}

#[contracttype]
enum Key {
    Admin,
    Token,
}

#[contractevent]
pub struct Payout {
    #[topic]
    pub to: Address,
    pub amount: i128,
    pub case_ref: BytesN<32>,
}

#[contract]
pub struct KaleaInsuranceFund;

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
}

fn admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&Key::Admin)
        .expect("insurance fund is not initialized")
}

fn token_address(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&Key::Token)
        .expect("insurance fund is not initialized")
}

#[contractimpl]
impl KaleaInsuranceFund {
    /// Runs once at deployment. `admin` is meant to be a multisig that controls payouts.
    pub fn __constructor(env: Env, admin: Address, token: Address) {
        env.storage().instance().set(&Key::Admin, &admin);
        env.storage().instance().set(&Key::Token, &token);
        bump_instance(&env);
    }

    /// Pays a resolved dispute loss. Admin only, never more than the fund balance. The case
    /// reference is emitted so the payout is attributable to a dispute record.
    pub fn payout(env: Env, to: Address, amount: i128, case_ref: BytesN<32>) -> Result<(), Error> {
        admin(&env).require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let me = env.current_contract_address();
        let token = token::Client::new(&env, &token_address(&env));
        if amount > token.balance(&me) {
            return Err(Error::InsufficientBalance);
        }

        token.transfer(&me, &to, &amount);
        bump_instance(&env);
        Payout {
            to,
            amount,
            case_ref,
        }
        .publish(&env);
        Ok(())
    }

    pub fn balance(env: Env) -> i128 {
        token::Client::new(&env, &token_address(&env)).balance(&env.current_contract_address())
    }

    pub fn get_admin(env: Env) -> Address {
        admin(&env)
    }

    pub fn get_token(env: Env) -> Address {
        token_address(&env)
    }
}

#[cfg(test)]
mod test;
