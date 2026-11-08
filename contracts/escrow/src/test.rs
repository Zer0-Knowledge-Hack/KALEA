#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, Ledger, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    IntoVal, Symbol,
};

const UNIT: i128 = 10_000_000; // 1 USDC, 7 decimals
const PAY: u64 = 30 * 60; // payment_timeout
const CONF: u64 = 2 * 60 * 60; // confirmation_timeout
const START: u64 = 1_700_000_000;

struct S<'a> {
    env: Env,
    esc: KaleaEscrowClient<'a>,
    usdc: TokenClient<'a>,
    admin: Address,
    arbiter: Address,
    operator: Address,
    vault: Address,
    fund: Address,
    merchant: Address,
    user: Address,
}

fn setup() -> S<'static> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.timestamp = START);
    let g = || Address::generate(&env);
    let (admin, arbiter, operator, vault, fund, merchant, user) =
        (g(), g(), g(), g(), g(), g(), g());
    let sac = env.register_stellar_asset_contract_v2(g());
    StellarAssetClient::new(&env, &sac.address()).mint(&merchant, &(10_000 * UNIT));
    StellarAssetClient::new(&env, &sac.address()).mint(&user, &(10_000 * UNIT));
    let id = env.register(
        KaleaEscrow,
        (
            admin.clone(),
            arbiter.clone(),
            operator.clone(),
            sac.address(),
            vault.clone(),
            fund.clone(),
        ),
    );
    let esc = KaleaEscrowClient::new(&env, &id);
    let usdc = TokenClient::new(&env, &sac.address());
    S {
        env,
        esc,
        usdc,
        admin,
        arbiter,
        operator,
        vault,
        fund,
        merchant,
        user,
    }
}

fn rf(env: &Env, n: u8) -> BytesN<32> {
    BytesN::from_array(env, &[n; 32])
}

/// Business-model example: 100 USDC to the recipient + 1.5 reward + 0.1 insurance = 101.6 locked.
fn params(
    s: &S,
    depositor: &Address,
    recipient: &Address,
    merchant: &Address,
    n: u8,
) -> LockParams {
    LockParams {
        depositor: depositor.clone(),
        recipient: recipient.clone(),
        merchant: merchant.clone(),
        recipient_amount: 100 * UNIT,
        reward: 15 * UNIT / 10,
        insurance: UNIT / 10,
        payment_timeout: PAY,
        confirmation_timeout: CONF,
        external_ref: rf(&s.env, n),
    }
}

/// Buy (on-ramp): the merchant locks USDC, the end user pays fiat.
fn buy(s: &S, n: u8) -> u64 {
    s.esc.lock(&params(s, &s.merchant, &s.user, &s.merchant, n))
}

/// Sell (off-ramp): the end user locks USDC, the merchant pays fiat.
fn sell(s: &S, n: u8) -> u64 {
    s.esc.lock(&params(s, &s.user, &s.merchant, &s.merchant, n))
}

fn ev(s: &S) -> BytesN<32> {
    BytesN::from_array(&s.env, &[0xab; 32])
}

fn advance(s: &S, secs: u64) {
    s.env.ledger().with_mut(|l| l.timestamp += secs);
}

fn signed_by(s: &S, who: &Address, f: &str) -> bool {
    s.env.auths().iter().any(|(a, inv)| a == who && matches!(&inv.function, AuthorizedFunction::Contract((c, name, _)) if *c == s.esc.address && *name == Symbol::new(&s.env, f)))
}

fn status(s: &S, id: u64) -> Status {
    s.esc.get_order(&id).status
}

// ---------------- constructor ----------------

#[test]
fn constructor_stores_config() {
    let s = setup();
    let c = s.esc.get_config();
    assert_eq!(
        (
            c.admin,
            c.arbiter,
            c.operator,
            c.reward_vault,
            c.insurance_fund,
            c.token
        ),
        (
            s.admin.clone(),
            s.arbiter.clone(),
            s.operator.clone(),
            s.vault.clone(),
            s.fund.clone(),
            s.usdc.address.clone()
        )
    );
    assert!(!c.paused);
}

