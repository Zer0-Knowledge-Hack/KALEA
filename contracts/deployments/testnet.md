# Despliegue en Stellar testnet

Fecha: 7 nov 2026 · soroban-sdk 28 · stellar-cli 28.0.0 · comisión 0,5 % (50 bps)

| Pieza | Dirección |
|---|---|
| Escrow `kalea-escrow` | [CDFCVMPAIZGB732SXSYYRWQLHXJ44AF4RWWSLCQM2MQBIOBYACDXQ6RY](https://stellar.expert/explorer/testnet/contract/CDFCVMPAIZGB732SXSYYRWQLHXJ44AF4RWWSLCQM2MQBIOBYACDXQ6RY) |
| USDC **de prueba** (SAC, emisor propio) | [CDZK3ANWKUPLKOMPUXC26F6YM67M7NYSY5S5RJZR2JXEUJ7BZ4DSRJ3M](https://stellar.expert/explorer/testnet/contract/CDZK3ANWKUPLKOMPUXC26F6YM67M7NYSY5S5RJZR2JXEUJ7BZ4DSRJ3M) |
| Admin | GCJJIHWIWH5LTBETF5V5ZTR7Z7RG5K5JIWZRRKX2UP62QW6YA2XYZ2FD |
| Árbitro | GBUXMUBIIZL7BO7UOBSI46QOGVNRZV6VINUC26EOB3JQ6DLZ7YWY7VAW |
| Tesorería | GDJWOQUNLWRS7QCRDTWFVZDFIGNRMGGCQ6M2YUVEWP4PBANPLFDCNO47 |
| Socio local (depositante de prueba) | GBRF4NYPPQV32EGBINL7TSM6ZR4WZV7IVZAXPMTYYVWL6IVPKX3M3WPC |
| App integradora (beneficiaria de prueba) | GAYAPDYMZGNV7YOWTTKECCZSINFMTLT6CRIYTAFVK3AKTVOM2CRC7JLB |

El USDC es un activo de prueba emitido por nosotros (`USDC:GDZKUSTW…YM2K`). No es el USDC de Circle. Para el piloto
se cambia por el USDC oficial de testnet.

## Órdenes ejecutadas on-chain

| # | Flujo | Transacciones |
|---|---|---|
| 0 | Pay-in: el socio bloquea 100 USDC y libera; la app recibe 99,5 y la tesorería 0,5 | [create](https://stellar.expert/explorer/testnet/tx/e48867ec909ce07ada5010a9b0327719e38513d30feb4eedc997f93ca689b398) · [release](https://stellar.expert/explorer/testnet/tx/8a05707b01f1adfae561de286fd90bd450da358d86b3c9d7a951647da4ed9ccc) |
| 1 | Disputa: 50 USDC, la app disputa y el árbitro resuelve a su favor (49,75 + 0,25 de comisión) | [create](https://stellar.expert/explorer/testnet/tx/56e6923b37b988993bcb331d64d33cc555c0dc3605c8f00668bf951c05360848) · [dispute](https://stellar.expert/explorer/testnet/tx/0f2a98946e438d884d8da9d5c94dda37e30cf5c913575ff8210a4cc4fc3029b4) · [resolve](https://stellar.expert/explorer/testnet/tx/f4cc453efb76ad27545c60127245199d1fff107a9c5f91e1a2b5499cf501f50e) |
| 2 | Cancelación: 20 USDC, la app renuncia y el socio recupera todo sin comisión | [create](https://stellar.expert/explorer/testnet/tx/e915eba124d035e60135f4a1caf54491d587129a0eed7a19a8f9b8aa501ecb34) · [cancel](https://stellar.expert/explorer/testnet/tx/ba7ce9bca55ece36f11eff0233d8a832b66eb7aa1af43b82ce90374aa1022b81) |
| 3 | 10 USDC bloqueados, abierta (vence en 1 h; después cualquiera puede devolverla al socio) | [create](https://stellar.expert/explorer/testnet/tx/aa9a88df891218a2aa1a90bde9185ac99a038ad9ee9c2f5fd1195eb21c3c4ded) |

Rechazos verificados:
- La app intentó liberar la orden 3: rechazado, porque el contrato exige la firma del socio.
- Se repitió la referencia de la orden 3: `Error(Contract, #10)` (`DuplicateRef`).

Saldos finales:

| Cuenta | Saldo | Cuenta |
|---|---|---|
| Socio | 840 USDC | 1000 − 100 − 50 − 20 − 10 + 20 |
| App | 1149,25 USDC | 1000 + 99,5 + 49,75 |
| Tesorería | 0,75 USDC | |
| Escrow | 10 USDC | orden 3 abierta |

Cuadra al stroop.
