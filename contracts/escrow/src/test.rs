#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation, Ledger},
    token::{StellarAssetClient, TokenClient},
    vec, IntoVal, Symbol,
};

const UNIT: i128 = 10_000_000; // 1 USDC con 7 decimales
const TTL: u64 = 60 * 60;

struct Setup<'a> {
    env: Env,
    escrow: KaleaEscrowClient<'a>,
    usdc: TokenClient<'a>,
    admin: Address,
    arbiter: Address,
    treasury: Address,
    partner: Address, // depositante (socio local en pay-in)
    app: Address,     // beneficiario (app integradora)
}

fn setup_with_fee(fee_bps: u32) -> Setup<'static> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.timestamp = 1_700_000_000);
    let admin = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let treasury = Address::generate(&env);
    let partner = Address::generate(&env);
    let app = Address::generate(&env);
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let usdc_id = sac.address();
    StellarAssetClient::new(&env, &usdc_id).mint(&partner, &(1_000 * UNIT));
    StellarAssetClient::new(&env, &usdc_id).mint(&app, &(1_000 * UNIT));
    let id = env.register(
        KaleaEscrow,
        (
            admin.clone(),
            arbiter.clone(),
            treasury.clone(),
            usdc_id.clone(),
            fee_bps,
        ),
    );
    let escrow = KaleaEscrowClient::new(&env, &id);
    let usdc = TokenClient::new(&env, &usdc_id);
    Setup {
        env,
        escrow,
        usdc,
        admin,
        arbiter,
        treasury,
        partner,
        app,
    }
}

fn setup() -> Setup<'static> {
    setup_with_fee(50) // 0,5 %
}

fn r(env: &Env, n: u8) -> BytesN<32> {
    BytesN::from_array(env, &[n; 32])
}

fn open(s: &Setup, amount: i128, n: u8) -> u64 {
    s.escrow
        .create(&s.partner, &s.app, &amount, &TTL, &r(&s.env, n))
}

fn advance(s: &Setup, secs: u64) {
    s.env.ledger().with_mut(|l| l.timestamp += secs);
}

/// La última llamada exigió exactamente la firma de `who` sobre `fn_name` del escrow.
fn assert_signed_by(s: &Setup, who: &Address, fn_name: &str) {
    let auths = s.env.auths();
    assert!(
        auths.iter().any(|(a, inv)| a == who
            && matches!(&inv.function, AuthorizedFunction::Contract((c, f, _)) if *c == s.escrow.address && *f == Symbol::new(&s.env, fn_name))),
        "{fn_name} no exigió la firma esperada: {auths:?}"
    );
}

// ---------------- constructor ----------------

#[test]
fn constructor_guarda_config() {
    let s = setup();
    let c = s.escrow.get_config();
    assert_eq!(c.admin, s.admin);
    assert_eq!(c.arbiter, s.arbiter);
    assert_eq!(c.treasury, s.treasury);
    assert_eq!(c.token, s.usdc.address);
    assert_eq!(c.fee_bps, 50);
    assert!(!c.paused);
}

#[test]
#[should_panic]
fn constructor_rechaza_fee_sobre_el_tope() {
    setup_with_fee(MAX_FEE_BPS + 1);
}

// ---------------- crear ----------------

#[test]
fn create_bloquea_fondos_y_exige_firma_del_depositante() {
    let s = setup();
    let id = open(&s, 100 * UNIT, 1);
    assert_eq!(id, 0);
    assert_eq!(
        s.env.auths()[0],
        (
            s.partner.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    s.escrow.address.clone(),
                    Symbol::new(&s.env, "create"),
                    (
                        s.partner.clone(),
                        s.app.clone(),
                        100 * UNIT,
                        TTL,
                        r(&s.env, 1)
                    )
                        .into_val(&s.env),
                )),
                sub_invocations: std::vec![AuthorizedInvocation {
                    function: AuthorizedFunction::Contract((
                        s.usdc.address.clone(),
                        Symbol::new(&s.env, "transfer"),
                        vec![
                            &s.env,
                            s.partner.to_val(),
                            s.escrow.address.to_val(),
                            (100 * UNIT).into_val(&s.env)
                        ],
                    )),
                    sub_invocations: std::vec![],
                }],
            }
        )
    );
    assert_eq!(s.usdc.balance(&s.escrow.address), 100 * UNIT);
    assert_eq!(s.usdc.balance(&s.partner), 900 * UNIT);
    let o = s.escrow.get_order(&id);
    assert_eq!(o.status, Status::Locked);
    assert_eq!(o.fee, UNIT / 2); // 0,5 % de 100
    assert_eq!(o.expires_at, 1_700_000_000 + TTL);
    assert_eq!(s.escrow.order_by_ref(&r(&s.env, 1)), id);
}