// ---------------- lock ----------------

#[test]
fn lock_takes_the_fixed_total_and_requires_the_depositor() {
    let s = setup();
    let id = buy(&s, 1);
    assert!(signed_by(&s, &s.merchant, "lock"));
    assert_eq!(id, 0);
    assert_eq!(s.usdc.balance(&s.esc.address), 1016 * UNIT / 10);
    assert_eq!(
        s.usdc.balance(&s.merchant),
        10_000 * UNIT - 1016 * UNIT / 10
    );
    let o = s.esc.get_order(&id);
    assert_eq!(o.status, Status::EscrowLocked);
    assert_eq!(o.payment_deadline, START + PAY);
    assert_eq!(o.confirmation_deadline, 0);
    assert_eq!(s.esc.order_by_ref(&rf(&s.env, 1)), id);
}

#[test]
fn ids_are_sequential() {
    let s = setup();
    assert_eq!(buy(&s, 1), 0);
    assert_eq!(sell(&s, 2), 1);
    assert_eq!(buy(&s, 3), 2);
}

#[test]
fn lock_validates_parties() {
    let s = setup();
    let other = Address::generate(&s.env);
    assert_eq!(
        s.esc
            .try_lock(&params(&s, &s.merchant, &s.merchant, &s.merchant, 1)),
        Err(Ok(Error::SameParties))
    );
    assert_eq!(
        s.esc.try_lock(&params(&s, &s.merchant, &s.user, &other, 1)),
        Err(Ok(Error::InvalidMerchant))
    );
}

#[test]
fn lock_validates_amounts_and_caps() {
    let s = setup();
    let base = params(&s, &s.merchant, &s.user, &s.merchant, 1);
    let mut p = base.clone();
    p.recipient_amount = 0;
    assert_eq!(s.esc.try_lock(&p), Err(Ok(Error::InvalidAmount)));
    let mut p = base.clone();
    p.reward = -1;
    assert_eq!(s.esc.try_lock(&p), Err(Ok(Error::InvalidAmount)));
    let mut p = base.clone();
    p.insurance = -1;
    assert_eq!(s.esc.try_lock(&p), Err(Ok(Error::InvalidAmount)));
    // reward cap 3%: 3 USDC on 100 is allowed, 3 USDC + 1 stroop is not
    let mut p = base.clone();
    p.reward = 3 * UNIT + 1;
    assert_eq!(s.esc.try_lock(&p), Err(Ok(Error::InvalidAmount)));
    // insurance cap 0.5%
    let mut p = base.clone();
    p.insurance = UNIT / 2 + 1;
    assert_eq!(s.esc.try_lock(&p), Err(Ok(Error::InvalidAmount)));
    let mut p = base.clone();
    p.reward = 3 * UNIT;
    p.insurance = UNIT / 2;
    s.esc.lock(&p);
    // zero reward and insurance are valid
    let mut p = base;
    p.reward = 0;
    p.insurance = 0;
    p.external_ref = rf(&s.env, 2);
    s.esc.lock(&p);
}

#[test]
fn lock_validates_timeouts() {
    let s = setup();
    let base = params(&s, &s.merchant, &s.user, &s.merchant, 1);
    for (pay, conf) in [
        (MIN_TIMEOUT_SECS - 1, CONF),
        (MAX_TIMEOUT_SECS + 1, CONF),
        (PAY, MIN_TIMEOUT_SECS - 1),
        (PAY, MAX_TIMEOUT_SECS + 1),
    ] {
        let mut p = base.clone();
        p.payment_timeout = pay;
        p.confirmation_timeout = conf;
        assert_eq!(s.esc.try_lock(&p), Err(Ok(Error::InvalidTimeout)));
    }
    let mut p = base;
    p.payment_timeout = MIN_TIMEOUT_SECS;
    p.confirmation_timeout = MAX_TIMEOUT_SECS;
    s.esc.lock(&p);
}

#[test]
fn lock_rejects_duplicate_reference() {
    let s = setup();
    buy(&s, 7);
    assert_eq!(
        s.esc
            .try_lock(&params(&s, &s.user, &s.merchant, &s.merchant, 7)),
        Err(Ok(Error::DuplicateRef))
    );
}

