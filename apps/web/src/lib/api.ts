import type { Order, OrderKind, Quote, Rail, Side, Country } from "@kalea/shared";
import type { Corridor } from "./catalog";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

/** An error response from the Kalea API (`{ error: { code, message } }`). */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  /** Bearer credential: an integrator API key (server only) or a merchant JWT. */
  auth?: string;
  body?: unknown;
  baseUrl?: string;
}

export async function request<T>(path: string, { auth, body, baseUrl = API_URL, ...init }: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = data?.error;
    throw new ApiRequestError(res.status, error?.code ?? "http_error", error?.message ?? res.statusText ?? "Request failed");
  }
  return data as T;
}

export interface QuoteRequest {
  country: Country;
  side: Side;
  rail: Rail;
  amount: number;
  amountIn: "fiat" | "usdc";
}

/** `POST /v1/quotes` response: the end-user quote without the internal breakdown. */
export type ApiQuote = Omit<Quote, "breakdown"> & { kind: OrderKind; integratorFeeUsdc: number };

/** `GET /v1/merchants/me/orders` item: exact amounts plus the merchant's reward. */
export type MerchantOrder = Omit<Order, "breakdown" | "integratorId" | "endUserRef"> & {
  kind: OrderKind;
  merchantRewardUsdc: number;
  escrowUsdc: number;
};

export interface RewardEntry {
  merchantId: string;
  orderId: string;
  amountUsdc: number;
  releasedAt: string;
  unlockAt: string;
}

export interface MerchantRewards {
  rewards: RewardEntry[];
  lockedUsdc: number;
  unlockedUsdc: number;
}

export interface MerchantSession {
  token: string;
  account: string;
  merchantId: string;
}

/** Quote shown in the landing demo; `source` tells whether it came from the API or local demo pricing. */
export type DemoQuote = Pick<Quote, "side" | "country" | "fiatCurrency" | "rail" | "rate" | "fiatAmount" | "usdcAmount" | "expiresAt">;
export type DemoSource = "live" | "demo";

export const api = {
  // Integrator endpoints. The API key is a secret: call these only from server code.
  integrator: {
    corridors: (apiKey: string) => request<{ corridors: Corridor[] }>("/v1/corridors", { auth: apiKey, cache: "no-store" }),
    quote: (apiKey: string, input: QuoteRequest) =>
      request<{ quote: ApiQuote }>("/v1/quotes", { method: "POST", auth: apiKey, body: input, cache: "no-store" }),
  },

  // Merchant (LP) endpoints, authenticated with a SEP-10 JWT.
  merchant: {
    challenge: (account: string) =>
      request<{ transaction: string; networkPassphrase: string }>(`/v1/merchants/auth/challenge?account=${encodeURIComponent(account)}`),
    token: (transaction: string) => request<MerchantSession>("/v1/merchants/auth/token", { method: "POST", body: { transaction } }),
    orders: (token: string) => request<{ orders: MerchantOrder[] }>("/v1/merchants/me/orders", { auth: token }),
    rewards: (token: string) => request<MerchantRewards>("/v1/merchants/me/rewards", { auth: token }),
  },

  // Landing demo, proxied by this Next app (src/app/api/demo-quote/route.ts) so no key reaches the browser.
  demo: {
    corridors: () => request<{ corridors: Corridor[]; source: DemoSource }>("/api/demo-quote", { baseUrl: "" }),
    quote: (input: QuoteRequest) =>
      request<{ quote: DemoQuote; source: DemoSource }>("/api/demo-quote", { method: "POST", body: input, baseUrl: "" }),
  },
};
