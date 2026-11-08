export * from "./domain";

/**
 * @deprecated Legacy exports kept only so apps/api and apps/web compile; removed in T3/T4.
 * The explicit re-exports below shadow the canonical Order, Quote and OrderStatus from ./domain
 * until then. New code imports the canonical shapes as RampOrder, RampQuote and RampOrderStatus
 * (or from ./domain inside this package). When T3/T4 land, delete these lines and legacy.ts.
 */
export * from "./legacy";
export type { LegacyOrder as Order, LegacyQuote as Quote, LegacyOrderStatus as OrderStatus } from "./legacy";
export type { Order as RampOrder, Quote as RampQuote, OrderStatus as RampOrderStatus } from "./domain";