#[test]
fn failed_lock_leaves_no_trace() {
    let s = setup();
    let broke = Address::generate(&s.env);
    assert!(s
        .esc
        .try_lock(&params(&s, &broke, &s.user, &broke, 1))
        .is_err());
    assert_eq!(s.esc.try_get_order(&0), Err(Ok(Error::OrderNotFound)));
    assert_eq!(
        s.esc.try_order_by_ref(&rf(&s.env, 1)),
        Err(Ok(Error::OrderNotFound))
    );
    assert_eq!(buy(&s, 1), 0);
}

#[test]
fn pause_blocks_only_new_locks() {
    let s = setup();
    let a = buy(&s, 1);
    let b = buy(&s, 2);
    let c = buy(&s, 3);
    let d = buy(&s, 4);
    s.esc.set_paused(&true);
    assert_eq!(
        s.esc
            .try_lock(&params(&s, &s.merchant, &s.user, &s.merchant, 9)),
        Err(Ok(Error::Paused))
    );
    s.esc.mark_paid(&a, &ev(&s));
    s.esc.release(&a);
    s.esc.cancel(&b, &s.user);
    s.esc.mark_paid(&c, &ev(&s));
    s.esc.dispute(&c, &s.user);
    s.esc.resolve(&c, &false);
    advance(&s, PAY);
    s.esc.expire(&d);
    assert_eq!(s.usdc.balance(&s.esc.address), 0);
    s.esc.set_paused(&false);
    buy(&s, 9);
}

// ---------------- buy (on-ramp) happy path ----------------

#[test]
fn buy_full_flow_splits_recipient_reward_and_insurance() {
    let s = setup();
    let id = buy(&s, 1);
    s.esc.mark_paid(&id, &ev(&s));
    assert!(signed_by(&s, &s.user, "mark_paid"));
    let o = s.esc.get_order(&id);
    assert_eq!(o.status, Status::FiatSent);
    assert_eq!(o.evidence, ev(&s));
    assert_eq!(o.confirmation_deadline, START + CONF);
    s.esc.release(&id);
    assert!(signed_by(&s, &s.merchant, "release"));
    assert_eq!(s.usdc.balance(&s.user), 10_000 * UNIT + 100 * UNIT);
    assert_eq!(s.usdc.balance(&s.vault), 15 * UNIT / 10);
    assert_eq!(s.usdc.balance(&s.fund), UNIT / 10);
    assert_eq!(s.usdc.balance(&s.esc.address), 0);
    assert_eq!(status(&s, id), Status::Released);
}

// ---------------- sell (off-ramp) and QR payment ----------------

#[test]
fn sell_full_flow_pays_the_merchant() {
    let s = setup();
    let id = sell(&s, 1);
    assert!(signed_by(&s, &s.user, "lock"));
    s.esc.mark_paid(&id, &ev(&s)); // the merchant paid the user (or a third-party QR) in fiat
    assert!(signed_by(&s, &s.merchant, "mark_paid"));
    s.esc.release(&id); // the user confirms receipt
    assert!(signed_by(&s, &s.user, "release"));
    assert_eq!(s.usdc.balance(&s.merchant), 10_000 * UNIT + 100 * UNIT);
    assert_eq!(s.usdc.balance(&s.vault), 15 * UNIT / 10);
    assert_eq!(s.esc.get_order(&id).merchant, s.merchant);
}

// ---------------- mark_paid ----------------

#[test]
fn only_the_recipient_marks_paid_and_only_once() {
    let s = setup();
    let id = buy(&s, 1);
    let r = s
        .esc
        .mock_auths(&[MockAuth {
            address: &s.merchant,
            invoke: &MockAuthInvoke {
                contract: &s.esc.address,
                fn_name: "mark_paid",
                args: (id, ev(&s)).into_val(&s.env),
                sub_invokes: &[],
            },
        }])
        .try_mark_paid(&id, &ev(&s));
    assert!(r.is_err());
    s.esc.mark_paid(&id, &ev(&s));
    assert_eq!(
        s.esc.try_mark_paid(&id, &ev(&s)),
        Err(Ok(Error::InvalidState))
    );
}

