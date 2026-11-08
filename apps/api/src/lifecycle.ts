/**
 * Order lifecycle SIMULATION pending the Soroban escrow (docs/order-lifecycle.md).
 * No funds move on-chain: escrow ids are synthetic, and the fee debit, reward vault credit and
 * insurance contribution are in-memory bookkeeping that mirror what the escrow will do on release.
 */
import {
  USDC_DECIMALS,
  canTransition,
  isTerminalStatus,
  roundTo,
  type RampOrder,
  type RampOrderStatus,
  type Side,
} from "@kalea/shared";
import type { Actor } from "./auth.js";
import { ApiError } from "./errors.js";
import type { Store } from "./store.js";

export const EVENT_TYPES = ["escrow_locked", "fiat_sent", "released", "cancelled", "disputed", "expired"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const REWARD_LOCK_MS = 7 * 24 * 60 * 60_000;

type ActorKind = Actor["kind"];
const EITHER: ActorKind[] = ["integrator", "merchant"];

/**
 * Who may drive each transition. The integrator acts on behalf of its end user.
 * `expired` stands in for the timeout trigger and `disputed` for "either party"; resolving a dispute
 * (leaving `disputed`) has no owner yet (open decision), so nobody may do it through the API.
 */
const ACTORS: Record<Side, Record<EventType, ActorKind[]>> = {
  buy: { escrow_locked: ["merchant"], fiat_sent: ["integrator"], released: ["merchant"], cancelled: ["integrator"], disputed: EITHER, expired: EITHER },
  sell: { escrow_locked: ["integrator"], fiat_sent: ["merchant"], released: ["integrator"], cancelled: EITHER, disputed: EITHER, expired: EITHER },
};

const sum = (values: number[]) => roundTo(values.reduce((a, b) => a + b, 0), USDC_DECIMALS);
const isOpen = (o: RampOrder) => !isTerminalStatus(o.status);

/** Fees of open orders, held against the integrator's prefunded balance until release or refund. */
export const reservedFeesUsdc = (store: Store, integratorId: string) =>
  sum([...store.orders.values()].filter((o) => o.integratorId === integratorId && isOpen(o)).map((o) => o.breakdown.integratorFeeUsdc));

/** USDC a merchant has committed to open orders (the escrow amount on either side). */
export const committedUsdc = (store: Store, merchantId: string) =>
  sum([...store.orders.values()].filter((o) => o.merchantId === merchantId && isOpen(o)).map((o) => o.breakdown.escrowUsdc));

export function applyEvent(store: Store, order: RampOrder, to: RampOrderStatus & EventType, actor: Actor, now: number): RampOrder {
  const allowed = ACTORS[order.side][to].includes(actor.kind);
  // Idempotent retry: repeating the transition that produced the current status returns it unchanged.
  if (order.status === to && allowed) return order;
  if (!canTransition(order.status, to)) throw new ApiError(409, "invalid_transition", `Cannot move an order from ${order.status} to ${to}`);
  if (order.status === "disputed") throw new ApiError(403, "forbidden_actor", "Dispute resolution is not available through the API yet");
  if (!allowed) throw new ApiError(403, "forbidden_actor", `A ${actor.kind} cannot set ${to} on a ${order.side} order`);

  const at = new Date(now).toISOString();
  const next: RampOrder = { ...order, status: to, updatedAt: at };
  if (to === "escrow_locked") next.escrowId = `sim_escrow_${crypto.randomUUID()}`;
  if (to === "released") {
    const { integratorFeeUsdc, merchantRewardUsdc, insuranceUsdc } = order.breakdown;
    const integrator = store.integrators.get(order.integratorId)!;
    integrator.prefundedBalanceUsdc = roundTo(integrator.prefundedBalanceUsdc - integratorFeeUsdc, USDC_DECIMALS);
    store.feeLedger.push({ integratorId: integrator.id, orderId: order.id, amountUsdc: integratorFeeUsdc, at });
    store.rewardVault.push({
      merchantId: order.merchantId,
      orderId: order.id,
      amountUsdc: merchantRewardUsdc,
      releasedAt: at,
      unlockAt: new Date(now + REWARD_LOCK_MS).toISOString(),
    });
    store.insuranceFundUsdc = roundTo(store.insuranceFundUsdc + insuranceUsdc, USDC_DECIMALS);
  }
  store.orders.set(next.id, next);
  return next;
}

/** Integrators see exact amounts and the fee they pay, never the internal breakdown. */
export function integratorView(order: RampOrder) {
  const { breakdown, ...rest } = order;
  return { ...rest, kind: order.kind ?? "transfer", integratorFeeUsdc: breakdown.integratorFeeUsdc };
}

/** Merchants see exact amounts plus their reward; never the Kalea fee or the integrator's identity. */
export function merchantView(order: RampOrder) {
  const { breakdown, integratorId: _integratorId, endUserRef: _endUserRef, ...rest } = order;
  return { ...rest, kind: order.kind ?? "transfer", merchantRewardUsdc: breakdown.merchantRewardUsdc, escrowUsdc: breakdown.escrowUsdc };
}