#[test]
fn ids_son_secuenciales() {
    let s = setup();
    assert_eq!(open(&s, UNIT, 1), 0);
    assert_eq!(open(&s, UNIT, 2), 1);
    assert_eq!(open(&s, UNIT, 3), 2);
}

#[test]
fn create_valida_entradas() {
    let s = setup();
    let e = &s.env;
    assert_eq!(
        s.escrow.try_create(&s.partner, &s.app, &0, &TTL, &r(e, 1)),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        s.escrow.try_create(&s.partner, &s.app, &-5, &TTL, &r(e, 1)),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        s.escrow
            .try_create(&s.partner, &s.partner, &UNIT, &TTL, &r(e, 1)),
        Err(Ok(Error::SameParties))
    );
    assert_eq!(
        s.escrow
            .try_create(&s.partner, &s.app, &UNIT, &(MIN_TTL_SECS - 1), &r(e, 1)),
        Err(Ok(Error::InvalidExpiry))
    );
    assert_eq!(
        s.escrow
            .try_create(&s.partner, &s.app, &UNIT, &(MAX_TTL_SECS + 1), &r(e, 1)),
        Err(Ok(Error::InvalidExpiry))
    );
    // los límites exactos sí valen
    s.escrow
        .create(&s.partner, &s.app, &UNIT, &MIN_TTL_SECS, &r(e, 2));
    s.escrow
        .create(&s.partner, &s.app, &UNIT, &MAX_TTL_SECS, &r(e, 3));
}

#[test]
fn create_rechaza_referencia_duplicada() {
    let s = setup();
    open(&s, UNIT, 7);
    assert_eq!(
        s.escrow
            .try_create(&s.partner, &s.app, &UNIT, &TTL, &r(&s.env, 7)),
        Err(Ok(Error::DuplicateRef))
    );
}

#[test]
fn create_falla_sin_saldo_y_no_deja_rastro() {
    let s = setup();
    let pobre = Address::generate(&s.env);
    assert!(s
        .escrow
        .try_create(&pobre, &s.app, &UNIT, &TTL, &r(&s.env, 1))
        .is_err());
    // la transacción revierte completa: ni orden, ni referencia, ni id consumido
    assert_eq!(s.escrow.try_get_order(&0), Err(Ok(Error::OrderNotFound)));
    assert_eq!(
        s.escrow.try_order_by_ref(&r(&s.env, 1)),
        Err(Ok(Error::OrderNotFound))
    );
    assert_eq!(open(&s, UNIT, 2), 0);
}

#[test]
fn create_bloqueado_en_pausa() {
    let s = setup();
    s.escrow.set_paused(&true);
    assert_eq!(
        s.escrow
            .try_create(&s.partner, &s.app, &UNIT, &TTL, &r(&s.env, 1)),
        Err(Ok(Error::Paused))
    );
    s.escrow.set_paused(&false);
    open(&s, UNIT, 1);
}

// ---------------- liberar ----------------

#[test]
fn release_paga_neto_y_comision() {
    let s = setup();
    let id = open(&s, 200 * UNIT, 1);
    s.escrow.release(&id);
    assert_signed_by(&s, &s.partner, "release");
    assert_eq!(s.usdc.balance(&s.app), 1_000 * UNIT + 199 * UNIT); // 200 − 1 (0,5 %)
    assert_eq!(s.usdc.balance(&s.treasury), UNIT);
    assert_eq!(s.usdc.balance(&s.escrow.address), 0);
    assert_eq!(s.escrow.get_order(&id).status, Status::Released);
}

#[test]
fn release_no_se_puede_repetir() {
    let s = setup();
    let id = open(&s, UNIT, 1);
    s.escrow.release(&id);
    assert_eq!(s.escrow.try_release(&id), Err(Ok(Error::InvalidState)));
    assert_eq!(s.escrow.try_refund(&id), Err(Ok(Error::InvalidState)));
    assert_eq!(s.escrow.try_cancel(&id), Err(Ok(Error::InvalidState)));
    assert_eq!(s.escrow.try_dispute(&id), Err(Ok(Error::InvalidState)));
}