#[test]
fn mark_paid_only_before_the_payment_deadline() {
    let s = setup();
    let id = buy(&s, 1);
    advance(&s, PAY - 1);
    let id2 = buy(&s, 2);
    s.esc.mark_paid(&id, &ev(&s)); // last second is fine
    advance(&s, PAY);
    assert_eq!(
        s.esc.try_mark_paid(&id2, &ev(&s)),
        Err(Ok(Error::DeadlinePassed))
    );
}

// ---------------- release ----------------

#[test]
fn release_needs_fiat_sent() {
    let s = setup();
    let id = buy(&s, 1);
    assert_eq!(s.esc.try_release(&id), Err(Ok(Error::InvalidState)));
}

#[test]
fn release_settles_exactly_once() {
    let s = setup();
    let id = buy(&s, 1);
    s.esc.mark_paid(&id, &ev(&s));
    s.esc.release(&id);
    assert_eq!(s.esc.try_release(&id), Err(Ok(Error::InvalidState)));
    assert_eq!(s.esc.try_cancel(&id, &s.user), Err(Ok(Error::InvalidState)));
    assert_eq!(s.esc.try_expire(&id), Err(Ok(Error::InvalidState)));
    assert_eq!(
        s.esc.try_dispute(&id, &s.user),
        Err(Ok(Error::InvalidState))
    );
    assert_eq!(s.esc.try_resolve(&id, &false), Err(Ok(Error::InvalidState)));
}

#[test]
fn recipient_cannot_release_to_itself() {
    let s = setup();
    let id = buy(&s, 1);
    s.esc.mark_paid(&id, &ev(&s));
    let r = s
        .esc
        .mock_auths(&[MockAuth {
            address: &s.user,
            invoke: &MockAuthInvoke {
                contract: &s.esc.address,
                fn_name: "release",
                args: (id,).into_val(&s.env),
                sub_invokes: &[],
            },
        }])
        .try_release(&id);
    assert!(r.is_err());
    assert_eq!(status(&s, id), Status::FiatSent);
}

#[test]
fn release_still_works_after_the_confirmation_deadline() {
    let s = setup();
    let id = buy(&s, 1);
    s.esc.mark_paid(&id, &ev(&s));
    advance(&s, CONF * 3);
    s.esc.release(&id);
    assert_eq!(status(&s, id), Status::Released);
}

// ---------------- cancel ----------------

#[test]
fn recipient_or_operator_can_cancel_before_fiat_is_sent() {
    let s = setup();
    let a = buy(&s, 1);
    let b = buy(&s, 2);
    s.esc.cancel(&a, &s.user);
    assert!(signed_by(&s, &s.user, "cancel"));
    s.esc.cancel(&b, &s.operator);
    assert!(signed_by(&s, &s.operator, "cancel"));
    assert_eq!(s.usdc.balance(&s.merchant), 10_000 * UNIT);
    assert_eq!(s.usdc.balance(&s.vault), 0);
    assert_eq!(s.usdc.balance(&s.fund), 0);
    assert_eq!(status(&s, a), Status::Cancelled);
}

#[test]
fn depositor_and_strangers_cannot_cancel() {
    let s = setup();
    let id = buy(&s, 1);
    assert_eq!(
        s.esc.try_cancel(&id, &s.merchant),
        Err(Ok(Error::NotAllowed))
    );
    assert_eq!(
        s.esc.try_cancel(&id, &Address::generate(&s.env)),
        Err(Ok(Error::NotAllowed))
    );
    assert_eq!(
        s.esc.try_cancel(&id, &s.arbiter),
        Err(Ok(Error::NotAllowed))
    );
}

#[test]
fn no_cancel_after_fiat_is_sent() {
    let s = setup();
    let id = buy(&s, 1);
    s.esc.mark_paid(&id, &ev(&s));
    assert_eq!(s.esc.try_cancel(&id, &s.user), Err(Ok(Error::InvalidState)));
    assert_eq!(
        s.esc.try_cancel(&id, &s.operator),
        Err(Ok(Error::InvalidState))
    );
}

