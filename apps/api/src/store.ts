import {
  DEMO_CORRIDOR_PRICING,
  DEMO_INTEGRATORS,
  DEMO_MERCHANTS,
  type CorridorPricing,
  type Integrator,
  type Merchant,
  type RampOrder,
} from "@kalea/shared";

/** SHA-256 hex digest of an integrator API key. Raw keys are never stored. */
export interface IntegratorKey {
  integratorId: string;
  keyHash: string;
}

/** Links a merchant to the Stellar account it signs SEP-10 challenges with. */
export interface MerchantAccount {
  merchantId: string;
  account: string;
}

/** A merchant reward locked for a 7-day cycle after the order is released. */
export interface RewardEntry {
  merchantId: string;
  orderId: string;
  amountUsdc: number;
  releasedAt: string;
  unlockAt: string;
}

export interface StoreSeed {
  integrators: Integrator[];
  merchants: Merchant[];
  pricing: CorridorPricing[];
  integratorKeys: IntegratorKey[];
  merchantAccounts: MerchantAccount[];
}

export type Store = ReturnType<typeof createStore>;

/**
 * In-memory store seeded from shared demo data; replace with a database before the pilot.
 * Seed records are copied so every store (one per app instance) has isolated state.
 */
export function createStore(seed: Partial<StoreSeed> = {}) {
  const integrators = new Map((seed.integrators ?? DEMO_INTEGRATORS).map((i) => [i.id, { ...i }]));
  return {
    integrators,
    merchants: (seed.merchants ?? DEMO_MERCHANTS).map((m) => ({ ...m })),
    pricing: seed.pricing ?? DEMO_CORRIDOR_PRICING,
    integratorKeys: (seed.integratorKeys ?? []).filter((k) => integrators.has(k.integratorId)),
    merchantAccounts: seed.merchantAccounts ?? [],
    orders: new Map<string, RampOrder>(),
    /** Merchant reward vault (simulation of the Soroban reward vault). */
    rewardVault: [] as RewardEntry[],
    /** Fees debited per integrator on release (fee statement). */
    feeLedger: [] as { integratorId: string; orderId: string; amountUsdc: number; at: string }[],
    insuranceFundUsdc: 0,
  };
}