#[test]
fn release_funciona_despues_de_vencer() {
    // el depositante siempre puede pagar, aun vencida
    let s = setup();
    let id = open(&s, UNIT, 1);
    advance(&s, TTL + 10);
    s.escrow.release(&id);
    assert_eq!(s.escrow.get_order(&id).status, Status::Released);
}

#[test]
fn orden_inexistente() {
    let s = setup();
    assert_eq!(s.escrow.try_release(&99), Err(Ok(Error::OrderNotFound)));
    assert_eq!(s.escrow.try_refund(&99), Err(Ok(Error::OrderNotFound)));
    assert_eq!(s.escrow.try_dispute(&99), Err(Ok(Error::OrderNotFound)));
    assert_eq!(
        s.escrow.try_resolve(&99, &true),
        Err(Ok(Error::OrderNotFound))
    );
}

// ---------------- cancelar y devolver ----------------

#[test]
fn cancel_del_beneficiario_devuelve_todo_sin_comision() {
    let s = setup();
    let id = open(&s, 100 * UNIT, 1);
    s.escrow.cancel(&id);
    assert_signed_by(&s, &s.app, "cancel");
    assert_eq!(s.usdc.balance(&s.partner), 1_000 * UNIT);
    assert_eq!(s.usdc.balance(&s.treasury), 0);
    assert_eq!(s.escrow.get_order(&id).status, Status::Refunded);
}

#[test]
fn refund_solo_tras_vencer() {
    let s = setup();
    let id = open(&s, 100 * UNIT, 1);
    assert_eq!(s.escrow.try_refund(&id), Err(Ok(Error::NotExpired)));
    advance(&s, TTL - 1);
    assert_eq!(s.escrow.try_refund(&id), Err(Ok(Error::NotExpired)));
    advance(&s, 1);
    s.escrow.refund(&id);
    assert_eq!(s.usdc.balance(&s.partner), 1_000 * UNIT);
    assert_eq!(s.escrow.get_order(&id).status, Status::Refunded);
}

#[test]
fn refund_no_requiere_firmas() {
    // cualquiera puede ejecutarlo: el único destino posible es el depositante
    let s = setup();
    let id = open(&s, UNIT, 1);
    advance(&s, TTL);
    s.env.set_auths(&[]);
    s.escrow.refund(&id);
    assert!(s.env.auths().is_empty());
    assert_eq!(s.usdc.balance(&s.partner), 1_000 * UNIT);
}

// ---------------- disputas ----------------

#[test]
fn dispute_bloquea_el_refund_y_el_cancel() {
    let s = setup();
    let id = open(&s, 100 * UNIT, 1);
    s.escrow.dispute(&id);
    assert_signed_by(&s, &s.app, "dispute");
    assert_eq!(s.escrow.get_order(&id).status, Status::Disputed);
    advance(&s, TTL * 2);
    assert_eq!(s.escrow.try_refund(&id), Err(Ok(Error::InvalidState)));
    assert_eq!(s.escrow.try_cancel(&id), Err(Ok(Error::InvalidState)));
    assert_eq!(s.escrow.try_dispute(&id), Err(Ok(Error::InvalidState)));
}

#[test]
fn dispute_solo_antes_de_vencer() {
    let s = setup();
    let id = open(&s, UNIT, 1);
    advance(&s, TTL);
    assert_eq!(s.escrow.try_dispute(&id), Err(Ok(Error::Expired)));
}

#[test]
fn resolve_a_favor_del_beneficiario() {
    let s = setup();
    let id = open(&s, 100 * UNIT, 1);
    s.escrow.dispute(&id);
    s.escrow.resolve(&id, &true);
    assert_signed_by(&s, &s.arbiter, "resolve");
    assert_eq!(s.usdc.balance(&s.app), 1_000 * UNIT + 100 * UNIT - UNIT / 2);
    assert_eq!(s.usdc.balance(&s.treasury), UNIT / 2);
    assert_eq!(s.escrow.get_order(&id).status, Status::Released);
}

#[test]
fn resolve_a_favor_del_depositante() {
    let s = setup();
    let id = open(&s, 100 * UNIT, 1);
    s.escrow.dispute(&id);
    s.escrow.resolve(&id, &false);
    assert_eq!(s.usdc.balance(&s.partner), 1_000 * UNIT);
    assert_eq!(s.usdc.balance(&s.treasury), 0);
    assert_eq!(s.escrow.get_order(&id).status, Status::Refunded);
    assert_eq!(
        s.escrow.try_resolve(&id, &true),
        Err(Ok(Error::InvalidState))
    );
}