// ---------------- expire ----------------

#[test]
fn expire_only_after_payment_timeout_and_needs_no_signature() {
    let s = setup();
    let id = buy(&s, 1);
    assert_eq!(s.esc.try_expire(&id), Err(Ok(Error::NotExpired)));
    advance(&s, PAY - 1);
    assert_eq!(s.esc.try_expire(&id), Err(Ok(Error::NotExpired)));
    advance(&s, 1);
    s.env.set_auths(&[]);
    s.esc.expire(&id);
    assert!(s.env.auths().is_empty());
    assert_eq!(s.usdc.balance(&s.merchant), 10_000 * UNIT);
    assert_eq!(status(&s, id), Status::Expired);
}

#[test]
fn never_auto_refund_after_fiat_is_sent() {
    let s = setup();
    let id = buy(&s, 1);
    s.esc.mark_paid(&id, &ev(&s));
    advance(&s, PAY + CONF + 1_000_000);
    assert_eq!(s.esc.try_expire(&id), Err(Ok(Error::InvalidState)));
    assert_eq!(s.usdc.balance(&s.esc.address), 1016 * UNIT / 10);
}

// ---------------- disputes ----------------

#[test]
fn either_party_can_dispute_after_fiat_is_sent() {
    let s = setup();
    let a = buy(&s, 1);
    let b = buy(&s, 2);
    s.esc.mark_paid(&a, &ev(&s));
    s.esc.mark_paid(&b, &ev(&s));
    s.esc.dispute(&a, &s.user);
    assert!(signed_by(&s, &s.user, "dispute"));
    s.esc.dispute(&b, &s.merchant);
    assert!(signed_by(&s, &s.merchant, "dispute"));
    assert_eq!(status(&s, a), Status::Disputed);
    assert_eq!(status(&s, b), Status::Disputed);
}

#[test]
fn no_dispute_before_fiat_is_sent() {
    let s = setup();
    let id = buy(&s, 1);
    assert_eq!(
        s.esc.try_dispute(&id, &s.user),
        Err(Ok(Error::InvalidState))
    );
}

#[test]
fn confirmation_timeout_lets_anyone_open_the_dispute() {
    let s = setup();
    let id = buy(&s, 1);
    s.esc.mark_paid(&id, &ev(&s));
    let keeper = Address::generate(&s.env);
    advance(&s, CONF - 1);
    assert_eq!(s.esc.try_dispute(&id, &keeper), Err(Ok(Error::NotAllowed)));
    advance(&s, 1);
    s.esc.dispute(&id, &keeper);
    assert_eq!(status(&s, id), Status::Disputed);
}

#[test]
fn resolve_fiat_paid_releases_with_the_split() {
    let s = setup();
    let id = buy(&s, 1);
    s.esc.mark_paid(&id, &ev(&s));
    s.esc.dispute(&id, &s.user);
    s.esc.resolve(&id, &true);
    assert!(signed_by(&s, &s.arbiter, "resolve"));
    assert_eq!(s.usdc.balance(&s.user), 10_100 * UNIT);
    assert_eq!(s.usdc.balance(&s.vault), 15 * UNIT / 10);
    assert_eq!(s.usdc.balance(&s.fund), UNIT / 10);
    assert_eq!(status(&s, id), Status::Released);
}

#[test]
fn resolve_fiat_not_paid_refunds_everything() {
    let s = setup();
    let id = buy(&s, 1);
    s.esc.mark_paid(&id, &ev(&s));
    s.esc.dispute(&id, &s.merchant);
    s.esc.resolve(&id, &false);
    assert_eq!(s.usdc.balance(&s.merchant), 10_000 * UNIT);
    assert_eq!(s.usdc.balance(&s.vault), 0);
    assert_eq!(status(&s, id), Status::Cancelled);
    assert_eq!(s.esc.try_resolve(&id, &true), Err(Ok(Error::InvalidState)));
}

