#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{
        storage::Instance as _, storage::Persistent as _, Address as _, Ledger, MockAuth,
        MockAuthInvoke,
    },
    token::{StellarAssetClient, TokenClient},
    IntoVal,
};

const UNIT: i128 = 10_000_000; // 1 USDC, 7 decimals
const DAY: u64 = 24 * 60 * 60;
const START: u64 = 1_700_000_000;

struct S<'a> {
    env: Env,
    vault: KaleaRewardVaultClient<'a>,
    token: TokenClient<'a>,
    admin: Address,
    arbiter: Address,
    escrow: Address,
    merchant: Address,
}

fn setup() -> S<'static> {
    let env = Env::default();
    env.ledger().with_mut(|l| l.timestamp = START);
    let g = || Address::generate(&env);
    let (admin, arbiter, escrow, merchant) = (g(), g(), g(), g());
    let sac = env.register_stellar_asset_contract_v2(g());
    let vault_id = env.register(
        KaleaRewardVault,
        (admin.clone(), arbiter.clone(), sac.address()),
    );
    let vault = KaleaRewardVaultClient::new(&env, &vault_id);
    // The escrow is configured after deployment, so the vault can be deployed first.
    env.mock_all_auths();
    vault.set_escrow(&escrow);
    StellarAssetClient::new(&env, &sac.address()).mint(&vault_id, &(10_000 * UNIT));
    env.set_auths(&[]);
    let token = TokenClient::new(&env, &sac.address());
    S {
        env,
        vault,
        token,
        admin,
        arbiter,
        escrow,
        merchant,
    }
}

