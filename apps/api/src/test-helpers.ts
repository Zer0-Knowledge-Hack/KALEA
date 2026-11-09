import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';
import { createApp, type AppConfig } from './app.js';
import { hashApiKey } from './auth.js';

/** Test-only API keys. Production keys come from INTEGRATOR_API_KEYS (see .env.example). */
export const KEYS = {
  wallet: 'kalea_test_wallet_0123456789abcdef',
  payments: 'kalea_test_payments_0123456789abcd',
} as const;

export const T0 = Date.parse('2026-11-08T12:00:00.000Z');

/** Builds an isolated app with fresh in-memory state, test keys and a controllable clock. */
export function setup(overrides: Partial<AppConfig> = {}) {
  const clock = { now: T0 };
  const merchantKp = Keypair.random();
  const app = createApp({
    integratorKeys: [
      { integratorId: 'int_wallet', keyHash: hashApiKey(KEYS.wallet) },
      { integratorId: 'int_payments', keyHash: hashApiKey(KEYS.payments) },
    ],
    merchantAccounts: [{ merchantId: 'mer_andes', account: merchantKp.publicKey() }],
    now: () => clock.now,
    ...overrides,
  });

  const call = (
    path: string,
    init: {
      method?: string;
      body?: unknown;
      key?: string;
      token?: string;
      headers?: Record<string, string>;
    } = {},
  ) =>
    app.request(path, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
        ...(init.key ? { 'X-API-Key': init.key } : {}),
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });

  async function merchantLogin(kp = merchantKp, signer = kp) {
    const res = await app.request(`/v1/merchants/auth/challenge?account=${kp.publicKey()}`);
    const { transaction, networkPassphrase } = await res.json();
    const tx = TransactionBuilder.fromXDR(transaction, networkPassphrase);
    tx.sign(signer);
    return app.request('/v1/merchants/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: tx.toXDR() }),
    });
  }

  return { app, clock, call, merchantKp, merchantLogin };
}

export const buyBo = {
  country: 'BO',
  side: 'buy',
  rail: 'qr_simple',
  amount: 100,
  amountIn: 'usdc',
} as const;
export const sellBo = {
  country: 'BO',
  side: 'sell',
  rail: 'bank_transfer',
  amount: 100,
  amountIn: 'usdc',
} as const;