#[test]
fn resolve_needs_an_open_dispute() {
    let s = setup();
    let id = buy(&s, 1);
    assert_eq!(s.esc.try_resolve(&id, &true), Err(Ok(Error::InvalidState)));
    s.esc.mark_paid(&id, &ev(&s));
    assert_eq!(s.esc.try_resolve(&id, &true), Err(Ok(Error::InvalidState)));
}

#[test]
fn parties_cannot_resolve_their_own_dispute() {
    let s = setup();
    let id = buy(&s, 1);
    s.esc.mark_paid(&id, &ev(&s));
    s.esc.dispute(&id, &s.user);
    for who in [&s.user, &s.merchant, &s.operator, &s.admin] {
        let r = s
            .esc
            .mock_auths(&[MockAuth {
                address: who,
                invoke: &MockAuthInvoke {
                    contract: &s.esc.address,
                    fn_name: "resolve",
                    args: (id, true).into_val(&s.env),
                    sub_invokes: &[],
                },
            }])
            .try_resolve(&id, &true);
        assert!(r.is_err());
    }
    assert_eq!(status(&s, id), Status::Disputed);
}

#[test]
fn depositor_can_concede_a_dispute() {
    let s = setup();
    let id = buy(&s, 1);
    s.esc.mark_paid(&id, &ev(&s));
    s.esc.dispute(&id, &s.user);
    s.esc.release(&id);
    assert_eq!(status(&s, id), Status::Released);
}

#[test]
fn unknown_order() {
    let s = setup();
    assert_eq!(
        s.esc.try_mark_paid(&9, &ev(&s)),
        Err(Ok(Error::OrderNotFound))
    );
    assert_eq!(s.esc.try_release(&9), Err(Ok(Error::OrderNotFound)));
    assert_eq!(s.esc.try_cancel(&9, &s.user), Err(Ok(Error::OrderNotFound)));
    assert_eq!(s.esc.try_expire(&9), Err(Ok(Error::OrderNotFound)));
    assert_eq!(
        s.esc.try_dispute(&9, &s.user),
        Err(Ok(Error::OrderNotFound))
    );
    assert_eq!(s.esc.try_resolve(&9, &true), Err(Ok(Error::OrderNotFound)));
}

// ---------------- authorization without mocks ----------------

#[test]
fn nothing_moves_without_signatures() {
    let s = setup();
    let a = buy(&s, 1);
    let b = buy(&s, 2);
    s.esc.mark_paid(&b, &ev(&s));
    let c = buy(&s, 3);
    s.esc.mark_paid(&c, &ev(&s));
    s.esc.dispute(&c, &s.user);
    s.env.set_auths(&[]);
    assert!(s
        .esc
        .try_lock(&params(&s, &s.merchant, &s.user, &s.merchant, 9))
        .is_err());
    assert!(s.esc.try_mark_paid(&a, &ev(&s)).is_err());
    assert!(s.esc.try_cancel(&a, &s.user).is_err());
    assert!(s.esc.try_cancel(&a, &s.operator).is_err());
    assert!(s.esc.try_release(&b).is_err());
    assert!(s.esc.try_dispute(&b, &s.user).is_err());
    assert!(s.esc.try_resolve(&c, &true).is_err());
    assert!(s.esc.try_set_paused(&true).is_err());
    assert!(s.esc.try_set_arbiter(&s.user).is_err());
    assert!(s.esc.try_set_operator(&s.user).is_err());
    assert!(s.esc.try_set_reward_vault(&s.user).is_err());
    assert!(s.esc.try_set_insurance_fund(&s.user).is_err());
    assert!(s.esc.try_propose_admin(&s.user).is_err());
    assert!(s
        .esc
        .try_upgrade(&BytesN::from_array(&s.env, &[0; 32]))
        .is_err());
    assert_eq!(s.usdc.balance(&s.esc.address), 3 * 1016 * UNIT / 10);
}

// ---------------- administration ----------------

#[test]
fn admin_transfer_is_two_step() {
    let s = setup();
    let new = Address::generate(&s.env);
    assert_eq!(s.esc.try_accept_admin(), Err(Ok(Error::NoPendingAdmin)));
    s.esc.propose_admin(&new);
    assert_eq!(s.esc.get_config().admin, s.admin);
    s.esc.accept_admin();
    assert!(signed_by(&s, &new, "accept_admin"));
    assert_eq!(s.esc.get_config().admin, new);
    assert_eq!(s.esc.try_accept_admin(), Err(Ok(Error::NoPendingAdmin)));
}