fn credit(s: &S, merchant: &Address, amount: i128) {
    s.env.mock_auths(&[MockAuth {
        address: &s.escrow,
        invoke: &MockAuthInvoke {
            contract: &s.vault.address,
            fn_name: "credit",
            args: (merchant.clone(), amount).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    s.vault.credit(merchant, &amount);
}

fn auth_withdraw(s: &S, merchant: &Address) {
    s.env.mock_auths(&[MockAuth {
        address: merchant,
        invoke: &MockAuthInvoke {
            contract: &s.vault.address,
            fn_name: "withdraw",
            args: (merchant.clone(),).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
}

fn withdraw(s: &S, merchant: &Address) -> i128 {
    auth_withdraw(s, merchant);
    s.vault.withdraw(merchant)
}

fn auth_slash(s: &S, merchant: &Address, amount: i128, to: &Address) {
    s.env.mock_auths(&[MockAuth {
        address: &s.arbiter,
        invoke: &MockAuthInvoke {
            contract: &s.vault.address,
            fn_name: "slash",
            args: (merchant.clone(), amount, to.clone()).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
}

fn slash(s: &S, merchant: &Address, amount: i128, to: &Address) {
    auth_slash(s, merchant, amount, to);
    s.vault.slash(merchant, &amount, to);
}

fn advance(s: &S, secs: u64) {
    s.env.ledger().with_mut(|l| l.timestamp += secs);
}

#[test]
fn constructor_stores_configuration() {
    let s = setup();
    assert_eq!(s.vault.get_admin(), s.admin);
    assert_eq!(s.vault.get_arbiter(), s.arbiter.clone());
    assert_eq!(s.vault.get_escrow(), s.escrow.clone());
    assert_eq!(s.vault.get_token(), s.token.address);
}

#[test]
fn only_the_registered_escrow_can_credit() {
    let s = setup();
    credit(&s, &s.merchant, 10 * UNIT);
    assert_eq!(s.vault.unvested(&s.merchant), (10 * UNIT));

    s.env.set_auths(&[]);
    assert!(s.vault.try_credit(&s.merchant, &UNIT).is_err());
}

#[test]
fn credit_vests_seven_days_after_it_is_recorded() {
    let s = setup();
    credit(&s, &s.merchant, 100 * UNIT);
    assert_eq!(s.vault.vested(&s.merchant), (0));
    assert_eq!(s.vault.unvested(&s.merchant), (100 * UNIT));
    assert_eq!(s.vault.total(&s.merchant), (100 * UNIT));

    advance(&s, VESTING_PERIOD_SECS - 1);
    assert_eq!(s.vault.vested(&s.merchant), (0));
    advance(&s, 1);
    assert_eq!(s.vault.vested(&s.merchant), (100 * UNIT));
    assert_eq!(s.vault.unvested(&s.merchant), (0));
}

#[test]
fn credit_rejects_non_positive_amounts() {
    let s = setup();
    s.env.mock_auths(&[MockAuth {
        address: &s.escrow,
        invoke: &MockAuthInvoke {
            contract: &s.vault.address,
            fn_name: "credit",
            args: (s.merchant.clone(), 0i128).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    assert_eq!(
        s.vault.try_credit(&s.merchant, &0),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn merchant_cannot_withdraw_before_vesting() {
    let s = setup();
    credit(&s, &s.merchant, 100 * UNIT);
    s.env.mock_auths(&[MockAuth {
        address: &s.merchant,
        invoke: &MockAuthInvoke {
            contract: &s.vault.address,
            fn_name: "withdraw",
            args: (s.merchant.clone(),).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    assert_eq!(
        s.vault.try_withdraw(&s.merchant),
        Err(Ok(Error::NothingToWithdraw))
    );
    assert_eq!(s.token.balance(&s.vault.address), 10_000 * UNIT);
}

#[test]
fn merchant_withdraws_exactly_the_vested_amount_once() {
    let s = setup();
    credit(&s, &s.merchant, 100 * UNIT);
    advance(&s, VESTING_PERIOD_SECS);

    let before = s.token.balance(&s.merchant);
    assert_eq!(withdraw(&s, &s.merchant), 100 * UNIT);
    assert_eq!(s.token.balance(&s.merchant), before + 100 * UNIT);
    assert_eq!(
        s.token.balance(&s.vault.address),
        10_000 * UNIT - 100 * UNIT
    );
    assert_eq!(s.vault.total(&s.merchant), (0));
    auth_withdraw(&s, &s.merchant);
    assert_eq!(
        s.vault.try_withdraw(&s.merchant),
        Err(Ok(Error::NothingToWithdraw))
    );
}

#[test]
fn only_the_merchant_can_withdraw_its_rewards() {
    let s = setup();
    credit(&s, &s.merchant, 100 * UNIT);
    advance(&s, VESTING_PERIOD_SECS);
    s.env.set_auths(&[]);
    assert!(s.vault.try_withdraw(&s.merchant).is_err());
}

#[test]
fn slash_only_touches_unvested_rewards() {
    let s = setup();
    credit(&s, &s.merchant, 100 * UNIT);
    advance(&s, VESTING_PERIOD_SECS); // vested
    credit(&s, &s.merchant, 50 * UNIT); // unvested

    auth_slash(&s, &s.merchant, 0, &s.escrow);
    assert_eq!(
        s.vault.try_slash(&s.merchant, &0, &s.escrow),
        Err(Ok(Error::InvalidAmount))
    );
    auth_slash(&s, &s.merchant, 60 * UNIT, &s.escrow);
    assert_eq!(
        s.vault.try_slash(&s.merchant, &(60 * UNIT), &s.escrow),
        Err(Ok(Error::InsufficientUnvested))
    );
    slash(&s, &s.merchant, 40 * UNIT, &s.escrow);

    assert_eq!(s.vault.vested(&s.merchant), (100 * UNIT));
    assert_eq!(s.vault.unvested(&s.merchant), (10 * UNIT));
    assert_eq!(s.token.balance(&s.escrow), 40 * UNIT);

    // The vested principal is still withdrawable after the slash.
    assert_eq!(withdraw(&s, &s.merchant), 100 * UNIT);
}

#[test]
fn slash_consumes_unvested_entries_oldest_first() {
    let s = setup();
    credit(&s, &s.merchant, 100 * UNIT);
    advance(&s, 3 * DAY);
    credit(&s, &s.merchant, 50 * UNIT);

    slash(&s, &s.merchant, 120 * UNIT, &s.escrow);
    assert_eq!(s.vault.unvested(&s.merchant), (30 * UNIT));

    advance(&s, VESTING_PERIOD_SECS);
    assert_eq!(s.vault.vested(&s.merchant), (30 * UNIT));
    assert_eq!(withdraw(&s, &s.merchant), 30 * UNIT);
}

#[test]
fn only_the_arbiter_can_slash() {
    let s = setup();
    credit(&s, &s.merchant, 100 * UNIT);
    s.env.set_auths(&[]);
    assert!(s
        .vault
        .try_slash(&s.merchant, &(10 * UNIT), &s.escrow)
        .is_err());
}

#[test]
fn admin_rotates_the_escrow_and_arbiter() {
    let s = setup();
    let (new_escrow, new_arbiter) = (Address::generate(&s.env), Address::generate(&s.env));
    s.env.mock_all_auths();
    s.vault.set_escrow(&new_escrow);
    s.vault.set_arbiter(&new_arbiter);
    assert_eq!(s.vault.get_escrow(), new_escrow.clone());
    assert_eq!(s.vault.get_arbiter(), new_arbiter.clone());

    s.env.set_auths(&[]);
    assert!(s.vault.try_set_escrow(&new_escrow).is_err());
    assert!(s.vault.try_set_arbiter(&new_arbiter).is_err());
}

#[test]
fn ledger_ttls_are_extended_on_use() {
    let s = setup();
    credit(&s, &s.merchant, 100 * UNIT);
    let key = Key::Credits(s.merchant.clone());
    s.env.as_contract(&s.vault.address, || {
        s.env.storage().persistent().extend_ttl(&key, 0, 10);
        s.env.storage().instance().extend_ttl(0, 10);
    });
    let _ = s.vault.vested(&s.merchant);
    let persistent_after: u32 = s.env.as_contract(&s.vault.address, || {
        s.env.storage().persistent().get_ttl(&key)
    });
    let instance_after: u32 = s
        .env
        .as_contract(&s.vault.address, || s.env.storage().instance().get_ttl());
    assert!(persistent_after > 10);
    assert!(instance_after > 10);
}
