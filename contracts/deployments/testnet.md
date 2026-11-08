# Testnet deployment (escrow v0)

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