#[test]
fn config_changes_apply_to_release() {
    let s = setup();
    let (arb, op, vault, fund) = (
        Address::generate(&s.env),
        Address::generate(&s.env),
        Address::generate(&s.env),
        Address::generate(&s.env),
    );
    s.esc.set_arbiter(&arb);
    s.esc.set_operator(&op);
    s.esc.set_reward_vault(&vault);
    s.esc.set_insurance_fund(&fund);
    let a = buy(&s, 1);
    s.esc.cancel(&a, &op);
    let b = buy(&s, 2);
    s.esc.mark_paid(&b, &ev(&s));
    s.esc.dispute(&b, &s.user);
    s.esc.resolve(&b, &true);
    assert!(signed_by(&s, &arb, "resolve"));
    assert_eq!(s.usdc.balance(&vault), 15 * UNIT / 10);
    assert_eq!(s.usdc.balance(&fund), UNIT / 10);
    assert_eq!(
        s.esc.try_cancel(&buy(&s, 3), &s.operator),
        Err(Ok(Error::NotAllowed))
    );
}

// ---------------- arithmetic ----------------

#[test]
fn caps_are_exact_and_overflow_safe() {
    assert_eq!(within_cap(300, 10_000, 300), Ok(true));
    assert_eq!(within_cap(301, 10_000, 300), Ok(false));
    assert_eq!(within_cap(0, 1, 0), Ok(true));
    assert_eq!(within_cap(i128::MAX, 1, 300), Err(Error::Overflow));
    assert_eq!(within_cap(1, i128::MAX, 300), Err(Error::Overflow));
}

#[test]
fn lock_rejects_overflowing_amounts() {
    let s = setup();
    let mut p = params(&s, &s.merchant, &s.user, &s.merchant, 1);
    p.recipient_amount = i128::MAX;
    assert_eq!(s.esc.try_lock(&p), Err(Ok(Error::Overflow)));
}

#[test]
fn funds_are_conserved_across_mixed_orders() {
    // invariant: every stroop locked leaves exactly once, split among the parties
    let s = setup();
    let parties = [&s.merchant, &s.user, &s.vault, &s.fund];
    let before: i128 = parties.iter().map(|a| s.usdc.balance(a)).sum();
    let mut ids = std::vec::Vec::new();
    for i in 0..24u8 {
        let mut p = if i % 2 == 0 {
            params(&s, &s.merchant, &s.user, &s.merchant, i)
        } else {
            params(&s, &s.user, &s.merchant, &s.merchant, i)
        };
        p.recipient_amount = (i as i128 + 1) * 7 * UNIT + 13;
        p.reward = p.recipient_amount * 150 / 10_000;
        p.insurance = p.recipient_amount * 10 / 10_000;
        ids.push(s.esc.lock(&p));
    }
    for (k, id) in ids.iter().enumerate() {
        let o = s.esc.get_order(id);
        match k % 6 {
            0 => {
                s.esc.mark_paid(id, &ev(&s));
                s.esc.release(id);
            }
            1 => s.esc.cancel(id, &o.recipient),
            2 => {
                s.esc.mark_paid(id, &ev(&s));
                s.esc.dispute(id, &o.depositor);
                s.esc.resolve(id, &true);
            }
            3 => {
                s.esc.mark_paid(id, &ev(&s));
                s.esc.dispute(id, &o.recipient);
                s.esc.resolve(id, &false);
            }
            4 => s.esc.cancel(id, &s.operator),
            _ => {}
        }
    }
    advance(&s, PAY);
    for (k, id) in ids.iter().enumerate() {
        if k % 6 == 5 {
            s.esc.expire(id);
        }
    }
    assert_eq!(s.usdc.balance(&s.esc.address), 0);
    let after: i128 = parties.iter().map(|a| s.usdc.balance(a)).sum();
    assert_eq!(before, after);
}
