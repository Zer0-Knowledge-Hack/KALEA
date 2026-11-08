//! KALEA · escrow de USDC por orden (Soroban).
//!
//! Liquidación P2P B2B: un **depositante** bloquea USDC para un **beneficiario** mientras el pago en bolivianos
//! ocurre fuera de la cadena (QR Simple o transferencia).
//!
//! - Pay-in: el socio local deposita USDC; el usuario final de la app le paga en BOB; el socio confirma y
//!   el USDC (menos la comisión) llega a la app.
//! - Pay-out: la app deposita USDC; el socio local paga BOB al usuario; la app confirma y el USDC llega al socio.
//!
//! En ambos casos **solo quien recibe los bolivianos (el depositante) puede liberar**. Si no libera, el
//! beneficiario abre una disputa antes del vencimiento y un árbitro decide. Sin disputa, al vencer, cualquiera
//! puede devolver los fondos al depositante. KALEA nunca es contraparte: el contrato solo custodia lo que las
//! partes bloquean y lo mueve según estas reglas.
//!
//! Propiedades de seguridad:
//! - Cada acción exige la firma (`require_auth`) del rol que corresponde; nadie más puede mover fondos.
//! - Máquina de estados estricta: una orden se liquida una sola vez (Released o Refunded son finales).
//! - Se actualiza el estado antes de transferir (checks-effects-interactions).
//! - La comisión queda fijada al crear la orden y tiene un tope (`MAX_FEE_BPS`); cambiarla no afecta órdenes abiertas.
//! - La pausa solo bloquea órdenes nuevas: liberar, devolver y resolver siguen funcionando (los fondos nunca se traban).
//! - Un solo token permitido (USDC), fijado en el constructor; aritmética con verificación de desbordamiento.
//! - Referencia externa única por orden: el API no puede crear dos escrows para la misma orden.
//! - Traspaso de admin en dos pasos (propuesta y aceptación).
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, BytesN,
    ContractExecutable, Env,
};

#[cfg(test)]
mod test;

/// Tope de comisión: 1 % (100 puntos básicos).
pub const MAX_FEE_BPS: u32 = 100;
/// Vencimiento mínimo y máximo de una orden, en segundos.
pub const MIN_TTL_SECS: u64 = 5 * 60;
pub const MAX_TTL_SECS: u64 = 7 * 24 * 60 * 60;

