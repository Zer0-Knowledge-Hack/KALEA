# Contratos Soroban

## `escrow`: escrow de USDC por orden

KALEA es infraestructura de pagos P2P B2B: las apps nos integran, sus usuarios en Bolivia pagan en bolivianos
(QR Simple o transferencia) a un socio local verificado, y la liquidación ocurre en USDC sobre Stellar. Este contrato
custodia el USDC de cada orden mientras el pago en BOB ocurre fuera de la cadena. KALEA nunca es contraparte.

### Roles

| Rol | Quién es | Puede |
|---|---|---|
| Depositante | Socio local (pay-in) o la app (pay-out) | `create`, `release` |
| Beneficiario | La app (pay-in) o el socio local (pay-out) | `dispute`, `cancel` |
| Árbitro | Cuenta de resolución de KALEA | `resolve` |
| Admin | Multisig de KALEA | `set_fee`, `set_paused`, `set_arbiter`, `set_treasury`, `propose_admin`, `upgrade` |
| Cualquiera | — | `refund` de una orden vencida y sin disputa (solo puede devolver al depositante) |

### Estados

```
create ──► Locked ──release──────────────► Released (beneficiario recibe monto − comisión)
             │  ├──cancel (beneficiario)──► Refunded (depositante recibe todo)
             │  └──refund (al vencer)─────► Refunded
             └──dispute (antes de vencer)─► Disputed ──resolve(true) / release──► Released
                                                     └─resolve(false)────────────► Refunded
```

**Solo quien recibe los bolivianos puede liberar.** Si no lo hace, el beneficiario abre una disputa antes del
vencimiento y decide el árbitro. Sin disputa, la orden vence y los fondos vuelven al depositante.

### Seguridad

- Cada acción exige la firma (`require_auth`) del rol correspondiente.
- Máquina de estados estricta: `Released` y `Refunded` son finales, así que una orden se liquida una sola vez.
- El estado se guarda antes de transferir (checks-effects-interactions).
- La comisión se fija al crear la orden, con un tope de 1 % (`MAX_FEE_BPS`). Cambiarla no afecta las órdenes abiertas.
  Si la orden se devuelve, no se cobra comisión.
- La pausa solo frena órdenes nuevas: liberar, cancelar, devolver y resolver siguen funcionando, así que los fondos
  nunca quedan trabados.
- Se acepta un solo token (USDC), fijado en el constructor. No existe un `init` que un tercero pueda ejecutar antes.
- La referencia externa (el id de la orden en el API) es única: no puede haber dos escrows para la misma orden.
- Toda la aritmética verifica desbordamientos, también en el perfil release (`overflow-checks = true`).
- El traspaso de admin es en dos pasos (propuesta y aceptación).
- Se extiende el TTL de la instancia y de cada orden para que el almacenamiento no expire mientras hay fondos.
- Vencimiento permitido: entre 5 minutos y 7 días.

### Tests

```bash
cargo test
```

Son 33 tests y cubren:
- los flujos pay-in y pay-out completos;
- las disputas en ambos sentidos;
- los vencimientos en sus límites exactos;
- referencias duplicadas y reversión sin dejar rastro;
- llamadas sin firmas y con la firma equivocada (por ejemplo, el beneficiario intentando liberarse a sí mismo o el
  depositante resolviendo su propia disputa);
- la pausa y la administración;
- el redondeo y el desbordamiento de la comisión;
- un invariante de conservación de fondos sobre 20 órdenes mixtas.

Además pasamos una prueba de mutación: se quitaron por separado 7 controles de seguridad y la suite falló en todos
los casos. Los controles quitados fueron:
- la firma en `release`;
- el vencimiento en `refund`;
- el estado final;
- la firma del árbitro;
- el tope de comisión;
- la referencia única;
- la pausa que no traba fondos.

### Compilar y desplegar (testnet)

```bash
stellar contract build
```

```bash
stellar contract deploy --wasm target/wasm32v1-none/release/kalea_escrow.wasm --source <cuenta> --network testnet -- --admin <G…> --arbiter <G…> --treasury <G…> --token <contrato USDC> --fee_bps 50
```

Desplegado en testnet: ver [deployments/testnet.md](deployments/testnet.md).

Pendiente antes de mainnet: auditoría externa, admin y árbitro como multisig, y monitoreo de los eventos `Created`,
`Released`, `Refunded`, `Disputed` y `ConfigChanged`.
