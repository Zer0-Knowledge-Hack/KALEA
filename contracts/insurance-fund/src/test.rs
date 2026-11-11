#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    Event as _, IntoVal,
};

const UNIT: i128 = 10_000_000; // 1 USDC, 7 decimals
const START: u64 = 1_700_000_000;

struct S<'a> {
    env: Env,
    fund: KaleaInsuranceFundClient<'a>,
    token: TokenClient<'a>,
    admin: Address,
    recipient: Address,
}

fn setup() -> S<'static> {
    let env = Env::default();
    env.ledger().with_mut(|l| l.timestamp = START);
    let g = || Address::generate(&env);
    let (admin, recipient) = (g(), g());
    let sac = env.register_stellar_asset_contract_v2(g());
    let fund_id = env.register(KaleaInsuranceFund, (admin.clone(), sac.address()));
    env.mock_all_auths();
    StellarAssetClient::new(&env, &sac.address()).mint(&fund_id, &(1_000 * UNIT));
    env.set_auths(&[]);
    let fund = KaleaInsuranceFundClient::new(&env, &fund_id);
    let token = TokenClient::new(&env, &sac.address());
    S {
        env,
        fund,
        token,
        admin,
        recipient,
    }
}

fn auth_payout(s: &S, to: &Address, amount: i128, case_ref: &BytesN<32>) {
    s.env.mock_auths(&[MockAuth {
        address: &s.admin,
        invoke: &MockAuthInvoke {
            contract: &s.fund.address,
            fn_name: "payout",
            args: (to.clone(), amount, case_ref.clone()).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
}

fn case_ref(env: &Env, n: u8) -> BytesN<32> {
    BytesN::from_array(env, &[n; 32])
}

#[test]
fn constructor_stores_configuration() {
    let s = setup();
    assert_eq!(s.fund.get_admin(), s.admin);
    assert_eq!(s.fund.get_token(), s.token.address);
    assert_eq!(s.fund.balance(), 1_000 * UNIT);
}

#[test]
fn payout_moves_funds_and_names_the_case() {
    let s = setup();
    let reference = case_ref(&s.env, 7);
    auth_payout(&s, &s.recipient, 25 * UNIT, &reference);
    s.fund.payout(&s.recipient, &(25 * UNIT), &reference);

    assert_eq!(s.token.balance(&s.recipient), 25 * UNIT);
    assert_eq!(s.token.balance(&s.fund.address), 975 * UNIT);
    assert_eq!(s.fund.balance(), 975 * UNIT);
}

#[test]
fn payout_requires_the_admin_signature() {
    let s = setup();
    let reference = case_ref(&s.env, 1);
    s.env.set_auths(&[]);
    assert!(s
        .fund
        .try_payout(&s.recipient, &(25 * UNIT), &reference)
        .is_err());
    assert_eq!(s.fund.balance(), 1_000 * UNIT);
}

#[test]
fn payout_cannot_exceed_the_balance() {
    let s = setup();
    let reference = case_ref(&s.env, 2);
    auth_payout(&s, &s.recipient, 1_001 * UNIT, &reference);
    assert_eq!(
        s.fund.try_payout(&s.recipient, &(1_001 * UNIT), &reference),
        Err(Ok(Error::InsufficientBalance))
    );
    auth_payout(&s, &s.recipient, 1_000 * UNIT, &reference);
    s.fund.payout(&s.recipient, &(1_000 * UNIT), &reference);
    assert_eq!(s.fund.balance(), 0);
}

#[test]
fn payout_rejects_non_positive_amounts() {
    let s = setup();
    let reference = case_ref(&s.env, 3);
    auth_payout(&s, &s.recipient, 0, &reference);
    assert_eq!(
        s.fund.try_payout(&s.recipient, &0, &reference),
        Err(Ok(Error::InvalidAmount))
    );
    auth_payout(&s, &s.recipient, -1, &reference);
    assert_eq!(
        s.fund.try_payout(&s.recipient, &-1, &reference),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn payout_emits_the_case_reference() {
    let s = setup();
    let reference = case_ref(&s.env, 9);
    auth_payout(&s, &s.recipient, 5 * UNIT, &reference);
    s.fund.payout(&s.recipient, &(5 * UNIT), &reference);

    let expected = Payout {
        to: s.recipient.clone(),
        amount: 5 * UNIT,
        case_ref: reference,
    };
    assert_eq!(
        s.env
            .events()
            .all()
            .filter_by_contract(&s.fund.address)
            .events(),
        std::vec![expected.to_xdr(&s.env, &s.fund.address)]
    );
}