const DAY_LEDGERS: u32 = 17_280; // ~5 s por ledger
const INSTANCE_BUMP: u32 = 30 * DAY_LEDGERS;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY_LEDGERS;
const ORDER_BUMP: u32 = 60 * DAY_LEDGERS;
const ORDER_THRESHOLD: u32 = ORDER_BUMP - DAY_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidAmount = 1,
    InvalidFee = 2,
    InvalidExpiry = 3,
    SameParties = 4,
    OrderNotFound = 5,
    InvalidState = 6,
    NotExpired = 7,
    Expired = 8,
    Paused = 9,
    DuplicateRef = 10,
    NoPendingAdmin = 11,
    Overflow = 12,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Status {
    /// Fondos bloqueados, esperando el pago en BOB.
    Locked,
    /// El beneficiario reclamó; decide el árbitro.
    Disputed,
    /// Final: USDC entregado al beneficiario (menos comisión).
    Released,
    /// Final: USDC devuelto completo al depositante.
    Refunded,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Order {
    pub depositor: Address,
    pub beneficiary: Address,
    pub amount: i128,
    /// Comisión fijada al crear la orden.
    pub fee: i128,
    pub expires_at: u64,
    pub status: Status,
    /// Identificador de la orden en el API de KALEA.
    pub external_ref: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    pub arbiter: Address,
    pub treasury: Address,
    pub token: Address,
    pub fee_bps: u32,
    pub paused: bool,
}

#[contracttype]
enum Key {
    Config,
    PendingAdmin,
    NextId,
    Order(u64),
    Ref(BytesN<32>),
}

// ---------- eventos ----------

#[contractevent]
pub struct Created {
    #[topic]
    pub id: u64,
    pub depositor: Address,
    pub beneficiary: Address,
    pub amount: i128,
    pub fee: i128,
    pub expires_at: u64,
}

#[contractevent]
pub struct Released {
    #[topic]
    pub id: u64,
    pub to_beneficiary: i128,
    pub fee: i128,
}

#[contractevent]
pub struct Refunded {
    #[topic]
    pub id: u64,
    pub amount: i128,
}

#[contractevent]
pub struct Disputed {
    #[topic]
    pub id: u64,
}

#[contractevent]
pub struct ConfigChanged {
    pub fee_bps: u32,
    pub paused: bool,
}

// ---------- contrato ----------

#[contract]
pub struct KaleaEscrow;

fn config(env: &Env) -> Config {
    env.storage().instance().get(&Key::Config).unwrap()
}

fn save_config(env: &Env, c: &Config) {
    env.storage().instance().set(&Key::Config, c);
    ConfigChanged {
        fee_bps: c.fee_bps,
        paused: c.paused,
    }
    .publish(env);
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
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

/// Comisión = amount * bps / 10_000, redondeada hacia abajo, con verificación de desbordamiento.
pub fn fee_for(amount: i128, fee_bps: u32) -> Result<i128, Error> {
    amount
        .checked_mul(fee_bps as i128)
        .map(|x| x / 10_000)
        .ok_or(Error::Overflow)
}

/// Paga al beneficiario (menos comisión) y la comisión a la tesorería. El estado ya debe estar en Released.
fn pay_release(env: &Env, c: &Config, id: u64, o: &Order) -> Result<(), Error> {
    let net = o.amount.checked_sub(o.fee).ok_or(Error::Overflow)?;
    let tk = token::Client::new(env, &c.token);
    let me = env.current_contract_address();
    if net > 0 {
        tk.transfer(&me, &o.beneficiary, &net);
    }
    if o.fee > 0 {
        tk.transfer(&me, &c.treasury, &o.fee);
    }
    Released {
        id,
        to_beneficiary: net,
        fee: o.fee,
    }
    .publish(env);
    Ok(())
}

/// Devuelve el monto completo al depositante (no se cobra comisión). El estado ya debe estar en Refunded.
fn pay_refund(env: &Env, c: &Config, id: u64, o: &Order) {
    token::Client::new(env, &c.token).transfer(
        &env.current_contract_address(),
        &o.depositor,
        &o.amount,
    );
    Refunded {
        id,
        amount: o.amount,
    }
    .publish(env);
}

#[contractimpl]
impl KaleaEscrow {
    /// Se ejecuta una sola vez al desplegar: no hay `init` que un tercero pueda adelantar.
    pub fn __constructor(
        env: Env,
        admin: Address,
        arbiter: Address,
        treasury: Address,
        token: Address,
        fee_bps: u32,
    ) -> Result<(), Error> {
        if fee_bps > MAX_FEE_BPS {
            return Err(Error::InvalidFee);
        }
        let c = Config {
            admin,
            arbiter,
            treasury,
            token,
            fee_bps,
            paused: false,
        };
        env.storage().instance().set(&Key::Config, &c);
        env.storage().instance().set(&Key::NextId, &0u64);
        bump_instance(&env);
        Ok(())
    }

    // ----- órdenes -----

    /// El depositante bloquea `amount` de USDC para `beneficiary`. Devuelve el id de la orden.
    pub fn create(
        env: Env,
        depositor: Address,
        beneficiary: Address,
        amount: i128,
        ttl_secs: u64,
        external_ref: BytesN<32>,
    ) -> Result<u64, Error> {
        depositor.require_auth();
        let c = config(&env);
        if c.paused {
            return Err(Error::Paused);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if depositor == beneficiary {
            return Err(Error::SameParties);
        }
        if !(MIN_TTL_SECS..=MAX_TTL_SECS).contains(&ttl_secs) {
            return Err(Error::InvalidExpiry);
        }
        let ref_key = Key::Ref(external_ref.clone());
        if env.storage().persistent().has(&ref_key) {
            return Err(Error::DuplicateRef);
        }
        let fee = fee_for(amount, c.fee_bps)?;
        let expires_at = env
            .ledger()
            .timestamp()
            .checked_add(ttl_secs)
            .ok_or(Error::Overflow)?;
        let id: u64 = env.storage().instance().get(&Key::NextId).unwrap_or(0);
        let next = id.checked_add(1).ok_or(Error::Overflow)?;

        // efectos antes de la interacción con el token
        let o = Order {
            depositor: depositor.clone(),
            beneficiary: beneficiary.clone(),
            amount,
            fee,
            expires_at,
            status: Status::Locked,
            external_ref,
        };
        env.storage().instance().set(&Key::NextId, &next);
        save(&env, id, &o);
        env.storage().persistent().set(&ref_key, &id);
        env.storage()
            .persistent()
            .extend_ttl(&ref_key, ORDER_THRESHOLD, ORDER_BUMP);
        bump_instance(&env);

        token::Client::new(&env, &c.token).transfer(
            &depositor,
            env.current_contract_address(),
            &amount,
        );
        Created {
            id,
            depositor,
            beneficiary,
            amount,
            fee,
            expires_at,
        }
        .publish(&env);
        Ok(id)
    }

    /// El depositante confirma que recibió los bolivianos y libera el USDC al beneficiario.
    /// También vale con la orden en disputa (el depositante cede).
    pub fn release(env: Env, id: u64) -> Result<(), Error> {
        let mut o = load(&env, id)?;
        o.depositor.require_auth();
        if o.status != Status::Locked && o.status != Status::Disputed {
            return Err(Error::InvalidState);
        }
        o.status = Status::Released;
        save(&env, id, &o);
        pay_release(&env, &config(&env), id, &o)
    }

    /// El beneficiario renuncia a la orden: los fondos vuelven completos al depositante.
    pub fn cancel(env: Env, id: u64) -> Result<(), Error> {
        let mut o = load(&env, id)?;
        o.beneficiary.require_auth();
        if o.status != Status::Locked {
            return Err(Error::InvalidState);
        }
        o.status = Status::Refunded;
        save(&env, id, &o);
        pay_refund(&env, &config(&env), id, &o);
        Ok(())
    }

    /// Vencida y sin disputa, cualquiera puede devolver los fondos al depositante (no hay otro destino posible).
    pub fn refund(env: Env, id: u64) -> Result<(), Error> {
        let mut o = load(&env, id)?;
        if o.status != Status::Locked {
            return Err(Error::InvalidState);
        }
        if env.ledger().timestamp() < o.expires_at {
            return Err(Error::NotExpired);
        }
        o.status = Status::Refunded;
        save(&env, id, &o);
        pay_refund(&env, &config(&env), id, &o);
        Ok(())
    }

    /// El beneficiario pagó y no le liberan: abre una disputa antes del vencimiento.
    pub fn dispute(env: Env, id: u64) -> Result<(), Error> {
        let mut o = load(&env, id)?;
        o.beneficiary.require_auth();
        if o.status != Status::Locked {
            return Err(Error::InvalidState);
        }
        if env.ledger().timestamp() >= o.expires_at {
            return Err(Error::Expired);
        }
        o.status = Status::Disputed;
        save(&env, id, &o);
        Disputed { id }.publish(&env);
        Ok(())
    }

    /// El árbitro resuelve una disputa: libera al beneficiario o devuelve al depositante.
    pub fn resolve(env: Env, id: u64, release_to_beneficiary: bool) -> Result<(), Error> {
        let c = config(&env);
        c.arbiter.require_auth();
        let mut o = load(&env, id)?;
        if o.status != Status::Disputed {
            return Err(Error::InvalidState);
        }
        if release_to_beneficiary {
            o.status = Status::Released;
            save(&env, id, &o);
            pay_release(&env, &c, id, &o)
        } else {
            o.status = Status::Refunded;
            save(&env, id, &o);
            pay_refund(&env, &c, id, &o);
            Ok(())
        }
    }

    // ----- administración -----

    pub fn set_fee(env: Env, fee_bps: u32) -> Result<(), Error> {
        let mut c = config(&env);
        c.admin.require_auth();
        if fee_bps > MAX_FEE_BPS {
            return Err(Error::InvalidFee);
        }
        c.fee_bps = fee_bps;
        save_config(&env, &c);
        Ok(())
    }

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

    pub fn set_treasury(env: Env, treasury: Address) {
        let mut c = config(&env);
        c.admin.require_auth();
        c.treasury = treasury;
        save_config(&env, &c);
    }

    /// Paso 1 del traspaso de admin: el admin actual propone.
    pub fn propose_admin(env: Env, new_admin: Address) {
        config(&env).admin.require_auth();
        env.storage().instance().set(&Key::PendingAdmin, &new_admin);
    }

    /// Paso 2: el propuesto acepta firmando (evita perder el control por una dirección mal escrita).
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

    /// Actualiza el código del contrato (solo admin). El almacenamiento y los fondos se conservan.
    pub fn upgrade(env: Env, wasm_hash: BytesN<32>) {
        config(&env).admin.require_auth();
        env.deployer()
            .update_current_contract(ContractExecutable::Wasm(wasm_hash));
    }

    // ----- lectura -----

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
