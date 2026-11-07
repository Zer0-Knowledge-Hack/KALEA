import { Keypair, Networks } from "@stellar/stellar-sdk";

const network = process.env.STELLAR_NETWORK === "public" ? "public" : "testnet";

export const env = {
  port: Number(process.env.PORT ?? 8787),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  homeDomain: process.env.HOME_DOMAIN ?? "localhost",
  stellarNetwork: network,
  networkPassphrase: network === "public" ? Networks.PUBLIC : Networks.TESTNET,
  // Dev fallbacks rotate on restart; set both in .env for stable sessions.
  serverKeypair: process.env.SERVER_SIGNING_SECRET
    ? Keypair.fromSecret(process.env.SERVER_SIGNING_SECRET)
    : Keypair.random(),
  jwtSecret: new TextEncoder().encode(
    process.env.JWT_SECRET ?? crypto.randomUUID() + crypto.randomUUID(),
  ),
};
