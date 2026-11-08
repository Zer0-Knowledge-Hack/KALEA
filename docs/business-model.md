# Business model

Kalea earns only from integrators. End users see one all-in price, merchants see exact amounts plus their reward, and neither sees a Kalea fee.

## Actors

| Actor | Who | Relationship with Kalea |
| --- | --- | --- |
| **Integrator** | Any business or system that embeds the ramp | Customer. Holds a prefunded USDC balance and pays a per-transaction fee |
| **End user** | The integrator's customer | Indirect. Buys or sells USDC inside the integrator's product |
| **Merchant / LP** | Independent liquidity provider | Partner. Moves local fiat under their own accounts and earns a reward |
| **Kalea** | Infrastructure operator | Matching, pricing, escrow, disputes and the insurance fund |

Local fiat moves only between the end user and the merchant, under their own accounts. Kalea never holds local fiat. USDC is held by the per-order escrow contract under its rules until it is released or refunded.

## Revenue: integrators only

- **Per-transaction fee**, debited from the integrator's prefunded USDC balance when an order is released.
- **Volume tiers**: the fee rate decreases as the integrator's monthly volume grows. TODO (open decision): tier thresholds and rates.
- **Integrator markup**: integrators may add their own markup on top of the Kalea price. Kalea does not set it. TODO (open decision): how the markup is collected (an extra escrow split to the integrator, or settled by the integrator outside Kalea).
- **No fee to end users or merchants.** No receipt shown to them contains a Kalea fee line.

## Pricing: per country, per side

Prices are quoted over a market reference rate (mid) for each country's currency.

| Side | Price | The spread funds |
| --- | --- | --- |
| Buy (on-ramp: fiat -> USDC) | mid + markup | Merchant reward + insurance fund |
| Sell (off-ramp: USDC -> fiat) | mid - discount | Merchant reward + insurance fund |
| QR payment (USDC -> fiat paid to a third-party QR) | mid - discount | Merchant reward + insurance fund |

| Parameter | Launch reference | Configurable |
| --- | --- | --- |
| Merchant reward (buys, sells and QR payments) | 1.5% | Per country |
| Insurance fund contribution | ~0.1% per order | Yes |

## Merchant reward

- Paid in USDC into a reward vault at release.
- **Locked in 7-day cycles.** The lock is a fraud buffer (a disputed order can be settled against unvested rewards) and a retention mechanism.
- The merchant receipt shows the exact order amounts and, on a separate line, **"earned X USDC"**.

## Worked example (illustrative)

All numbers below are illustrative. They assume a 1.5% reward, a 0.1% insurance contribution, an illustrative 0.75% Kalea fee, no integrator markup, and amounts expressed in USD-equivalent at mid. The 1.5% reward applies to every order type.

**Buy: end user receives 100 USDC**

| Step | Amount |
| --- | --- |
| End user pays the merchant in local fiat | 101.60 USD-equivalent (mid + 1.6%) |
| Merchant locks in escrow | 101.60 USDC |
| Released to the end user's destination | 100.00 USDC |
| Released to the merchant reward vault (locked 7 days) | 1.50 USDC |
| Released to the insurance fund | 0.10 USDC |
| Debited from the integrator's prefunded balance | 0.75 USDC |

Merchant receipt: "Sent 101.60 USDC, received 101.60 USD-equivalent in local fiat. Earned 1.50 USDC."

**Sell: end user sells 100 USDC**

| Step | Amount |
| --- | --- |
| End user locks in escrow | 100.00 USDC |
| Merchant pays the end user in local fiat | 98.40 USD-equivalent (mid - 1.6%) |
| Released to the merchant | 98.40 USDC |
| Released to the merchant reward vault (locked 7 days) | 1.50 USDC |
| Released to the insurance fund | 0.10 USDC |
| Debited from the integrator's prefunded balance | 0.75 USDC |

Merchant receipt: "Sent 98.40 USD-equivalent in local fiat, received 98.40 USDC. Earned 1.50 USDC."

## Integrator types

| Type | Example use |
| --- | --- |
| Wallets | Let users top up or cash out USDC in local currency |
| Payment collection | Accept local fiat and settle in USDC |
| SaaS platforms | Pay out or collect from users across LATAM countries |
| Others | Any system that needs a fiat <-> USDC leg, such as auditors or marketplaces |

## Costs and breakeven

- Operating costs: about **$500/month** (infrastructure, services, tooling). No salaries in this phase.
- Breakeven monthly volume = monthly cost / Kalea effective fee rate.

| Effective fee rate (parameter) | Monthly volume to cover $500 |
| --- | --- |
| 0.50% | $100,000 |
| 0.75% | ~$66,700 |
| 1.00% | $50,000 |

The effective rate is a blended average across volume tiers. Rates in this table are parameters, not commitments.

## Competitive context

- **P2PKit / p2p.me** run a P2P fiat <-> USDC model on Base. We have found no Stellar presence for them.
- **Stellar anchors** in the region typically serve a single country.
- Kalea's position: one integrator API across multiple LATAM countries, settled in Stellar USDC, with liquidity from independent merchants.

## Regulation

Regulation and licensing are out of MVP scope. Requirements will be assessed per country before operating with real funds.
