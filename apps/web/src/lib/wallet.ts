import { useCallback, useEffect, useState } from "preact/hooks";
import { api, type MerchantSession } from "./api";

export type WalletStatus = "idle" | "connecting" | "signing" | "ready" | "error";

/** Merchant (liquidity provider) session obtained through SEP-10 with Freighter. */
export interface WalletState {
  account: string | null;
  merchantId: string | null;
  token: string | null;
  status: WalletStatus;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const STORAGE_KEY = "kalea.merchant-session";

function loadSession(): MerchantSession | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as MerchantSession | null;
    return saved?.account && saved?.token && saved?.merchantId ? saved : null;
  } catch {
    return null;
  }
}

/** SEP-10 sign-in with Freighter. The session is kept in localStorage so a reload stays signed in. */
export function useWallet(): WalletState {
  const [session, setSession] = useState<MerchantSession | null>(null);
  const [status, setStatus] = useState<WalletStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setSession(saved);
      setStatus("ready");
    }
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    try {
      setStatus("connecting");
      // Loaded on demand: keeps the wallet SDK out of the initial island bundle and out of the static build.
      const { isConnected, requestAccess, signTransaction } = await import("@stellar/freighter-api");
      if (!(await isConnected()).isConnected) throw new Error("Install the Freighter wallet to continue");
      const access = await requestAccess();
      if (access.error) throw new Error(String(access.error.message ?? access.error));

      setStatus("signing");
      const { transaction, networkPassphrase } = await api.merchant.challenge(access.address);
      const signed = await signTransaction(transaction, { networkPassphrase, address: access.address });
      if (signed.error) throw new Error(String(signed.error.message ?? signed.error));

      const next = await api.merchant.token(signed.signedTxXdr);
      setSession(next);
      setStatus("ready");
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Could not sign in");
    }
  }, []);

  const disconnect = useCallback(() => {
    setSession(null);
    setStatus("idle");
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return { account: session?.account ?? null, merchantId: session?.merchantId ?? null, token: session?.token ?? null, status, error, connect, disconnect };
}

export const shortAddress = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