#[test]
fn resolve_solo_con_disputa_abierta() {
    let s = setup();
    let id = open(&s, UNIT, 1);
    assert_eq!(
        s.escrow.try_resolve(&id, &true),
        Err(Ok(Error::InvalidState))
    );
}

#[test]
fn el_depositante_puede_ceder_en_disputa() {
    let s = setup();
    let id = open(&s, UNIT, 1);
    s.escrow.dispute(&id);
    s.escrow.release(&id);
    assert_eq!(s.escrow.get_order(&id).status, Status::Released);
}

// ---------------- autorización (sin mocks) ----------------

#[test]
fn nadie_sin_firma_puede_mover_fondos() {
    let s = setup();
    let id = open(&s, UNIT, 1);
    let id2 = open(&s, UNIT, 2);
    s.escrow.dispute(&id2);
    s.env.set_auths(&[]); // a partir de aquí ninguna firma es válida
    assert!(s.escrow.try_release(&id).is_err());
    assert!(s.escrow.try_cancel(&id).is_err());
    assert!(s.escrow.try_dispute(&id).is_err());
    assert!(s.escrow.try_resolve(&id2, &true).is_err());
    assert!(s
        .escrow
        .try_create(&s.partner, &s.app, &UNIT, &TTL, &r(&s.env, 3))
        .is_err());
    assert!(s.escrow.try_set_fee(&10).is_err());
    assert!(s.escrow.try_set_paused(&true).is_err());
    assert!(s.escrow.try_set_arbiter(&s.partner).is_err());
    assert!(s.escrow.try_set_treasury(&s.partner).is_err());
    assert!(s.escrow.try_propose_admin(&s.partner).is_err());
    assert!(s
        .escrow
        .try_upgrade(&BytesN::from_array(&s.env, &[0; 32]))
        .is_err());
    // nada se movió
    assert_eq!(s.usdc.balance(&s.escrow.address), 2 * UNIT);
    assert_eq!(s.escrow.get_order(&id).status, Status::Locked);
}

#[test]
fn el_beneficiario_no_puede_liberarse_a_si_mismo() {
    use soroban_sdk::testutils::{MockAuth, MockAuthInvoke};
    let s = setup();
    let id = open(&s, UNIT, 1);
    // la app firma `release`, pero el contrato exige la firma del depositante
    let res = s
        .escrow
        .mock_auths(&[MockAuth {
            address: &s.app,
            invoke: &MockAuthInvoke {
                contract: &s.escrow.address,
                fn_name: "release",
                args: (id,).into_val(&s.env),
                sub_invokes: &[],
            },
        }])
        .try_release(&id);
    assert!(res.is_err());
    assert_eq!(s.escrow.get_order(&id).status, Status::Locked);
}

#[test]
fn el_depositante_no_puede_resolver_su_disputa() {
    use soroban_sdk::testutils::{MockAuth, MockAuthInvoke};
    let s = setup();
    let id = open(&s, UNIT, 1);
    s.escrow.dispute(&id);
    let res = s
        .escrow
        .mock_auths(&[MockAuth {
            address: &s.partner,
            invoke: &MockAuthInvoke {
                contract: &s.escrow.address,
                fn_name: "resolve",
                args: (id, false).into_val(&s.env),
                sub_invokes: &[],
            },
        }])
        .try_resolve(&id, &false);
    assert!(res.is_err());
    assert_eq!(s.escrow.get_order(&id).status, Status::Disputed);
}

// ---------------- administración ----------------

#[test]
fn set_fee_respeta_el_tope_y_no_toca_ordenes_abiertas() {
    let s = setup();
    let id = open(&s, 100 * UNIT, 1);
    assert_eq!(
        s.escrow.try_set_fee(&(MAX_FEE_BPS + 1)),
        Err(Ok(Error::InvalidFee))
    );
    s.escrow.set_fee(&MAX_FEE_BPS);
    assert_signed_by(&s, &s.admin, "set_fee");
    let id2 = open(&s, 100 * UNIT, 2);
    assert_eq!(s.escrow.get_order(&id).fee, UNIT / 2); // fijada al crear
    assert_eq!(s.escrow.get_order(&id2).fee, UNIT); // 1 %
    s.escrow.release(&id);
    assert_eq!(s.usdc.balance(&s.treasury), UNIT / 2);
}

