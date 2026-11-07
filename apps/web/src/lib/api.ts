import type { Order, PaymentMethod, Quote, Side } from "@kalea/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

async function request<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? res.statusText);
  return res.json();
}

export const api = {
  quotes: (side: Side, amountBob: number, method: PaymentMethod) =>
    request<{ quotes: Quote[] }>(`/quotes?side=${side}&amountBob=${amountBob}&method=${method}`),
  challenge: (account: string) =>
    request<{ transaction: string; networkPassphrase: string }>(`/auth/challenge?account=${account}`),
  token: (transaction: string) =>
    request<{ token: string; account: string }>("/auth/token", { method: "POST", body: JSON.stringify({ transaction }) }),
  orders: (token: string) => request<{ orders: Order[] }>("/orders", { token }),
  createOrder: (token: string, body: { offerId: string; amountBob: number; method: PaymentMethod }) =>
    request<{ order: Order }>("/orders", { method: "POST", body: JSON.stringify(body), token }),
};
