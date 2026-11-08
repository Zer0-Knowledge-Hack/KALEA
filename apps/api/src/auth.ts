import { createHash, timingSafeEqual } from "node:crypto";
import { Hono, type Context } from "hono";
import { createMiddleware } from "hono/factory";
import { StrKey, WebAuth, type Keypair } from "@stellar/stellar-sdk";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import type { Integrator, Merchant } from "@kalea/shared";
import { ApiError, parseBody } from "./errors.js";
import type { Store } from "./store.js";

export type Actor =
  | { kind: "integrator"; integrator: Integrator }
  | { kind: "merchant"; merchant: Merchant; account: string };

export type AppEnv = { Variables: { actor: Actor } };

export interface AuthConfig {
  serverKeypair: Keypair;
  networkPassphrase: string;
  homeDomain: string;
  jwtSecret: Uint8Array;
}

export const hashApiKey = (key: string): string => createHash("sha256").update(key, "utf8").digest("hex");

const bearer = (c: Context) => c.req.header("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];

const MERCHANT_ROLE = "merchant";

export function createAuth(store: Store, config: AuthConfig) {
  const serverAccount = config.serverKeypair.publicKey();

  /**
   * Compares the key's SHA-256 digest against every stored hash with timingSafeEqual and no early
   * exit, so the response time does not depend on which (or whether a) stored key matched.
   */
  function integratorForKey(key: string): Integrator | undefined {
    const digest = Buffer.from(hashApiKey(key), "hex");
    let matchId: string | undefined;
    for (const { integratorId, keyHash } of store.integratorKeys) {
      const stored = Buffer.from(keyHash, "hex");
      if (stored.length === digest.length && timingSafeEqual(stored, digest)) matchId = integratorId;
    }
    return matchId ? store.integrators.get(matchId) : undefined;
  }

  async function merchantForToken(token: string): Promise<Extract<Actor, { kind: "merchant" }>> {
    try {
      const { payload } = await jwtVerify(token, config.jwtSecret, { issuer: config.homeDomain });
      const link = store.merchantAccounts.find((m) => m.account === payload.sub);
      const merchant = store.merchants.find((m) => m.id === link?.merchantId);
      if (payload.role === MERCHANT_ROLE && link && merchant) return { kind: "merchant", merchant, account: link.account };
    } catch {
      // Fall through to the uniform 401 below.
    }
    throw new ApiError(401, "invalid_token", "Invalid or expired merchant token");
  }

  const requireIntegrator = createMiddleware<AppEnv>(async (c, next) => {
    const key = c.req.header("x-api-key") ?? bearer(c);
    if (!key) throw new ApiError(401, "missing_api_key", "Provide an API key via Authorization: Bearer <key> or X-API-Key");
    const integrator = integratorForKey(key);
    if (!integrator) throw new ApiError(401, "invalid_api_key", "Invalid API key");
    c.set("actor", { kind: "integrator", integrator });
    await next();
  });

  const requireMerchant = createMiddleware<AppEnv>(async (c, next) => {
    const token = bearer(c);
    if (!token) throw new ApiError(401, "missing_token", "Provide a merchant token via Authorization: Bearer <token>");
    c.set("actor", await merchantForToken(token));
    await next();
  });

  /** Accepts either an integrator API key or a merchant JWT (used by lifecycle events). */
  const requireActor = createMiddleware<AppEnv>(async (c, next) => {
    const apiKey = c.req.header("x-api-key");
    const token = bearer(c);
    const integrator = apiKey ? integratorForKey(apiKey) : token ? integratorForKey(token) : undefined;
    if (integrator) c.set("actor", { kind: "integrator", integrator });
    else if (apiKey) throw new ApiError(401, "invalid_api_key", "Invalid API key");
    else if (token) c.set("actor", await merchantForToken(token));
    else throw new ApiError(401, "missing_credentials", "Provide an integrator API key or a merchant token");
    await next();
  });

  // SEP-10 style: the server issues a challenge tx, the merchant's wallet signs it, the server returns a JWT.
  const merchantAuthRoutes = new Hono<AppEnv>()
    .get("/challenge", (c) => {
      const account = c.req.query("account") ?? "";
      if (!StrKey.isValidEd25519PublicKey(account)) throw new ApiError(400, "invalid_account", "Invalid Stellar account");
      const transaction = WebAuth.buildChallengeTx(
        config.serverKeypair, account, config.homeDomain, 300, config.networkPassphrase, config.homeDomain,
      );
      return c.json({ transaction, networkPassphrase: config.networkPassphrase });
    })
    .post("/token", async (c) => {
      const { transaction } = await parseBody(c, z.object({ transaction: z.string().min(1) }));
      let account: string;
      try {
        account = WebAuth.readChallengeTx(
          transaction, serverAccount, config.networkPassphrase, config.homeDomain, config.homeDomain,
        ).clientAccountID;
        WebAuth.verifyChallengeTxSigners(
          transaction, serverAccount, config.networkPassphrase, [account], config.homeDomain, config.homeDomain,
        );
      } catch {
        throw new ApiError(401, "invalid_signature", "Invalid or unsigned challenge");
      }
      // Checked only after the signature proves account ownership, so registration is not probeable.
      const link = store.merchantAccounts.find((m) => m.account === account);
      if (!link) throw new ApiError(403, "unknown_merchant", "This Stellar account is not a registered merchant");
      const token = await new SignJWT({ role: MERCHANT_ROLE })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(account)
        .setIssuer(config.homeDomain)
        .setIssuedAt()
        .setExpirationTime("24h")
        .sign(config.jwtSecret);
      return c.json({ token, account, merchantId: link.merchantId });
    });

  return { requireIntegrator, requireMerchant, requireActor, merchantAuthRoutes };
}
