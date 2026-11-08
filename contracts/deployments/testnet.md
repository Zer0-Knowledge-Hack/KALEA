# Testnet deployments

## Escrow v1 (current, canonical lifecycle)

Date: 2026-11-07. soroban-sdk 28, stellar-cli 28.0.0. Lifecycle: `escrow_locked -> fiat_sent -> released`, plus `cancelled`, `expired`, `disputed`.

| Piece | Address |
|---|---|
| Escrow `kalea-escrow-v1` | [CBKPJ3FD7KN6OMY6LRAP7KYHFVOT5UPLTCRW4CQGBU7NC72JUKGUGD2Q](https://stellar.expert/explorer/testnet/contract/CBKPJ3FD7KN6OMY6LRAP7KYHFVOT5UPLTCRW4CQGBU7NC72JUKGUGD2Q) |
| **Test** USDC (same SAC as v0) | CDZK3ANWKUPLKOMPUXC26F6YM67M7NYSY5S5RJZR2JXEUJ7BZ4DSRJ3M |
| Operator | GAJCSA6IKXW4ZIXXZE5T5AWHQLAMZI3KUX3TQH2P6BQWROHH65DD5YW5 |
| Reward vault (plain account until the vault contract exists) | GA47ZYGJ6QAEP7HXEMRYSCKDULQ5MJ5YOBDACJAJKBV6RQEBYFBCPUQK |
| Insurance fund (plain account until the fund contract exists) | GDADBKIWG6JNVOO6EBGJX6FPZUWZKX3OE66WJSJPSDETYJAWM36U7R3E |

Admin, arbiter, merchant (partner) and integrator (app) are the same accounts as v0. Every order: 100 USDC to the recipient + 1.5 reward + 0.1 insurance = 101.6 locked.

| # | Flow | Transactions |
|---|---|---|
| 0 | Buy: merchant locks, app marks fiat paid, merchant releases | [lock](https://stellar.expert/explorer/testnet/tx/7f8253afb8abb6e3b68917cdb32a6f2d57e1b36f8f3325c4d2e989bee1f70522) · [mark_paid](https://stellar.expert/explorer/testnet/tx/2ca9e9d083cbfcc0fc82eed1040de9de54fd1b3e1877c8c1fac79f3082356c0a) · [release](https://stellar.expert/explorer/testnet/tx/00a80e817a61f65675a4760b0359603b00bfa9ebc3b952b6e551765e6465551a) |
| 1 | Sell: app locks, merchant marks fiat paid, app releases | [lock](https://stellar.expert/explorer/testnet/tx/33b1915e44bfa1fb45b5d2a5d5750d28058f5de0ecc323e8817715add149ec5b) · [mark_paid](https://stellar.expert/explorer/testnet/tx/e43d618e5a906278f9bc6bc2922bbe0bc54a1c110c67ae4700660af8a4b2f5f1) · [release](https://stellar.expert/explorer/testnet/tx/a0af715558052590d6128caa449724e3a0293820d86d5e88d55ab2617f2f1ca8) |
| 2 | Dispute: app marks paid and disputes, arbiter rules fiat was not paid, full refund | [lock](https://stellar.expert/explorer/testnet/tx/14c04a33f7312e83306382fa9682361269006863a7bb0f95c10f6e31d7f7ea8b) · [mark_paid](https://stellar.expert/explorer/testnet/tx/7752f16e7dcaeaf8955e5f890617b20c158cf09059e984fe05e28c0997e51b13) · [dispute](https://stellar.expert/explorer/testnet/tx/4aa2ef2b04921071e1599a86f1886feefd342535ec18ec41437354a43daf2ff8) · [resolve](https://stellar.expert/explorer/testnet/tx/71a1f8f56249eae9ed26af2ddc950fc0c8104bbce550a20707eb21e5fbced38d) |
| 3 | Expire: 60 s payment timeout, nobody marks paid, refunded to the merchant | [lock](https://stellar.expert/explorer/testnet/tx/97f538ba3e303980ff4f4ba5bda2c3e7261ce104a10331d603e6398c19aa797e) · [expire](https://stellar.expert/explorer/testnet/tx/80a2d9b0651b3885f421e50b6077c471c8ee4a4a187da4fe36cbcc02ba95dc05) |

Verified rejections: the app tried to release order 3 (rejected), and a new lock reused order 0's reference (rejected, `DuplicateRef`).

Final balances: merchant 838.4, app 1147.65, reward vault 3, insurance fund 0.2, escrow 0. They reconcile with v0's end state (840 / 1149.25) to the stroop.

## Escrow v0 (superseded)

Date: 2026-11-07. soroban-sdk 28, stellar-cli 28.0.0, fee 0.5% (50 bps).

| Piece | Address |
|---|---|
| Escrow `kalea-escrow` | [CDFCVMPAIZGB732SXSYYRWQLHXJ44AF4RWWSLCQM2MQBIOBYACDXQ6RY](https://stellar.expert/explorer/testnet/contract/CDFCVMPAIZGB732SXSYYRWQLHXJ44AF4RWWSLCQM2MQBIOBYACDXQ6RY) |
| **Test** USDC (SAC, our own issuer) | [CDZK3ANWKUPLKOMPUXC26F6YM67M7NYSY5S5RJZR2JXEUJ7BZ4DSRJ3M](https://stellar.expert/explorer/testnet/contract/CDZK3ANWKUPLKOMPUXC26F6YM67M7NYSY5S5RJZR2JXEUJ7BZ4DSRJ3M) |
| Admin | GCJJIHWIWH5LTBETF5V5ZTR7Z7RG5K5JIWZRRKX2UP62QW6YA2XYZ2FD |
| Arbiter | GBUXMUBIIZL7BO7UOBSI46QOGVNRZV6VINUC26EOB3JQ6DLZ7YWY7VAW |
| Treasury | GDJWOQUNLWRS7QCRDTWFVZDFIGNRMGGCQ6M2YUVEWP4PBANPLFDCNO47 |
| Merchant (test depositor) | GBRF4NYPPQV32EGBINL7TSM6ZR4WZV7IVZAXPMTYYVWL6IVPKX3M3WPC |
| Integrator (test beneficiary) | GAYAPDYMZGNV7YOWTTKECCZSINFMTLT6CRIYTAFVK3AKTVOM2CRC7JLB |

The USDC above is a test asset we issued (`USDC:GDZKUSTW...YM2K`), not Circle's USDC. The pilot will use the official
testnet USDC.

## Orders executed on-chain

| # | Flow | Transactions |
|---|---|---|
| 0 | Buy: merchant locks 100 USDC and releases; integrator receives 99.5, treasury 0.5 | [create](https://stellar.expert/explorer/testnet/tx/e48867ec909ce07ada5010a9b0327719e38513d30feb4eedc997f93ca689b398) · [release](https://stellar.expert/explorer/testnet/tx/8a05707b01f1adfae561de286fd90bd450da358d86b3c9d7a951647da4ed9ccc) |
| 1 | Dispute: 50 USDC; the integrator disputes and the arbiter resolves in its favor (49.75 + 0.25 fee) | [create](https://stellar.expert/explorer/testnet/tx/56e6923b37b988993bcb331d64d33cc555c0dc3605c8f00668bf951c05360848) · [dispute](https://stellar.expert/explorer/testnet/tx/0f2a98946e438d884d8da9d5c94dda37e30cf5c913575ff8210a4cc4fc3029b4) · [resolve](https://stellar.expert/explorer/testnet/tx/f4cc453efb76ad27545c60127245199d1fff107a9c5f91e1a2b5499cf501f50e) |
| 2 | Cancel: 20 USDC; the integrator cancels and the merchant gets everything back, no fee | [create](https://stellar.expert/explorer/testnet/tx/e915eba124d035e60135f4a1caf54491d587129a0eed7a19a8f9b8aa501ecb34) · [cancel](https://stellar.expert/explorer/testnet/tx/ba7ce9bca55ece36f11eff0233d8a832b66eb7aa1af43b82ce90374aa1022b81) |
| 3 | 10 USDC locked and left open (expires after 1 h; then anyone can refund it to the merchant) | [create](https://stellar.expert/explorer/testnet/tx/aa9a88df891218a2aa1a90bde9185ac99a038ad9ee9c2f5fd1195eb21c3c4ded) |

Verified rejections:
- The integrator tried to release order 3. Rejected: the contract requires the merchant's signature.
- A second order reused order 3's reference. Rejected with `Error(Contract, #10)` (`DuplicateRef`).

Final balances (they reconcile to the stroop):

| Account | Balance | Breakdown |
|---|---|---|
| Merchant | 840 | 1000 - 100 - 50 - 20 - 10 + 20 |
| Integrator | 1149.25 | 1000 + 99.5 + 49.75 |
| Treasury | 0.75 | |
| Escrow | 10 | order 3 |