#[test]
fn la_pausa_no_traba_los_fondos() {
    let s = setup();
    let a = open(&s, UNIT, 1);
    let b = open(&s, UNIT, 2);
    let c = open(&s, UNIT, 3);
    let d = open(&s, UNIT, 4);
    s.escrow.set_paused(&true);
    s.escrow.release(&a);
    s.escrow.cancel(&b);
    s.escrow.dispute(&c);
    s.escrow.resolve(&c, &false);
    advance(&s, TTL);
    s.escrow.refund(&d);
    assert_eq!(s.usdc.balance(&s.escrow.address), 0);
}

#[test]
fn traspaso_de_admin_en_dos_pasos() {
    let s = setup();
    let nuevo = Address::generate(&s.env);
    assert_eq!(s.escrow.try_accept_admin(), Err(Ok(Error::NoPendingAdmin)));
    s.escrow.propose_admin(&nuevo);
    assert_eq!(s.escrow.get_config().admin, s.admin); // aún no cambia
    s.escrow.accept_admin();
    assert_signed_by(&s, &nuevo, "accept_admin");
    assert_eq!(s.escrow.get_config().admin, nuevo);
    assert_eq!(s.escrow.try_accept_admin(), Err(Ok(Error::NoPendingAdmin)));
}

#[test]
fn cambiar_arbitro_y_tesoreria() {
    let s = setup();
    let arb = Address::generate(&s.env);
    let tes = Address::generate(&s.env);
    s.escrow.set_arbiter(&arb);
    s.escrow.set_treasury(&tes);
    let id = open(&s, 100 * UNIT, 1);
    s.escrow.dispute(&id);
    s.escrow.resolve(&id, &true);
    assert_signed_by(&s, &arb, "resolve");
    assert_eq!(s.usdc.balance(&tes), UNIT / 2);
}

// ---------------- aritmética ----------------

#[test]
fn comision_redondea_hacia_abajo() {
    assert_eq!(fee_for(199, 50), Ok(0)); // 0,995 → 0
    assert_eq!(fee_for(200, 50), Ok(1));
    assert_eq!(fee_for(10_000, 100), Ok(100));
    assert_eq!(fee_for(1, 0), Ok(0));
}

#[test]
fn comision_detecta_desbordamiento() {
    assert_eq!(fee_for(i128::MAX, 100), Err(Error::Overflow));
    assert_eq!(
        fee_for(i128::MAX / 100, 100),
        Ok(i128::MAX / 100 * 100 / 10_000)
    );
}

#[test]
fn montos_minimos_sin_comision() {
    let s = setup();
    let id = open(&s, 1, 1); // 1 stroop: comisión 0
    s.escrow.release(&id);
    assert_eq!(s.usdc.balance(&s.treasury), 0);
    assert_eq!(s.usdc.balance(&s.app), 1_000 * UNIT + 1);
}

#[test]
fn conservacion_de_fondos_en_muchas_ordenes() {
    // invariante: lo que entra al escrow sale exactamente una vez, repartido entre las partes
    let s = setup();
    let total_inicial = s.usdc.balance(&s.partner) + s.usdc.balance(&s.app);
    let mut ids = std::vec::Vec::new();
    for i in 0..20u8 {
        ids.push(open(&s, (i as i128 + 1) * 3 * UNIT + 7, i));
    }
    for (k, id) in ids.iter().enumerate() {
        match k % 4 {
            0 => s.escrow.release(id),
            1 => s.escrow.cancel(id),
            2 => {
                s.escrow.dispute(id);
                s.escrow.resolve(id, &(k % 8 == 2));
            }
            _ => {}
        }
    }
    advance(&s, TTL);
    for (k, id) in ids.iter().enumerate() {
        if k % 4 == 3 {
            s.escrow.refund(id);
        }
    }
    assert_eq!(s.usdc.balance(&s.escrow.address), 0);
    let total_final =
        s.usdc.balance(&s.partner) + s.usdc.balance(&s.app) + s.usdc.balance(&s.treasury);
    assert_eq!(total_inicial, total_final);
}

#[test]
fn flujo_pay_out_la_app_deposita() {
    // pay-out: la app bloquea USDC, el socio paga BOB al usuario y la app libera al socio
    let s = setup();
    let id = s
        .escrow
        .create(&s.app, &s.partner, &(50 * UNIT), &TTL, &r(&s.env, 9));
    s.escrow.release(&id);
    assert_signed_by(&s, &s.app, "release");
    assert_eq!(
        s.usdc.balance(&s.partner),
        1_000 * UNIT + 50 * UNIT - UNIT / 4
    );
}
