/**
 * @deprecated Legacy BOB-only P2P model. Removed once apps/api (T3) and apps/web (T4)
 * migrate to the canonical domain in ./domain. Do not use in new code.
 */
import type { Side } from "./domain";

export type PaymentMethod = "qr_simple" | "bank_transfer";

export type LegacyOrderStatus =
  | "quoted"
  | "awaiting_fiat"
  | "fiat_sent"
  | "escrow_locked"
  | "released"
  | "cancelled"
  | "disputed";

export interface Operator {
  id: string;
  alias: string;
  completedOrders: number;
  rating: number;
  methods: PaymentMethod[];
}

export interface Offer {
  id: string;
  operatorId: string;
  side: Side;
  /** BOB per USDC */
  rate: number;
  minBob: number;
  maxBob: number;
  methods: PaymentMethod[];
}

export interface QuoteRequest {
  side: Side;
  amountBob: number;
  method: PaymentMethod;
}

export interface LegacyQuote {
  offer: Offer;
  operator: Operator;
  amountBob: number;
  amountUsdc: number;
  expiresAt: string;
}

export interface LegacyOrder {
  id: string;
  userId: string;
  offerId: string;
  side: Side;
  method: PaymentMethod;
  amountBob: number;
  amountUsdc: number;
  rate: number;
  status: LegacyOrderStatus;
  stellarTxHash?: string;
  createdAt: string;
  updatedAt: string;
}

export const ORDER_FLOW: LegacyOrderStatus[] = [
  "quoted",
  "awaiting_fiat",
  "fiat_sent",
  "escrow_locked",
  "released",
];

export const toUsdc = (amountBob: number, rate: number) =>
  Math.floor((amountBob / rate) * 100) / 100;

export const DEMO_OPERATORS: Operator[] = [
  { id: "op_1", alias: "Andes Cambio", completedOrders: 412, rating: 4.9, methods: ["qr_simple", "bank_transfer"] },
  { id: "op_2", alias: "Illimani P2P", completedOrders: 188, rating: 4.7, methods: ["qr_simple"] },
  { id: "op_3", alias: "Chuqui USDC", completedOrders: 96, rating: 4.8, methods: ["bank_transfer"] },
];

export const DEMO_OFFERS: Offer[] = [
  { id: "of_1", operatorId: "op_1", side: "buy", rate: 9.62, minBob: 100, maxBob: 20000, methods: ["qr_simple", "bank_transfer"] },
  { id: "of_2", operatorId: "op_2", side: "buy", rate: 9.58, minBob: 50, maxBob: 5000, methods: ["qr_simple"] },
  { id: "of_3", operatorId: "op_3", side: "buy", rate: 9.66, minBob: 500, maxBob: 50000, methods: ["bank_transfer"] },
  { id: "of_4", operatorId: "op_1", side: "sell", rate: 9.41, minBob: 100, maxBob: 20000, methods: ["qr_simple", "bank_transfer"] },
  { id: "of_5", operatorId: "op_2", side: "sell", rate: 9.45, minBob: 50, maxBob: 5000, methods: ["qr_simple"] },
];

export function rankQuotes(offers: Offer[], operators: Operator[], q: QuoteRequest): LegacyQuote[] {
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  return offers
    .filter((o) => o.side === q.side && o.methods.includes(q.method))
    .filter((o) => q.amountBob >= o.minBob && q.amountBob <= o.maxBob)
    .map((offer) => ({
      offer,
      operator: operators.find((op) => op.id === offer.operatorId)!,
      amountBob: q.amountBob,
      amountUsdc: toUsdc(q.amountBob, offer.rate),
      expiresAt,
    }))
    .sort((a, b) => (q.side === "buy" ? b.amountUsdc - a.amountUsdc : a.amountUsdc - b.amountUsdc));
}
