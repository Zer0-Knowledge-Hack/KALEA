import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { StrKey, WebAuth } from "@stellar/stellar-sdk";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env.js";

export type AuthVars = { userId: string };

const serverAccount = env.serverKeypair.publicKey();

// SEP-10 style: server issues a challenge tx, the wallet signs it, server returns a JWT.
export const authRoutes = new Hono()
  .get("/challenge", (c) => {
    const account = c.req.query("account") ?? "";
    if (!StrKey.isValidEd25519PublicKey(account)) {
      throw new HTTPException(400, { message: "Cuenta Stellar inválida" });
    }
    const transaction = WebAuth.buildChallengeTx(
      env.serverKeypair, account, env.homeDomain, 300, env.networkPassphrase, env.homeDomain,
    );
    return c.json({ transaction, networkPassphrase: env.networkPassphrase });
  })
  .post("/token", async (c) => {
    const { transaction } = await c.req.json<{ transaction?: string }>();
    if (!transaction) throw new HTTPException(400, { message: "Falta transacción firmada" });
    try {
      const { clientAccountID } = WebAuth.readChallengeTx(
        transaction, serverAccount, env.networkPassphrase, env.homeDomain, env.homeDomain,
      );
      WebAuth.verifyChallengeTxSigners(
        transaction, serverAccount, env.networkPassphrase, [clientAccountID], env.homeDomain, env.homeDomain,
      );
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(clientAccountID)
        .setIssuer(env.homeDomain)
        .setIssuedAt()
        .setExpirationTime("24h")
        .sign(env.jwtSecret);
      return c.json({ token, account: clientAccountID });
    } catch {
      throw new HTTPException(401, { message: "Firma inválida" });
    }
  });

export const requireAuth = createMiddleware<{ Variables: AuthVars }>(async (c, next) => {
  const token = c.req.header("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new HTTPException(401, { message: "Falta token" });
  try {
    const { payload } = await jwtVerify(token, env.jwtSecret, { issuer: env.homeDomain });
    c.set("userId", payload.sub!);
  } catch {
    throw new HTTPException(401, { message: "Token inválido" });
  }
  await next();
});
