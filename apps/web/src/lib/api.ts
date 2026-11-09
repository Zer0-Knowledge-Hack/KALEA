import type { Order, OrderKind, Quote, Rail, Side, Country } from '@kalea/shared';
import type { Corridor } from './catalog';

/** Kalea API base URL, inlined at build time from `PUBLIC_API_URL`. */
export const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:8787';

/** An error response from the Kalea API (`{ error: { code, message } }`). */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Bearer credential: a merchant SEP-10 JWT. */
  auth?: string;
  body?: unknown;
}

export async function request<T>(
  path: string,
  { auth, body, ...init }: RequestOptions = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = data?.error;
    throw new ApiRequestError(
      res.status,
      error?.code ?? 'http_error',
      error?.message ?? res.statusText ?? 'Request failed',
    );
  }
  return data as T;
}

export interface QuoteRequest {
  country: Country;
  side: Side;
  rail: Rail;
  amount: number;
  amountIn: 'fiat' | 'usdc';
}

/** `GET /v1/merchants/me/orders` item: exact amounts plus the merchant's reward. */
export type MerchantOrder = Omit<Order, 'breakdown' | 'integratorId' | 'endUserRef'> & {
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

/** End-user quote shown in the landing demo: one all-in rate and exact amounts, no fee breakdown. */
export type DemoQuote = Pick<
  Quote,
  'side' | 'country' | 'fiatCurrency' | 'rail' | 'rate' | 'fiatAmount' | 'usdcAmount' | 'expiresAt'
> & {
  kind?: OrderKind;
};

export const api = {
  // Public landing demo: unauthenticated and rate limited by the API, so the web holds no integrator key.
  demo: {
    corridors: () => request<{ corridors: Corridor[] }>('/v1/demo/corridors'),
    quote: (input: QuoteRequest) =>
      request<{ demo: true; quote: DemoQuote }>('/v1/demo/quote', { method: 'POST', body: input }),
  },

  // Merchant (LP) endpoints, authenticated with a SEP-10 JWT.
  merchant: {
    challenge: (account: string) =>
      request<{ transaction: string; networkPassphrase: string }>(
        `/v1/merchants/auth/challenge?account=${encodeURIComponent(account)}`,
      ),
    token: (transaction: string) =>
      request<MerchantSession>('/v1/merchants/auth/token', {
        method: 'POST',
        body: { transaction },
      }),
    orders: (token: string) =>
      request<{ orders: MerchantOrder[] }>('/v1/merchants/me/orders', { auth: token }),
    rewards: (token: string) =>
      request<MerchantRewards>('/v1/merchants/me/rewards', { auth: token }),
  },
};
