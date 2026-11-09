import { Keypair, Networks, StrKey } from '@stellar/stellar-sdk';
import { hashApiKey } from './auth.js';
import type { IntegratorKey, MerchantAccount } from './store.js';

const network = process.env.STELLAR_NETWORK === 'public' ? 'public' : 'testnet';

/** Parses comma-separated `id:value` pairs, failing fast on malformed entries. */
function pairs(name: string, check: (value: string) => boolean): [string, string][] {
  return (process.env[name] ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const sep = entry.indexOf(':');
      const id = sep > 0 ? entry.slice(0, sep) : '';
      // Never echo the value: it may be a secret.
      if (!id || !check(entry.slice(sep + 1)))
        throw new Error(`${name}: malformed entry "${id || '?'}"`);
      return [id, entry.slice(sep + 1)];
    });
}

const MIN_API_KEY_LENGTH = 24;

export const env = {
  port: Number(process.env.PORT ?? 8787),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  homeDomain: process.env.HOME_DOMAIN ?? 'localhost',
  stellarNetwork: network,
  networkPassphrase: network === 'public' ? Networks.PUBLIC : Networks.TESTNET,
  // Dev fallbacks rotate on restart; set both in .env for stable sessions.
  serverKeypair: process.env.SERVER_SIGNING_SECRET
    ? Keypair.fromSecret(process.env.SERVER_SIGNING_SECRET)
    : Keypair.random(),
  jwtSecret: new TextEncoder().encode(
    process.env.JWT_SECRET ?? crypto.randomUUID() + crypto.randomUUID(),
  ),
  /** Raw keys are hashed here and never kept in memory. Unset means no integrator can authenticate. */
  integratorKeys: pairs('INTEGRATOR_API_KEYS', (key) => key.length >= MIN_API_KEY_LENGTH).map(
    ([integratorId, key]): IntegratorKey => ({ integratorId, keyHash: hashApiKey(key) }),
  ),
  merchantAccounts: pairs('MERCHANT_ACCOUNTS', (account) =>
    StrKey.isValidEd25519PublicKey(account),
  ).map(([merchantId, account]): MerchantAccount => ({ merchantId, account })),
};
